import {
  CheckoutOptionsResponseSchema,
  CheckoutQuoteSchema,
  type CartPersonalizationAnswer,
  type CheckoutQuote,
  type CheckoutQuoteInput,
  type CheckoutQuoteLine,
  type CustomerId,
  type MongolianPhone,
  type PlaceOrderInput,
  type PlaceOrderResult,
} from "@ecom/contracts";
import { Result } from "better-result";
import * as v from "valibot";
import { createOrderStatusAccess } from "../order";
import { commercialFacts } from "./commercial";
import { checkoutQueries, commitPlacement, readPlacement } from "./persistence";

type CheckoutFailureCode =
  | "catalog_unavailable"
  | "invalid_personalization"
  | "insufficient_inventory"
  | "quantity_exceeded"
  | "delivery_unavailable"
  | "pickup_unavailable"
  | "commercial_changed"
  | "idempotency_conflict"
  | "bank_transfer_unavailable"
  | "infrastructure_unavailable";
export type CheckoutFailure = {
  [Code in CheckoutFailureCode]: {
    readonly code: Code;
    readonly linePositions?: readonly number[];
    readonly currentQuote?: CheckoutQuote;
  };
}[CheckoutFailureCode];

const failure = (
  code: CheckoutFailure["code"],
  linePositions?: readonly number[],
  currentQuote?: CheckoutQuote,
) =>
  Result.err<never, CheckoutFailure>({
    code,
    ...(linePositions ? { linePositions } : {}),
    ...(currentQuote ? { currentQuote } : {}),
  });

type Snapshot = Awaited<ReturnType<typeof checkoutQueries.readQuoteSnapshot>>;
type Definition = Snapshot["definitions"][number];
type Value = Snapshot["values"][number];

const validatedPersonalizations = (
  catalogItemId: string,
  answers: readonly CartPersonalizationAnswer[],
  definitions: readonly Definition[],
  values: readonly Value[],
) => {
  const active = definitions.filter(
    (definition) => definition.catalogItemId === catalogItemId && definition.state === "active",
  );
  if (
    answers.length > active.length ||
    active.some(
      (definition) => definition.required && !answers.some(({ key }) => key === definition.key),
    )
  ) {
    return undefined;
  }
  const resolved = answers.flatMap((answer) => {
    const definition = active.find(({ key }) => key === answer.key);
    if (!definition || definition.kind !== answer.kind) {
      return [];
    }
    if (answer.kind === "text") {
      if (
        definition.maxLength === null ||
        answer.value.length > definition.maxLength ||
        (definition.required && answer.value.trim().length === 0)
      ) {
        return [];
      }
    } else if (answer.kind === "single_select") {
      const selected = values.find(
        ({ id, personalizationId, state }) =>
          id === answer.valueId && personalizationId === definition.id && state === "active",
      );
      if (!selected) {
        return [];
      }
    } else if (definition.required && !answer.checked) {
      return [];
    }
    const value =
      answer.kind === "text"
        ? { kind: "text" as const, text: answer.value }
        : answer.kind === "single_select"
          ? {
              kind: "single_select" as const,
              valueId: answer.valueId,
              label: values.find(({ id }) => id === answer.valueId)?.label ?? "",
            }
          : { kind: "checkbox" as const, checked: answer.checked };
    return [{ definitionId: definition.id, key: definition.key, label: definition.label, value }];
  });
  return resolved.length === answers.length ? resolved : undefined;
};

const resolveLines = (input: CheckoutQuoteInput, snapshot: Snapshot) => {
  const invalidCatalog: number[] = [];
  const invalidPersonalization: number[] = [];
  const lines: CheckoutQuoteLine[] = [];
  for (const [position, intent] of input.lines.entries()) {
    if (intent.kind === "variant") {
      const row = snapshot.variantRows.find(({ id }) => id === intent.variantId);
      if (
        !row ||
        row.variantState !== "active" ||
        row.productState !== "published" ||
        row.productKind !== "product"
      ) {
        invalidCatalog.push(position);
        continue;
      }
      const personalizations = validatedPersonalizations(
        row.catalogItemId,
        intent.personalizations,
        snapshot.definitions,
        snapshot.values,
      );
      if (!personalizations) {
        invalidPersonalization.push(position);
        continue;
      }
      const unitPriceMnt = row.unitPriceMnt ?? row.productPriceMnt;
      lines.push({
        position,
        source: { kind: "variant", id: intent.variantId, catalogItemId: row.catalogItemId },
        name: row.name,
        sku: row.sku,
        quantity: intent.quantity,
        unitPriceMnt,
        merchandiseAmountMnt: unitPriceMnt * intent.quantity,
        discountMnt: 0,
        totalMnt: unitPriceMnt * intent.quantity,
        options: snapshot.optionRows
          .filter(({ variantId }) => variantId === intent.variantId)
          .map(({ groupId, groupKey, groupLabel, valueId, valueKey, valueLabel }) => ({
            groupId,
            groupKey,
            groupLabel,
            valueId,
            valueKey,
            valueLabel,
          })),
        personalizations,
        bundleComponents: [],
        demand: [{ variantId: intent.variantId, quantity: intent.quantity }],
      });
      continue;
    }
    const row = snapshot.bundleRows.find(({ id }) => id === intent.bundleId);
    const components = snapshot.componentRows.filter(
      ({ bundleId }) => bundleId === intent.bundleId,
    );
    if (
      !row ||
      row.state !== "published" ||
      row.kind !== "bundle" ||
      components.length === 0 ||
      components.some(
        (component) =>
          component.variantState !== "active" ||
          component.productState !== "published" ||
          component.productKind !== "product",
      )
    ) {
      invalidCatalog.push(position);
      continue;
    }
    const personalizations = validatedPersonalizations(
      row.catalogItemId,
      intent.personalizations,
      snapshot.definitions,
      snapshot.values,
    );
    if (!personalizations) {
      invalidPersonalization.push(position);
      continue;
    }
    const demandByVariant = new Map<string, number>();
    for (const component of components) {
      demandByVariant.set(
        component.variantId,
        (demandByVariant.get(component.variantId) ?? 0) + component.quantity * intent.quantity,
      );
    }
    lines.push({
      position,
      source: { kind: "bundle", id: intent.bundleId, catalogItemId: row.catalogItemId },
      name: row.name,
      sku: row.sku,
      quantity: intent.quantity,
      unitPriceMnt: row.unitPriceMnt,
      merchandiseAmountMnt: row.unitPriceMnt * intent.quantity,
      discountMnt: 0,
      totalMnt: row.unitPriceMnt * intent.quantity,
      options: [],
      personalizations,
      bundleComponents: components.map((component) => ({
        variantId: component.variantId,
        name: component.name,
        sku: component.sku,
        perBundleQuantity: component.quantity,
        totalQuantity: component.quantity * intent.quantity,
      })),
      demand: [...demandByVariant]
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([variantId, quantity]) => ({ variantId, quantity })),
    });
  }
  return { lines, invalidCatalog, invalidPersonalization };
};

const hasTarget = (line: CheckoutQuoteLine, ruleId: string, snapshot: Snapshot) =>
  snapshot.rules
    .find((rule) => rule.id === ruleId)
    ?.targets.some((target) => {
      if (target.kind === "all") {
        return true;
      }
      if (target.kind === "product") {
        return target.id === line.source.catalogItemId;
      }
      if (target.kind === "variant") {
        return line.source.kind === "variant" && target.id === line.source.id;
      }
      if (target.kind === "category") {
        return (
          snapshot.categoryRows.some(
            (category) => category.id === target.id && category.state === "active",
          ) &&
          snapshot.categoryMemberships.some(
            (membership) =>
              membership.categoryId === target.id &&
              membership.catalogItemId === line.source.catalogItemId,
          )
        );
      }
      return (
        snapshot.collectionRows.some(
          (collection) => collection.id === target.id && collection.state === "active",
        ) &&
        snapshot.collectionMemberships.some(
          (membership) =>
            membership.collectionId === target.id &&
            membership.catalogItemId === line.source.catalogItemId,
        )
      );
    }) ?? false;

const candidate = (
  rule: Snapshot["rules"][number],
  lines: readonly CheckoutQuoteLine[],
  snapshot: Snapshot,
  now: number,
) => {
  if (
    (rule.startsAt && rule.startsAt.getTime() > now) ||
    (rule.endsAt && rule.endsAt.getTime() <= now) ||
    (rule.globalLimit !== null && rule.redemptionCount >= rule.globalLimit)
  ) {
    return undefined;
  }
  const positions = lines
    .filter((line) => hasTarget(line, rule.id, snapshot))
    .map(({ position }) => position);
  const eligibleSubtotal = lines
    .filter((line) => positions.includes(line.position))
    .reduce((sum, line) => sum + line.merchandiseAmountMnt, 0);
  if (eligibleSubtotal < rule.minimumSubtotalMnt || eligibleSubtotal === 0) {
    return undefined;
  }
  const reduction = Math.min(
    eligibleSubtotal,
    rule.calculation === "percentage"
      ? Number((BigInt(eligibleSubtotal) * BigInt(rule.value)) / 100n)
      : rule.value,
  );
  return reduction > 0 ? { rule, positions, eligibleSubtotal, reduction } : undefined;
};

type Candidate = NonNullable<ReturnType<typeof candidate>>;
const allocate = (chosen: Candidate, lines: readonly CheckoutQuoteLine[]) => {
  const shares = lines
    .filter((line) => chosen.positions.includes(line.position))
    .map((line) => ({
      position: line.position,
      amount: Number(
        (BigInt(line.merchandiseAmountMnt) * BigInt(chosen.reduction)) /
          BigInt(chosen.eligibleSubtotal),
      ),
      remainder:
        (BigInt(line.merchandiseAmountMnt) * BigInt(chosen.reduction)) %
        BigInt(chosen.eligibleSubtotal),
    }));
  let remaining = chosen.reduction - shares.reduce((sum, share) => sum + share.amount, 0);
  for (const share of shares.toSorted((left, right) =>
    left.remainder === right.remainder
      ? left.position - right.position
      : left.remainder > right.remainder
        ? -1
        : 1,
  )) {
    if (remaining === 0) {
      break;
    }
    share.amount += 1;
    remaining -= 1;
  }
  return new Map(shares.map(({ position, amount }) => [position, amount]));
};

const digest = async (value: unknown) => {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const correctiveCheckout = async (input: CheckoutQuoteInput) => {
  const options = await checkoutQueries.readOptions();
  const fulfillment = options.settings?.deliveryEnabled
    ? { kind: "delivery" as const }
    : options.settings?.pickupEnabled
      ? options.locations
          .filter(({ active, pickupEnabled }) => active && pickupEnabled)
          .map(({ id }) => ({ kind: "pickup" as const, locationId: id }))
          .at(0)
      : undefined;
  return fulfillment
    ? calculateCheckout({ ...input, fulfillment })
    : failure("infrastructure_unavailable");
};

export const placeOrder = async (
  input: PlaceOrderInput,
  customer: { readonly id: CustomerId; readonly phone: MongolianPhone } | null,
): Promise<Result<PlaceOrderResult, CheckoutFailure>> => {
  try {
    const intentDigest = await digest({
      acceptedCommercialFingerprint: input.acceptedCommercialFingerprint,
      quoteInput: input.quoteInput,
      contact: input.contact,
      paymentMethod: input.paymentMethod,
    });
    const statusAccess = await createOrderStatusAccess(input.idempotencyKey);
    const replay = async () => {
      const placement = await readPlacement(input.idempotencyKey, statusAccess.statusPath);
      return placement
        ? placement.intentDigest === intentDigest
          ? Result.ok(placement.result)
          : failure("idempotency_conflict")
        : undefined;
    };
    const existing = await replay();
    if (existing) {
      return existing;
    }
    const current = await calculateCheckout(input.quoteInput);
    if (current.isErr()) {
      if (
        current.error.code === "delivery_unavailable" ||
        current.error.code === "pickup_unavailable"
      ) {
        const corrective = await correctiveCheckout(input.quoteInput);
        return corrective.isOk()
          ? failure("commercial_changed", undefined, corrective.value.quote)
          : Result.err(current.error);
      }
      return Result.err(current.error);
    }
    if (current.value.quote.commercialFingerprint !== input.acceptedCommercialFingerprint) {
      return failure("commercial_changed", undefined, current.value.quote);
    }
    const options = await checkoutQueries.readOptions();
    if (!options.settings) {
      return failure("infrastructure_unavailable");
    }
    if (current.value.quote.totalMnt > 0 && !options.settings.bankTransferEnabled) {
      return failure("bank_transfer_unavailable");
    }
    const fulfillment = input.quoteInput.fulfillment;
    const destination =
      fulfillment.kind === "delivery"
        ? input.contact.deliveryAddress === null
          ? undefined
          : { kind: "delivery" as const, address: input.contact.deliveryAddress }
        : options.locations
            .filter(({ active, pickupEnabled }) => active && pickupEnabled)
            .map(({ id, name, address }) => ({
              kind: "pickup" as const,
              locationId: id,
              name,
              address,
            }))
            .find(({ locationId }) => locationId === fulfillment.locationId);
    if (!destination) {
      return failure(
        input.quoteInput.fulfillment.kind === "delivery"
          ? "delivery_unavailable"
          : "pickup_unavailable",
      );
    }
    let committed;
    try {
      committed = await commitPlacement(
        input,
        current.value.quote,
        current.value.commercial,
        intentDigest,
        destination,
        customer?.phone === input.contact.recipientPhone ? customer.id : null,
        statusAccess,
      );
    } catch {
      return (await replay()) ?? failure("infrastructure_unavailable");
    }
    if (committed) {
      return committed.intentDigest === intentDigest
        ? Result.ok(committed.result)
        : failure("idempotency_conflict");
    }
    const corrective = await calculateCheckout(input.quoteInput);
    if (corrective.isOk()) {
      return corrective.value.quote.commercialFingerprint !== input.acceptedCommercialFingerprint
        ? failure("commercial_changed", undefined, corrective.value.quote)
        : failure("infrastructure_unavailable");
    }
    if (
      corrective.error.code === "delivery_unavailable" ||
      corrective.error.code === "pickup_unavailable"
    ) {
      const alternative = await correctiveCheckout(input.quoteInput);
      return alternative.isOk()
        ? failure("commercial_changed", undefined, alternative.value.quote)
        : Result.err(corrective.error);
    }
    return corrective.error.code === "insufficient_inventory"
      ? Result.err(corrective.error)
      : failure("infrastructure_unavailable");
  } catch {
    return failure("infrastructure_unavailable");
  }
};

export const readCheckoutOptions = async () => {
  try {
    const snapshot = await checkoutQueries.readOptions();
    if (!snapshot.settings) {
      return failure("infrastructure_unavailable");
    }
    return Result.ok(
      v.parse(CheckoutOptionsResponseSchema.entries.data, {
        deliveryEnabled: snapshot.settings.deliveryEnabled,
        pickupLocations: snapshot.settings.pickupEnabled
          ? snapshot.locations
              .filter((location) => location.active && location.pickupEnabled)
              .map(({ id, name, address }) => ({ id, name, address }))
          : [],
      }),
    );
  } catch {
    return failure("infrastructure_unavailable");
  }
};

const calculateCheckout = async (input: CheckoutQuoteInput) => {
  try {
    const snapshot = await checkoutQueries.readQuoteSnapshot(input);
    const resolved = resolveLines(input, snapshot);
    if (resolved.invalidCatalog.length) {
      return failure("catalog_unavailable", resolved.invalidCatalog);
    }
    if (resolved.invalidPersonalization.length) {
      return failure("invalid_personalization", resolved.invalidPersonalization);
    }
    const demand = new Map<string, number>();
    for (const line of resolved.lines) {
      for (const item of line.demand) {
        demand.set(item.variantId, (demand.get(item.variantId) ?? 0) + item.quantity);
      }
    }
    if ([...demand.values()].some((quantity) => quantity > 1_000_000)) {
      const positions = resolved.lines
        .filter((line) =>
          line.demand.some(({ variantId }) => (demand.get(variantId) ?? 0) > 1_000_000),
        )
        .map(({ position }) => position);
      return failure("quantity_exceeded", positions);
    }
    const inventory = new Map(
      snapshot.variantRows.map((row) => [
        row.id,
        { onHandQuantity: row.onHandQuantity, reservedQuantity: row.reservedQuantity },
      ]),
    );
    for (const component of snapshot.componentRows) {
      inventory.set(component.variantId, {
        onHandQuantity: component.onHandQuantity,
        reservedQuantity: component.reservedQuantity,
      });
    }
    const unavailable = resolved.lines
      .filter((line) =>
        line.demand.some(({ variantId }) => {
          const row = inventory.get(variantId);
          return !row || row.onHandQuantity - row.reservedQuantity < (demand.get(variantId) ?? 0);
        }),
      )
      .map(({ position }) => position);
    if (unavailable.length) {
      return failure("insufficient_inventory", unavailable);
    }
    if (!snapshot.settings) {
      return failure("infrastructure_unavailable");
    }
    if (input.fulfillment.kind === "delivery" && !snapshot.settings.deliveryEnabled) {
      return failure("delivery_unavailable");
    }
    if (input.fulfillment.kind === "pickup") {
      const locationId = input.fulfillment.locationId;
      if (
        !snapshot.settings.pickupEnabled ||
        !snapshot.locations.some(
          (location) => location.id === locationId && location.active && location.pickupEnabled,
        )
      ) {
        return failure("pickup_unavailable");
      }
    }
    const now = Date.parse(snapshot.quotedAt);
    const candidates = snapshot.rules
      .map((rule) => candidate(rule, resolved.lines, snapshot, now))
      .filter((value): value is Candidate => value !== undefined);
    const coded =
      input.code === null
        ? undefined
        : candidates.find(({ rule }) => rule.mode === "code" && rule.code === input.code);
    const automatic = candidates
      .filter(({ rule }) => rule.mode === "automatic")
      .toSorted(
        (left, right) =>
          right.reduction - left.reduction || left.rule.id.localeCompare(right.rule.id),
      )
      .at(0);
    const chosen = coded ?? automatic;
    const allocations = chosen ? allocate(chosen, resolved.lines) : new Map<number, number>();
    const lines = resolved.lines.map((line) => {
      const discountMnt = allocations.get(line.position) ?? 0;
      return { ...line, discountMnt, totalMnt: line.merchandiseAmountMnt - discountMnt };
    });
    const subtotalMnt = lines.reduce((sum, line) => sum + line.merchandiseAmountMnt, 0);
    const discountMnt = chosen?.reduction ?? 0;
    const postDiscountMerchandiseMnt = subtotalMnt - discountMnt;
    const deliveryFeeMnt =
      input.fulfillment.kind === "pickup" ||
      (snapshot.settings.freeDeliveryThresholdMnt !== null &&
        postDiscountMerchandiseMnt >= snapshot.settings.freeDeliveryThresholdMnt)
        ? 0
        : snapshot.settings.deliveryFeeMnt;
    const facts = {
      lines,
      subtotalMnt,
      discount: chosen
        ? {
            kind: "applied" as const,
            ruleId: chosen.rule.id,
            name: chosen.rule.name,
            amountMnt: chosen.reduction,
            submittedCode: input.code,
            codeAccepted: coded !== undefined,
          }
        : { kind: "none" as const, submittedCode: input.code, codeAccepted: false },
      postDiscountMerchandiseMnt,
      fulfillment: input.fulfillment,
      deliveryFeeMnt,
      fees: [
        {
          kind: "delivery" as const,
          label: input.fulfillment.kind === "pickup" ? "Pickup" : "Delivery",
          amountMnt: deliveryFeeMnt,
        },
      ],
      totalMnt: postDiscountMerchandiseMnt + deliveryFeeMnt,
    };
    const chosenRule = chosen?.rule;
    const commercial = commercialFacts(
      facts,
      chosenRule
        ? {
            kind: "applied",
            ruleId: chosenRule.id,
            mode: chosenRule.mode,
            code: chosenRule.code,
            calculation: chosenRule.calculation,
            value: chosenRule.value,
            startsAt: chosenRule.startsAt?.getTime() ?? null,
            endsAt: chosenRule.endsAt?.getTime() ?? null,
            minimumSubtotalMnt: chosenRule.minimumSubtotalMnt,
            globalLimit: chosenRule.globalLimit,
            targetsJson: chosenRule.targetsJson,
          }
        : { kind: "none" },
      {
        activeRules: snapshot.rules.map((rule) => ({
          id: rule.id,
          mode: rule.mode,
          code: rule.code,
          calculation: rule.calculation,
          value: rule.value,
          startsAt: rule.startsAt?.getTime() ?? null,
          endsAt: rule.endsAt?.getTime() ?? null,
          minimumSubtotalMnt: rule.minimumSubtotalMnt,
          globalLimit: rule.globalLimit,
          targetsJson: rule.targetsJson,
          updatedAt: rule.updatedAt.getTime(),
        })),
        categoryMemberships: snapshot.categoryMemberships
          .filter(({ catalogItemId }) =>
            lines.some((line) => line.source.catalogItemId === catalogItemId),
          )
          .map(({ catalogItemId, categoryId }) => ({ catalogItemId, categoryId })),
        collectionMemberships: snapshot.collectionMemberships
          .filter(({ catalogItemId }) =>
            lines.some((line) => line.source.catalogItemId === catalogItemId),
          )
          .map(({ catalogItemId, collectionId }) => ({ catalogItemId, collectionId })),
        activeCategoryIds: snapshot.categoryRows
          .filter(({ state }) => state === "active")
          .map(({ id }) => id),
        activeCollectionIds: snapshot.collectionRows
          .filter(({ state }) => state === "active")
          .map(({ id }) => id),
      },
      {
        deliveryEnabled: snapshot.settings.deliveryEnabled,
        pickupEnabled: snapshot.settings.pickupEnabled,
        deliveryFeeMnt: snapshot.settings.deliveryFeeMnt,
        freeDeliveryThresholdMnt: snapshot.settings.freeDeliveryThresholdMnt,
        updatedAt: snapshot.settings.updatedAt.getTime(),
      },
    );
    const quote = v.parse(CheckoutQuoteSchema, {
      quotedAt: snapshot.quotedAt,
      ...facts,
      commercialFingerprint: await digest(commercial),
    });
    return Result.ok({ quote, commercial });
  } catch {
    return failure("infrastructure_unavailable");
  }
};

export const quoteCheckout = async (
  input: CheckoutQuoteInput,
): Promise<Result<CheckoutQuote, CheckoutFailure>> => {
  const result = await calculateCheckout(input);
  return result.isOk() ? Result.ok(result.value.quote) : Result.err(result.error);
};
