import {
  createInventoryEntryId,
  InventoryBlockingReservationSchema,
  type InventoryAdjustmentInput,
  type ProductId,
} from "@ecom/contracts";
import { env } from "cloudflare:workers";
import { canonicalize } from "json-canonicalize";
import * as v from "valibot";
import type { StaffActor } from "../staff/operations";
import { catalogActorBindings, recordRejectedAttempt } from "./audit";
import { catalogTableNames } from "./persistence";
import { findCatalogProductById } from "./product-projection";

const idempotencyScope = "inventory.adjust";
const ReturnedIdempotencySchema = v.object({
  requestHash: v.string(),
  resultId: v.string(),
});

const activeReservationSum = (stockItemAlias: string) =>
  `COALESCE((SELECT SUM(iri.quantity) FROM ${catalogTableNames.inventoryReservationItems} iri JOIN ${catalogTableNames.inventoryReservations} ir ON ir.id = iri.reservation_id WHERE iri.stock_item_id = ${stockItemAlias}.id AND ir.state = 'active'), 0)`;

const requestHash = async (
  actor: StaffActor,
  productId: ProductId,
  input: InventoryAdjustmentInput,
) => {
  const bytes = new TextEncoder().encode(
    canonicalize({
      actorStaffId: actor.staffId,
      delta: input.delta,
      productId,
      reason: input.reason,
    }),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const readIdempotency = async (key: string) => {
  const result = await env.DB.prepare(
    `SELECT request_hash AS requestHash, result_id AS resultId FROM ${catalogTableNames.idempotencyRecords} WHERE scope = ? AND key = ? LIMIT 1`,
  )
    .bind(idempotencyScope, key)
    .all();
  const row = result.results.at(0);
  return row ? v.parse(ReturnedIdempotencySchema, row) : undefined;
};

export const inventoryQueries = {
  async adjust(actor: StaffActor, id: ProductId, input: InventoryAdjustmentInput) {
    const hash = await requestHash(actor, id, input);
    const replay = await readIdempotency(input.idempotencyKey);
    if (replay) {
      return replay.requestHash === hash
        ? { kind: "changed" as const, product: await findCatalogProductById(id) }
        : { kind: "idempotency_conflict" as const };
    }
    const current = await findCatalogProductById(id);
    if (!current) {
      return { kind: "not_found" as const };
    }
    const entryId = createInventoryEntryId();
    const correlationId = crypto.randomUUID();
    const now = Date.now();
    const reservationSum = activeReservationSum("si");
    const results = await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO ${catalogTableNames.inventoryEntries} (id, stock_item_id, kind, on_hand_delta, actor_kind, staff_id, staff_role, reason, command_correlation_id, created_at) SELECT ?, si.id, 'adjustment', ?, 'staff', ?, ?, ?, ?, ? FROM ${catalogTableNames.stockItems} si WHERE si.id = ? AND si.reserved_quantity = ${reservationSum} AND si.on_hand_quantity + ? >= si.reserved_quantity AND si.on_hand_quantity + ? <= 1000000 AND NOT EXISTS (SELECT 1 FROM ${catalogTableNames.idempotencyRecords} WHERE scope = ? AND key = ?)`,
      ).bind(
        entryId,
        input.delta,
        ...catalogActorBindings(actor),
        input.reason,
        correlationId,
        now,
        current.stockItemId,
        input.delta,
        input.delta,
        idempotencyScope,
        input.idempotencyKey,
      ),
      env.DB.prepare(
        `UPDATE ${catalogTableNames.stockItems} SET on_hand_quantity = on_hand_quantity + ?, updated_at = ? WHERE id = ? AND reserved_quantity = ${activeReservationSum(catalogTableNames.stockItems)} AND on_hand_quantity + ? >= reserved_quantity AND on_hand_quantity + ? <= 1000000 AND EXISTS (SELECT 1 FROM ${catalogTableNames.inventoryEntries} WHERE id = ? AND stock_item_id = ?) RETURNING on_hand_quantity`,
      ).bind(
        input.delta,
        now,
        current.stockItemId,
        input.delta,
        input.delta,
        entryId,
        current.stockItemId,
      ),
      env.DB.prepare(
        `INSERT INTO ${catalogTableNames.idempotencyRecords} (scope, key, request_hash, result_kind, result_id, created_at) SELECT ?, ?, ?, 'inventory_adjustment', ?, ? FROM ${catalogTableNames.inventoryEntries} WHERE id = ? ON CONFLICT(scope, key) DO NOTHING RETURNING key`,
      ).bind(idempotencyScope, input.idempotencyKey, hash, entryId, now, entryId),
    ]);
    if (
      results.at(0)?.meta.changes === 1 &&
      results.at(1)?.results.length === 1 &&
      results.at(2)?.results.length === 1
    ) {
      return { kind: "changed" as const, product: await findCatalogProductById(id) };
    }
    const committed = await readIdempotency(input.idempotencyKey);
    if (committed) {
      return committed.requestHash === hash
        ? { kind: "changed" as const, product: await findCatalogProductById(id) }
        : { kind: "idempotency_conflict" as const };
    }
    const refreshed = await findCatalogProductById(id);
    if (!refreshed) {
      return { kind: "not_found" as const };
    }
    const blockers = await this.blockers(refreshed.stockItemId);
    const activeReservedQuantity = blockers.reduce((sum, blocker) => sum + blocker.quantity, 0);
    if (activeReservedQuantity !== refreshed.reservedQuantity) {
      await recordRejectedAttempt(
        actor,
        "inventory.adjust",
        "stock_item",
        refreshed.stockItemId,
        "inventory_inconsistent",
      );
      return { kind: "inventory_inconsistent" as const, blockers };
    }
    if (refreshed.onHandQuantity + input.delta > 1_000_000) {
      await recordRejectedAttempt(
        actor,
        "inventory.adjust",
        "stock_item",
        refreshed.stockItemId,
        "inventory_limit",
      );
      return { kind: "inventory_limit" as const };
    }
    if (refreshed.onHandQuantity + input.delta < refreshed.reservedQuantity) {
      await recordRejectedAttempt(
        actor,
        "inventory.adjust",
        "stock_item",
        refreshed.stockItemId,
        "reservation_blocked",
      );
      return { kind: "reservation_blocked" as const, blockers };
    }
    return { kind: "conflict" as const };
  },

  async blockers(stockItemId: string) {
    const result = await env.DB.prepare(
      `SELECT ir.id AS reservationId, ir.order_reference AS orderReference, iri.quantity FROM ${catalogTableNames.inventoryReservations} ir JOIN ${catalogTableNames.inventoryReservationItems} iri ON iri.reservation_id = ir.id WHERE iri.stock_item_id = ? AND ir.state = 'active' ORDER BY ir.created_at`,
    )
      .bind(stockItemId)
      .all();
    return result.results.map((row) => v.parse(InventoryBlockingReservationSchema, row));
  },
};
