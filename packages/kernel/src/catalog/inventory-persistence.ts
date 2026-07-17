import {
  createInventoryEntryId,
  InventoryBlockingReservationSchema,
  type InventoryAdjustmentInput,
  type ProductId,
} from "@ecom/contracts";
import { env } from "cloudflare:workers";
import * as v from "valibot";
import type { StaffActor } from "../staff/operations";
import { catalogActorBindings, recordRejectedAttempt } from "./audit";
import { catalogTableNames } from "./persistence";
import { findCatalogProductById } from "./product-projection";

const activeReservationSum = (stockItemAlias: string) =>
  `COALESCE((SELECT SUM(iri.quantity) FROM ${catalogTableNames.inventoryReservationItems} iri JOIN ${catalogTableNames.inventoryReservations} ir ON ir.id = iri.reservation_id WHERE iri.stock_item_id = ${stockItemAlias}.id AND ir.state = 'active'), 0)`;

export const inventoryQueries = {
  async adjust(actor: StaffActor, id: ProductId, input: InventoryAdjustmentInput) {
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
        `INSERT INTO ${catalogTableNames.inventoryEntries} (id, stock_item_id, kind, on_hand_delta, resulting_on_hand_quantity, resulting_reserved_quantity, actor_kind, staff_id, staff_role, reason, command_correlation_id, created_at) SELECT ?, si.id, 'adjustment', ?, si.on_hand_quantity + ?, ${reservationSum}, 'staff', ?, ?, ?, ?, ? FROM ${catalogTableNames.stockItems} si WHERE si.id = ? AND si.on_hand_quantity + ? >= 0 AND si.on_hand_quantity + ? >= ${reservationSum}`,
      ).bind(
        entryId,
        input.delta,
        input.delta,
        ...catalogActorBindings(actor),
        input.reason,
        correlationId,
        now,
        current.stockItemId,
        input.delta,
        input.delta,
      ),
      env.DB.prepare(
        `UPDATE ${catalogTableNames.stockItems} AS si SET on_hand_quantity = on_hand_quantity + ?, updated_at = ? WHERE id = ? AND on_hand_quantity + ? >= 0 AND on_hand_quantity + ? >= ${reservationSum} RETURNING on_hand_quantity`,
      ).bind(input.delta, now, current.stockItemId, input.delta, input.delta),
    ]);
    if (results.at(0)?.meta.changes === 1 && results.at(1)?.results.length === 1) {
      return { kind: "changed" as const, product: await findCatalogProductById(id) };
    }
    const refreshed = await findCatalogProductById(id);
    if (
      refreshed &&
      refreshed.onHandQuantity + input.delta >= 0 &&
      refreshed.onHandQuantity + input.delta < refreshed.reservedQuantity
    ) {
      const blockers = await this.blockers(refreshed.stockItemId);
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
