import {
  BundleDemandSchema,
  BundleQuantitySchema,
  PersonalizationAnswersSchema,
  type Bundle,
  type BundleDemand,
  type BundleId,
  type CatalogItemId,
  type CreateBundleInput,
  type PersonalizationAnswer,
  type PersonalizationDefinition,
  type SaveBundleComponentsInput,
  type SavePersonalizationsInput,
  type UpdateBundleInput,
} from "@ecom/contracts";
import { Result } from "better-result";
import { uniq } from "es-toolkit";
import * as v from "valibot";
import { hasStaffCapability, type StaffActor } from "../staff/operations";
import { purgeCatalogItemCache } from "../catalog/cache";
import { bundleQueries, readPersonalizations } from "./persistence";

type BundleOperationFailureCode =
  | "forbidden"
  | "not_found"
  | "duplicate_slug"
  | "invalid_lifecycle"
  | "invalid_publication"
  | "invalid_component"
  | "duplicate_component"
  | "immutable_components"
  | "slug_locked"
  | "published_cms_dependency"
  | "invalid_personalization"
  | "infrastructure_unavailable";
export type BundleOperationFailure = {
  [Code in BundleOperationFailureCode]: { readonly code: Code };
}[BundleOperationFailureCode];

export type BundleMutationResult = {
  readonly bundle: Bundle;
  readonly cache: "not_required" | "purged" | "committed_but_not_purged";
  readonly cachePurgeRequestId: string | null;
};

const authorized = (actor: StaffActor) =>
  hasStaffCapability(actor.role, "catalog_cms") &&
  hasStaffCapability(actor.role, "inventory_discounts");

const resolveBundle = async (id: BundleId, purge: boolean) => {
  const bundle = await bundleQueries.findById(id);
  if (!bundle) {
    return Result.err<never, BundleOperationFailure>({ code: "not_found" });
  }
  if (!purge || bundle.state === "draft") {
    return Result.ok<BundleMutationResult, never>({
      bundle,
      cache: "not_required",
      cachePurgeRequestId: null,
    });
  }
  const purgeResult = await purgeCatalogItemCache(id);
  return Result.ok<BundleMutationResult, never>({
    bundle,
    cache: purgeResult.kind === "purged" ? "purged" : "committed_but_not_purged",
    cachePurgeRequestId: purgeResult.requestId,
  });
};

export const resolveBundleCachePurge = async (id: BundleId) => resolveBundle(id, true);

export const listBundles = async (actor: StaffActor) => {
  if (!authorized(actor)) {
    return Result.err<never, BundleOperationFailure>({ code: "forbidden" });
  }
  try {
    return Result.ok(await bundleQueries.listAll());
  } catch {
    return Result.err<never, BundleOperationFailure>({ code: "infrastructure_unavailable" });
  }
};

export const createBundle = async (actor: StaffActor, input: CreateBundleInput) => {
  if (!authorized(actor)) {
    return Result.err<never, BundleOperationFailure>({ code: "forbidden" });
  }
  try {
    const result = await bundleQueries.create(input);
    if (result.kind !== "changed" || !result.bundle) {
      return Result.err<never, BundleOperationFailure>({
        code: result.kind === "duplicate_slug" ? "duplicate_slug" : "infrastructure_unavailable",
      });
    }
    return Result.ok<BundleMutationResult, never>({
      bundle: result.bundle,
      cache: "not_required",
      cachePurgeRequestId: null,
    });
  } catch {
    return Result.err<never, BundleOperationFailure>({ code: "infrastructure_unavailable" });
  }
};

export const updateBundle = async (actor: StaffActor, id: BundleId, input: UpdateBundleInput) => {
  if (!authorized(actor)) {
    return Result.err<never, BundleOperationFailure>({ code: "forbidden" });
  }
  try {
    const result = await bundleQueries.update(id, input);
    if (result.kind === "changed") {
      return await resolveBundle(id, true);
    }
    return Result.err<never, BundleOperationFailure>({
      code:
        result.kind === "not_found" ||
        result.kind === "duplicate_slug" ||
        result.kind === "slug_locked"
          ? result.kind
          : "infrastructure_unavailable",
    });
  } catch {
    return Result.err<never, BundleOperationFailure>({ code: "infrastructure_unavailable" });
  }
};

export const saveBundleComponents = async (
  actor: StaffActor,
  id: BundleId,
  input: SaveBundleComponentsInput,
) => {
  if (!authorized(actor)) {
    return Result.err<never, BundleOperationFailure>({ code: "forbidden" });
  }
  try {
    const result = await bundleQueries.saveComponents(id, input);
    return result.kind === "changed"
      ? await resolveBundle(id, false)
      : Result.err<never, BundleOperationFailure>({ code: result.kind });
  } catch {
    return Result.err<never, BundleOperationFailure>({ code: "infrastructure_unavailable" });
  }
};

export const transitionBundle = async (
  actor: StaffActor,
  id: BundleId,
  action: "publish" | "archive" | "reactivate",
) => {
  if (!authorized(actor)) {
    return Result.err<never, BundleOperationFailure>({ code: "forbidden" });
  }
  try {
    const result = await bundleQueries.transition(actor, id, action);
    return result.kind === "changed"
      ? await resolveBundle(id, true)
      : Result.err<never, BundleOperationFailure>({ code: result.kind });
  } catch {
    return Result.err<never, BundleOperationFailure>({ code: "infrastructure_unavailable" });
  }
};

export const readCatalogItemPersonalizations = async (
  actor: StaffActor,
  catalogItemId: CatalogItemId,
) => {
  if (!authorized(actor)) {
    return Result.err<never, BundleOperationFailure>({ code: "forbidden" });
  }
  try {
    const rows = await readPersonalizations([catalogItemId]);
    const definitions = rows.at(0)?.definitions;
    return definitions
      ? Result.ok(definitions)
      : Result.err<never, BundleOperationFailure>({ code: "not_found" });
  } catch {
    return Result.err<never, BundleOperationFailure>({ code: "infrastructure_unavailable" });
  }
};

export const saveCatalogItemPersonalizations = async (
  actor: StaffActor,
  catalogItemId: CatalogItemId,
  input: SavePersonalizationsInput,
) => {
  if (!authorized(actor)) {
    return Result.err<never, BundleOperationFailure>({ code: "forbidden" });
  }
  try {
    const result = await bundleQueries.savePersonalizations(catalogItemId, input);
    if (result.kind !== "changed") {
      return Result.err<never, BundleOperationFailure>({ code: result.kind });
    }
    const rows = await readPersonalizations([catalogItemId]);
    const definitions = rows.at(0)?.definitions;
    if (!definitions) {
      return Result.err<never, BundleOperationFailure>({ code: "infrastructure_unavailable" });
    }
    if (!result.purge) {
      return Result.ok({ definitions, cache: "not_required" as const, cachePurgeRequestId: null });
    }
    const purgeResult = await purgeCatalogItemCache(catalogItemId);
    return Result.ok({
      definitions,
      cache:
        purgeResult.kind === "purged" ? ("purged" as const) : ("committed_but_not_purged" as const),
      cachePurgeRequestId: purgeResult.requestId,
    });
  } catch {
    return Result.err<never, BundleOperationFailure>({ code: "infrastructure_unavailable" });
  }
};

export const expandBundleDemand = async (bundleId: BundleId, quantity: number) => {
  const parsedQuantity = v.safeParse(BundleQuantitySchema, quantity);
  if (!parsedQuantity.success) {
    return Result.err<never, BundleOperationFailure>({ code: "invalid_component" });
  }
  try {
    const rows = await bundleQueries.expandDemand(bundleId, parsedQuantity.output);
    if (rows.length === 0) {
      return Result.err<never, BundleOperationFailure>({ code: "not_found" });
    }
    const totals = new Map<string, number>();
    for (const row of rows) {
      totals.set(row.variantId, (totals.get(row.variantId) ?? 0) + row.quantity);
    }
    return Result.ok(
      [...totals].map(([variantId, demandQuantity]) =>
        v.parse(BundleDemandSchema, { variantId, quantity: demandQuantity }),
      ) satisfies BundleDemand[],
    );
  } catch {
    return Result.err<never, BundleOperationFailure>({ code: "infrastructure_unavailable" });
  }
};

export const validatePersonalizationAnswers = (
  definitions: readonly PersonalizationDefinition[],
  answersInput: unknown,
) => {
  const parsed = v.safeParse(PersonalizationAnswersSchema, answersInput);
  if (!parsed.success) {
    return Result.err<never, BundleOperationFailure>({ code: "invalid_personalization" });
  }
  const answers = parsed.output;
  if (uniq(answers.map(({ key }) => key)).length !== answers.length) {
    return Result.err<never, BundleOperationFailure>({ code: "invalid_personalization" });
  }
  const active = definitions.filter(({ state }) => state === "active");
  const valid =
    answers.every((answer) => {
      const definition = active.find(({ key }) => key === answer.key);
      if (!definition || definition.kind !== answer.kind) {
        return false;
      }
      if (definition.kind === "text" && answer.kind === "text") {
        return (
          answer.value.length <= definition.maxLength &&
          (!definition.required || answer.value.trim().length > 0)
        );
      }
      if (definition.kind === "single_select" && answer.kind === "single_select") {
        return definition.values.some(
          ({ id, state }) => id === answer.valueId && state === "active",
        );
      }
      return (
        definition.kind === "checkbox" &&
        answer.kind === "checkbox" &&
        (!definition.required || answer.checked)
      );
    }) &&
    active.every(
      (definition) =>
        !definition.required || answers.some((answer) => answer.key === definition.key),
    );
  return valid
    ? Result.ok<readonly PersonalizationAnswer[], never>(answers)
    : Result.err<never, BundleOperationFailure>({ code: "invalid_personalization" });
};
