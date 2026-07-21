import {
  createInventoryEntryId,
  InventoryBlockingReservationSchema,
  type InventoryAdjustmentInput,
  type ProductId,
} from "@ecom/contracts";
import { and, asc, eq, exists, sql, sum } from "drizzle-orm";
import * as v from "valibot";
import { database } from "../db/database";
import {
  inventoryEntries,
  inventoryReservationItems,
  inventoryReservations,
  stockItems,
} from "../db/schema";
import type { StaffActor } from "../staff/operations";
import { findCatalogProductById } from "../catalog-reader/persistence";

export const inventoryQueries = {
  async adjust(actor: StaffActor, id: ProductId, input: InventoryAdjustmentInput) {
    const current = await findCatalogProductById(id);
    if (!current) {
      return { kind: "not_found" as const };
    }

    const db = database();
    const entryId = createInventoryEntryId();
    const correlationId = crypto.randomUUID();
    const now = new Date();
    const activeReservationTotal = db
      .select({ quantity: sum(inventoryReservationItems.quantity) })
      .from(inventoryReservationItems)
      .innerJoin(
        inventoryReservations,
        eq(inventoryReservations.id, inventoryReservationItems.reservationId),
      )
      .where(
        and(
          eq(inventoryReservationItems.stockItemId, stockItems.id),
          eq(inventoryReservations.state, "active"),
        ),
      );
    const activeReservedQuantity = sql<number>`coalesce((${activeReservationTotal}), 0)`;
    const resultingOnHand = sql<number>`${stockItems.onHandQuantity} + ${input.delta}`;
    const safeAdjustment = and(
      eq(stockItems.id, current.stockItemId),
      sql`${stockItems.reservedQuantity} = ${activeReservedQuantity}`,
      sql`${resultingOnHand} >= ${stockItems.reservedQuantity}`,
      sql`${resultingOnHand} <= 1000000`,
    );

    const results = await db.batch([
      db.insert(inventoryEntries).select(
        db
          .select({
            id: sql<string>`${entryId}`.as("id"),
            stockItemId: stockItems.id,
            kind: sql<"adjustment">`'adjustment'`.as("kind"),
            onHandDelta: sql<number>`${input.delta}`.as("on_hand_delta"),
            actorKind: sql<"staff">`'staff'`.as("actor_kind"),
            staffId: sql<string>`${actor.staffId}`.as("staff_id"),
            staffRole: sql<typeof actor.role>`${actor.role}`.as("staff_role"),
            reason: sql<string>`${input.reason}`.as("reason"),
            commandCorrelationId: sql<string>`${correlationId}`.as("command_correlation_id"),
            createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
          })
          .from(stockItems)
          .where(safeAdjustment),
      ),
      db
        .update(stockItems)
        .set({ onHandQuantity: resultingOnHand, updatedAt: now })
        .where(
          and(
            safeAdjustment,
            exists(
              db
                .select({ id: inventoryEntries.id })
                .from(inventoryEntries)
                .where(
                  and(
                    eq(inventoryEntries.id, entryId),
                    eq(inventoryEntries.stockItemId, current.stockItemId),
                  ),
                ),
            ),
          ),
        )
        .returning({ onHandQuantity: stockItems.onHandQuantity }),
    ] as const);

    const changed = results[1].at(0);
    if (changed) {
      return {
        kind: "changed" as const,
        product: { ...current, onHandQuantity: changed.onHandQuantity },
      };
    }

    const refreshed = await findCatalogProductById(id);
    if (!refreshed) {
      return { kind: "not_found" as const };
    }
    const blockers = await this.blockers(refreshed.stockItemId);
    const activeReservedQuantityValue = blockers.reduce(
      (quantity, blocker) => quantity + blocker.quantity,
      0,
    );
    if (activeReservedQuantityValue !== refreshed.reservedQuantity) {
      return { kind: "inventory_inconsistent" as const, blockers };
    }
    if (
      refreshed.onHandQuantity + input.delta < 0 ||
      refreshed.onHandQuantity + input.delta > 1_000_000
    ) {
      return { kind: "inventory_limit" as const };
    }
    if (refreshed.onHandQuantity + input.delta < refreshed.reservedQuantity) {
      return { kind: "reservation_blocked" as const, blockers };
    }
    return { kind: "conflict" as const };
  },

  async blockers(stockItemId: string) {
    const rows = await database()
      .select({
        reservationId: inventoryReservations.id,
        orderReference: inventoryReservations.orderId,
        quantity: inventoryReservationItems.quantity,
      })
      .from(inventoryReservations)
      .innerJoin(
        inventoryReservationItems,
        eq(inventoryReservationItems.reservationId, inventoryReservations.id),
      )
      .where(
        and(
          eq(inventoryReservationItems.stockItemId, stockItemId),
          eq(inventoryReservations.state, "active"),
        ),
      )
      .orderBy(asc(inventoryReservations.createdAt));
    return rows.map((row) => v.parse(InventoryBlockingReservationSchema, row));
  },
};
