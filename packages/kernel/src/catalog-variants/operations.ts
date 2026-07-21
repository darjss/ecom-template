import type {
  ProductId,
  SaveProductOptionsInput,
  UpdateVariantPresentationInput,
  VariantId,
} from "@ecom/contracts";
import { Result } from "better-result";
import { findCatalogProductById } from "../catalog-reader/persistence";
import { purgeCatalogItemCache } from "../catalog/cache";
import { hasStaffCapability, type StaffActor } from "../staff/operations";
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

const changedProduct = async (productId: ProductId, purge: boolean) => {
  const product = await findCatalogProductById(productId);
  if (!product) {
    return Result.err<never, CatalogVariantFailure>({ code: "infrastructure_unavailable" });
  }
  if (purge && product.state !== "draft") {
    await purgeCatalogItemCache(productId);
  }
  return Result.ok({ product });
};

export const saveProductOptions = async (
  _actor: StaffActor,
  productId: ProductId,
  input: SaveProductOptionsInput,
) => {
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
  _actor: StaffActor,
  productId: ProductId,
  variantId: VariantId,
  input: UpdateVariantPresentationInput,
) => {
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
  _actor: StaffActor,
  productId: ProductId,
  variantId: VariantId,
  state: "active" | "archived",
) => {
  try {
    const result = await catalogVariantQueries.transition(productId, variantId, state);
    return result.kind === "changed"
      ? changedProduct(productId, true)
      : Result.err<never, CatalogVariantFailure>({ code: result.kind });
  } catch {
    return Result.err<never, CatalogVariantFailure>({ code: "infrastructure_unavailable" });
  }
};
