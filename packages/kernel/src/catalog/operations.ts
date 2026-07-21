import type {
  CreateProductInput,
  InventoryAdjustmentInput,
  Product,
  ProductId,
  UpdateProductInput,
} from "@ecom/contracts";
import { Result } from "better-result";
import { inventoryQueries } from "../inventory/persistence";
import { hasStaffCapability, type StaffActor } from "../staff/operations";
import { purgeCatalogItemCache } from "./cache";
import { catalogQueries } from "./persistence";

type CatalogOperationFailureCode =
  | "forbidden"
  | "not_found"
  | "duplicate_slug"
  | "invalid_lifecycle"
  | "invalid_publication"
  | "published_bundle_dependency"
  | "published_cms_dependency"
  | "reservation_blocked"
  | "inventory_limit"
  | "conflict"
  | "infrastructure_unavailable";
export type CatalogOperationFailure = {
  [Code in CatalogOperationFailureCode]: { readonly code: Code };
}[CatalogOperationFailureCode];

export type CatalogMutationResult = {
  readonly product: Product;
};

const authorized = (actor: StaffActor) =>
  hasStaffCapability(actor.role, "catalog_cms") &&
  hasStaffCapability(actor.role, "inventory_discounts");

const execute = async <Value>(
  actor: StaffActor,
  operation: () => Promise<Result<Value, CatalogOperationFailure>>,
) => {
  if (!authorized(actor)) {
    return Result.err<never, CatalogOperationFailure>({ code: "forbidden" });
  }
  return (await Result.tryPromise(operation))
    .mapError((): CatalogOperationFailure => ({ code: "infrastructure_unavailable" }))
    .andThen((result) => result);
};

const changedProduct = (product: Product): CatalogMutationResult => ({ product });

export const listCatalog = (actor: StaffActor) =>
  execute(actor, async () => Result.ok(await catalogQueries.listAll()));

export const listCatalogItems = (actor: StaffActor) =>
  execute(actor, async () => Result.ok(await catalogQueries.listPublishedCatalogItems()));

export const createProduct = (actor: StaffActor, input: CreateProductInput) =>
  execute(actor, async () => {
    const result = await catalogQueries.create(input);
    return result.kind === "changed"
      ? Result.ok(changedProduct(result.product))
      : Result.err<never, CatalogOperationFailure>({
          code: result.kind === "infrastructure" ? "infrastructure_unavailable" : result.kind,
        });
  });

export const updateProduct = (actor: StaffActor, id: ProductId, input: UpdateProductInput) =>
  execute(actor, async () => {
    const result = await catalogQueries.update(id, input);
    if (result.kind === "changed") {
      if (result.product.state !== "draft") {
        await purgeCatalogItemCache(result.product.id);
      }
      return Result.ok(changedProduct(result.product));
    }
    return Result.err<never, CatalogOperationFailure>({
      code: result.kind === "infrastructure" ? "infrastructure_unavailable" : result.kind,
    });
  });

export const transitionProduct = (
  actor: StaffActor,
  id: ProductId,
  transition: "publish" | "archive" | "reactivate",
) =>
  execute(actor, async () => {
    const result = await catalogQueries.transition(id, transition);
    if (result.kind === "changed") {
      await purgeCatalogItemCache(result.product.id);
      return Result.ok(changedProduct(result.product));
    }
    return Result.err<never, CatalogOperationFailure>({
      code: result.kind === "infrastructure" ? "infrastructure_unavailable" : result.kind,
    });
  });

export const adjustProductInventory = (
  actor: StaffActor,
  id: ProductId,
  input: InventoryAdjustmentInput,
) =>
  execute(actor, async () => {
    const result = await inventoryQueries.adjust(id, input);
    if (result.kind === "changed") {
      return Result.ok(changedProduct(result.product));
    }
    return Result.err<never, CatalogOperationFailure>({ code: result.kind });
  });
