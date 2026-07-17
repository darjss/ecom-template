import type {
  Product,
  ProductId,
  SaveProductOptionsInput,
  UpdateVariantPresentationInput,
  VariantId,
} from "@ecom/contracts";
import { Result } from "better-result";
import { hasStaffCapability, type StaffActor } from "../staff/operations";
import { findCatalogProductById } from "../catalog-reader/persistence";
import { catalogVariantQueries } from "./persistence";

export type CatalogVariantFailure = {
  readonly code:
    | "forbidden"
    | "not_found"
    | "immutable_configuration"
    | "duplicate_combination"
    | "invalid_combination"
    | "invalid_publication"
    | "media_not_owned"
    | "infrastructure_unavailable";
};

const authorized = (actor: StaffActor) =>
  hasStaffCapability(actor.role, "catalog_cms") &&
  hasStaffCapability(actor.role, "inventory_discounts");

const changedProduct = async (productId: ProductId) => {
  const product = await findCatalogProductById(productId);
  return product
    ? Result.ok<Product, never>(product)
    : Result.err<never, CatalogVariantFailure>({ code: "infrastructure_unavailable" });
};

export const saveProductOptions = async (
  actor: StaffActor,
  productId: ProductId,
  input: SaveProductOptionsInput,
) => {
  if (!authorized(actor)) return Result.err<never, CatalogVariantFailure>({ code: "forbidden" });
  try {
    const result = await catalogVariantQueries.saveConfiguration(productId, input);
    return result.kind === "changed"
      ? changedProduct(productId)
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
  if (!authorized(actor)) return Result.err<never, CatalogVariantFailure>({ code: "forbidden" });
  try {
    const result = await catalogVariantQueries.updatePresentation(productId, variantId, input);
    return result.kind === "changed"
      ? changedProduct(productId)
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
  if (!authorized(actor)) return Result.err<never, CatalogVariantFailure>({ code: "forbidden" });
  try {
    if (state === "archived") {
      const product = await findCatalogProductById(productId);
      if (!product) return Result.err<never, CatalogVariantFailure>({ code: "not_found" });
      if (
        product.state !== "draft" &&
        product.optionConfiguration.variants.filter(
          (variant) => variant.state === "active" && !variant.isDefault,
        ).length <= 1
      ) {
        return Result.err<never, CatalogVariantFailure>({ code: "invalid_publication" });
      }
    }
    const result = await catalogVariantQueries.transition(productId, variantId, state);
    return result.kind === "changed"
      ? changedProduct(productId)
      : Result.err<never, CatalogVariantFailure>({ code: result.kind });
  } catch {
    return Result.err<never, CatalogVariantFailure>({ code: "infrastructure_unavailable" });
  }
};
