import {
  AvailabilityResponseSchema,
  type AvailabilityFact,
  type AvailabilityRequest,
  type AvailabilityResponse,
} from "@ecom/contracts";
import { Result } from "better-result";
import * as v from "valibot";
import { availabilityQueries } from "./persistence";

export type AvailabilityFailure = { readonly code: "infrastructure_unavailable" };

export const readAvailability = async (
  input: AvailabilityRequest,
): Promise<Result<AvailabilityResponse, AvailabilityFailure>> => {
  try {
    const variantTargets = input.targets.filter(
      (target): target is Extract<(typeof input.targets)[number], { kind: "variant" }> =>
        target.kind === "variant",
    );
    const bundleTargets = input.targets.filter(
      (target): target is Extract<(typeof input.targets)[number], { kind: "bundle" }> =>
        target.kind === "bundle",
    );
    const [variantRows, bundleRows] = await Promise.all([
      availabilityQueries.readVariants(variantTargets.map(({ id }) => id)),
      availabilityQueries.readBundles(bundleTargets.map(({ id }) => id)),
    ]);
    const variantById = new Map(variantRows.map((row) => [row.id, row]));
    const bundleById = new Map(bundleRows.bundles.map((row) => [row.id, row]));
    const componentsByBundle = Map.groupBy(bundleRows.components, ({ bundleId }) => bundleId);
    const facts: AvailabilityFact[] = [];
    for (const target of input.targets) {
      if (target.kind === "variant") {
        const row = variantById.get(target.id);
        if (!row || row.productKind !== "product" || row.productState !== "published") continue;
        facts.push({
          kind: "variant",
          id: target.id,
          unitPriceMnt: row.priceOverrideMnt ?? row.productPriceMnt,
          sellable:
            row.variantState === "active" &&
            row.onHandQuantity - row.reservedQuantity >= target.quantity,
        });
        continue;
      }
      const bundle = bundleById.get(target.id);
      const components = componentsByBundle.get(target.id) ?? [];
      if (
        !bundle ||
        bundle.kind !== "bundle" ||
        bundle.state !== "published" ||
        components.length === 0
      ) {
        continue;
      }
      const demandByVariant = new Map<string, number>();
      for (const component of components) {
        demandByVariant.set(
          component.variantId,
          (demandByVariant.get(component.variantId) ?? 0) + component.quantity * target.quantity,
        );
      }
      facts.push({
        kind: "bundle",
        id: target.id,
        unitPriceMnt: bundle.priceMnt,
        sellable: components.every(
          (component) =>
            component.variantState === "active" &&
            component.productKind === "product" &&
            component.productState === "published" &&
            component.onHandQuantity - component.reservedQuantity >=
              (demandByVariant.get(component.variantId) ?? 0),
        ),
      });
    }
    return Result.ok(
      v.parse(AvailabilityResponseSchema, {
        data: { checkedAt: new Date().toISOString(), facts },
      }),
    );
  } catch {
    return Result.err<never, AvailabilityFailure>({ code: "infrastructure_unavailable" });
  }
};
