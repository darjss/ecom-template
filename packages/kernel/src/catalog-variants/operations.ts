import type {
  ProductId,
  SaveProductOptionsInput,
  UpdateVariantPresentationInput,
  VariantId,
} from "@ecom/contracts";
import { Result } from "better-result";
import { hasStaffCapability, type StaffActor } from "../staff/operations";
import { findCatalogProductById } from "../catalog-reader/persistence";
import { resolveCatalogCachePurge } from "../catalog/cache";
import { catalogVariantQueries } from "./persistence";

type CatalogVariantFailureCode =
  | "forbidden"
  | "not_found"
  | "immutable_configuration"
  | "duplicate_combination"
  | "invalid_combination"
  | "invalid_publication"
  | "media_not_owned"
  | "published_bundle_dependency"
  | "infrastructure_unavailable";
export type CatalogVariantFailure = {
  [Code in CatalogVariantFailureCode]: { readonly code: Code };
}[CatalogVariantFailureCode];

const authorized = (actor: StaffActor) =>
  hasStaffCapability(actor.role, "catalog_cms") &&
  hasStaffCapability(actor.role, "inventory_discounts");

const changedProduct = async (productId: ProductId, purge: boolean) => {
  const product = await findCatalogProductById(productId);
  return product
    ? Result.ok(
        purge
          ? await resolveCatalogCachePurge(product)
          : { product, cache: "not_required" as const, cachePurgeRequestId: null },
      )
    : Result.err<never, CatalogVariantFailure>({ code: "infrastructure_unavailable" });
};

export const saveProductOptions = async (
  actor: StaffActor,
  productId: ProductId,
  input: SaveProductOptionsInput,
) => {
  if (!authorized(actor)) {
    return Result.err<never, CatalogVariantFailure>({ code: "forbidden" });
  }
  try {
    const result = await catalogVariantQueries.saveConfiguration(productId, input);
    return result.kind === "changed"
      ? changedProduct(productId, result.purge)
      : Result.err<never, CatalogVariantFailure>({ code: result.kind });
  } catch {
    return Result.err<never, CatalogVariantFailure>({ code: "infrastructure_unavailable" });
  }
};

export const updateVariantPresentation = async (
  actor: StaffActor,
  productId: ProductId,
  variantId: VariantId,
  input: UpdateVariantPresentationInput,
) => {
  if (!authorized(actor)) {
    return Result.err<never, CatalogVariantFailure>({ code: "forbidden" });
  }
  try {
    const result = await catalogVariantQueries.updatePresentation(productId, variantId, input);
    return result.kind === "changed"
      ? changedProduct(productId, true)
      : Result.err<never, CatalogVariantFailure>({ code: result.kind });
  } catch {
    return Result.err<never, CatalogVariantFailure>({ code: "infrastructure_unavailable" });
  }
};

export const setVariantState = async (
  actor: StaffActor,
  productId: ProductId,
  variantId: VariantId,
  state: "active" | "archived",
) => {
  if (!authorized(actor)) {
    return Result.err<never, CatalogVariantFailure>({ code: "forbidden" });
  }
  try {
    const result = await catalogVariantQueries.transition(productId, variantId, state);
    return result.kind === "changed"
      ? changedProduct(productId, true)
      : Result.err<never, CatalogVariantFailure>({ code: result.kind });
  } catch {
    return Result.err<never, CatalogVariantFailure>({ code: "infrastructure_unavailable" });
  }
};
