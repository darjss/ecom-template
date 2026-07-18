import type {
  CreateProductInput,
  InventoryAdjustmentInput,
  Product,
  ProductId,
  UpdateProductInput,
} from "@ecom/contracts";
import { Result } from "better-result";
import { hasStaffCapability, type StaffActor } from "../staff/operations";
import { resolvePendingCatalogCachePurge } from "./cache";
import { inventoryQueries } from "../inventory/persistence";
import { catalogQueries } from "./persistence";

export type CatalogOperationFailure = {
  readonly code:
    | "forbidden"
    | "not_found"
    | "duplicate_slug"
    | "invalid_lifecycle"
    | "invalid_publication"
    | "published_bundle_dependency"
    | "published_cms_dependency"
    | "reservation_blocked"
    | "inventory_inconsistent"
    | "inventory_limit"
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
  readonly cachePurgeRequestId: string | null;
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
  try {
    return await operation();
  } catch {
    return Result.err<never, CatalogOperationFailure>({ code: "infrastructure_unavailable" });
  }
};

const unchangedCache = (product: Product): CatalogMutationResult => ({
  product,
  cache: "not_required",
  cachePurgeRequestId: null,
});

export const listCatalog = (actor: StaffActor) =>
  execute(actor, async () => Result.ok(await catalogQueries.listAll()));

export const createProduct = (actor: StaffActor, input: CreateProductInput) =>
  execute(actor, async () => {
    const result = await catalogQueries.create(actor, input);
    return result.kind === "changed"
      ? Result.ok(unchangedCache(result.product))
      : Result.err<never, CatalogOperationFailure>({
          code: result.kind === "infrastructure" ? "infrastructure_unavailable" : result.kind,
        });
  });

export const updateProduct = (actor: StaffActor, id: ProductId, input: UpdateProductInput) =>
  execute(actor, async () => {
    const result = await catalogQueries.update(actor, id, input);
    return result.kind === "changed"
      ? Result.ok(await resolvePendingCatalogCachePurge(result.product))
      : Result.err<never, CatalogOperationFailure>({
          code: result.kind === "infrastructure" ? "infrastructure_unavailable" : result.kind,
        });
  });

export const transitionProduct = (
  actor: StaffActor,
  id: ProductId,
  transition: "publish" | "archive" | "reactivate",
) =>
  execute(actor, async () => {
    const result = await catalogQueries.transition(actor, id, transition);
    return result.kind === "changed"
      ? Result.ok(await resolvePendingCatalogCachePurge(result.product))
      : Result.err<never, CatalogOperationFailure>({
          code: result.kind === "infrastructure" ? "infrastructure_unavailable" : result.kind,
        });
  });

export const retryProductCachePurge = (actor: StaffActor, id: ProductId) =>
  execute(actor, async () => {
    const product = await catalogQueries.findById(id);
    return product
      ? Result.ok(await resolvePendingCatalogCachePurge(product))
      : Result.err<never, CatalogOperationFailure>({ code: "not_found" });
  });

export const adjustProductInventory = (
  actor: StaffActor,
  id: ProductId,
  input: InventoryAdjustmentInput,
) =>
  execute(actor, async () => {
    const result = await inventoryQueries.adjust(actor, id, input);
    if (result.kind === "changed") {
      return Result.ok(unchangedCache(result.product));
    }
    return Result.err<never, CatalogOperationFailure>(
      result.kind === "reservation_blocked" || result.kind === "inventory_inconsistent"
        ? { code: result.kind, blockers: result.blockers }
        : { code: result.kind },
    );
  });
