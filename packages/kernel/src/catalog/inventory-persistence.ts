import {
  createInventoryEntryId,
  InventoryBlockingReservationSchema,
  type InventoryAdjustmentInput,
  type ProductId,
} from "@ecom/contracts";
import { and, asc, eq, exists, notExists, sql, sum } from "drizzle-orm";
import { canonicalize } from "json-canonicalize";
import * as v from "valibot";
import { database } from "../db/database";
import {
  idempotencyRecords,
  inventoryEntries,
  inventoryReservationItems,
  inventoryReservations,
  stockItems,
} from "../db/schema";
import type { StaffActor } from "../staff/operations";
import { recordRejectedAttempt } from "./audit";
import { findCatalogProductById } from "./product-projection";

const idempotencyScope = "inventory.adjust";

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
  const rows = await database()
    .select({
      requestHash: idempotencyRecords.requestHash,
      resultId: idempotencyRecords.resultId,
    })
    .from(idempotencyRecords)
    .where(and(eq(idempotencyRecords.scope, idempotencyScope), eq(idempotencyRecords.key, key)))
    .limit(1);
  return rows.at(0);
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
    const unusedIdempotencyKey = notExists(
      db
        .select({ scope: idempotencyRecords.scope })
        .from(idempotencyRecords)
        .where(
          and(
            eq(idempotencyRecords.scope, idempotencyScope),
            eq(idempotencyRecords.key, input.idempotencyKey),
          ),
        ),
    );
    const safeAdjustment = and(
      eq(stockItems.id, current.stockItemId),
      sql`${stockItems.reservedQuantity} = ${activeReservedQuantity}`,
      sql`${resultingOnHand} >= ${stockItems.reservedQuantity}`,
      sql`${resultingOnHand} <= 1000000`,
      unusedIdempotencyKey,
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
            eq(stockItems.id, current.stockItemId),
            sql`${stockItems.reservedQuantity} = ${activeReservedQuantity}`,
            sql`${resultingOnHand} >= ${stockItems.reservedQuantity}`,
            sql`${resultingOnHand} <= 1000000`,
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
      db
        .insert(idempotencyRecords)
        .select(
          db
            .select({
              scope: sql<string>`${idempotencyScope}`.as("scope"),
              key: sql<string>`${input.idempotencyKey}`.as("key"),
              requestHash: sql<string>`${hash}`.as("request_hash"),
              resultKind: sql<string>`'inventory_adjustment'`.as("result_kind"),
              resultId: sql<string>`${entryId}`.as("result_id"),
              createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
            })
            .from(inventoryEntries)
            .where(eq(inventoryEntries.id, entryId)),
        )
        .onConflictDoNothing(),
    ] as const);

    if (results[0].meta.changes === 1 && results[1].length === 1 && results[2].meta.changes === 1) {
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
    const activeReservedQuantityValue = blockers.reduce(
      (quantity, blocker) => quantity + blocker.quantity,
      0,
    );
    if (activeReservedQuantityValue !== refreshed.reservedQuantity) {
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
    const rows = await database()
      .select({
        reservationId: inventoryReservations.id,
        orderReference: inventoryReservations.orderReference,
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
