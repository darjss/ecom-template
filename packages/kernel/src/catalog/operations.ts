import type {
  CreateProductInput,
  InventoryAdjustmentInput,
  Product,
  ProductId,
  UpdateProductInput,
} from "@ecom/contracts";
import { Result } from "better-result";
import { hasStaffCapability, type StaffActor } from "../staff/operations";
import { purgeCatalogCache } from "./cache";
import { inventoryQueries } from "./inventory-persistence";
import { catalogQueries } from "./persistence";

export type CatalogOperationFailure = {
  readonly code:
    | "forbidden"
    | "not_found"
    | "duplicate_slug"
    | "duplicate_sku"
    | "invalid_lifecycle"
    | "invalid_publication"
    | "sku_locked"
    | "reservation_blocked"
    | "inventory_inconsistent"
    | "idempotency_conflict"
    | "conflict"
    | "infrastructure_unavailable";
  readonly blockers?: readonly {
    readonly reservationId: string;
    readonly orderReference: string;
    readonly quantity: number;
  }[];
};

export type CatalogMutationResult = {
  readonly product: Product;
  readonly cache: "not_required" | "purged" | "committed_but_not_purged";
};

const authorize = (actor: StaffActor) =>
  hasStaffCapability(actor.role, "catalog_cms") &&
  hasStaffCapability(actor.role, "inventory_discounts");

const purgeIfPublic = async (product: Product): Promise<CatalogMutationResult> => {
  if (product.state === "draft") {
    return { product, cache: "not_required" };
  }
  const purge = await purgeCatalogCache(product.id);
  return {
    product,
    cache: purge.kind === "purged" ? "purged" : "committed_but_not_purged",
  };
};

export const listCatalog = async (actor: StaffActor) => {
  if (!authorize(actor)) {
    return Result.err<never, CatalogOperationFailure>({ code: "forbidden" });
  }
  try {
    return Result.ok(await catalogQueries.listAll());
  } catch {
    return Result.err<never, CatalogOperationFailure>({ code: "infrastructure_unavailable" });
  }
};

export const createProduct = async (actor: StaffActor, input: CreateProductInput) => {
  if (!authorize(actor)) {
    return Result.err<never, CatalogOperationFailure>({ code: "forbidden" });
  }
  try {
    const result = await catalogQueries.create(actor, input);
    if (!result.product) {
      return Result.err<never, CatalogOperationFailure>({
        code: result.conflict ?? "infrastructure_unavailable",
      });
    }
    return Result.ok<CatalogMutationResult, never>({
      product: result.product,
      cache: "not_required",
    });
  } catch {
    return Result.err<never, CatalogOperationFailure>({ code: "infrastructure_unavailable" });
  }
};

export const updateProduct = async (
  actor: StaffActor,
  id: ProductId,
  input: UpdateProductInput,
) => {
  if (!authorize(actor)) {
    return Result.err<never, CatalogOperationFailure>({ code: "forbidden" });
  }
  try {
    const result = await catalogQueries.update(actor, id, input);
    if (result.kind === "changed" && result.product) {
      return Result.ok(await purgeIfPublic(result.product));
    }
    if (
      result.kind === "not_found" ||
      result.kind === "duplicate_slug" ||
      result.kind === "duplicate_sku" ||
      result.kind === "sku_locked"
    ) {
      return Result.err<never, CatalogOperationFailure>({ code: result.kind });
    }
    return Result.err<never, CatalogOperationFailure>({ code: "infrastructure_unavailable" });
  } catch {
    return Result.err<never, CatalogOperationFailure>({ code: "infrastructure_unavailable" });
  }
};

export const transitionProduct = async (
  actor: StaffActor,
  id: ProductId,
  transition: "publish" | "archive" | "reactivate",
) => {
  if (!authorize(actor)) {
    return Result.err<never, CatalogOperationFailure>({ code: "forbidden" });
  }
  try {
    const result = await catalogQueries.transition(actor, id, transition);
    if (result.kind === "changed" && result.product) {
      return Result.ok(await purgeIfPublic(result.product));
    }
    return Result.err<never, CatalogOperationFailure>({
      code:
        result.kind === "not_found" ||
        result.kind === "invalid_lifecycle" ||
        result.kind === "invalid_publication"
          ? result.kind
          : "infrastructure_unavailable",
    });
  } catch {
    return Result.err<never, CatalogOperationFailure>({ code: "infrastructure_unavailable" });
  }
};

export const adjustProductInventory = async (
  actor: StaffActor,
  id: ProductId,
  input: InventoryAdjustmentInput,
) => {
  if (!authorize(actor)) {
    return Result.err<never, CatalogOperationFailure>({ code: "forbidden" });
  }
  try {
    const result = await inventoryQueries.adjust(actor, id, input);
    if (result.kind === "changed" && result.product) {
      return Result.ok<CatalogMutationResult, never>({
        product: result.product,
        cache: "not_required",
      });
    }
    if (result.kind === "reservation_blocked" || result.kind === "inventory_inconsistent") {
      return Result.err<never, CatalogOperationFailure>({
        code: result.kind,
        blockers: result.blockers,
      });
    }
    return Result.err<never, CatalogOperationFailure>({
      code:
        result.kind === "not_found" ||
        result.kind === "conflict" ||
        result.kind === "idempotency_conflict"
          ? result.kind
          : "conflict",
    });
  } catch {
    return Result.err<never, CatalogOperationFailure>({ code: "infrastructure_unavailable" });
  }
};
