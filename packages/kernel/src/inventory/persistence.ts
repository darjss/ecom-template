import type { InventoryAdjustmentInput, ProductId } from "@ecom/contracts";
import { and, eq, sql } from "drizzle-orm";
import { database } from "../db/database";
import { stockItems } from "../db/schema";
import { findCatalogProductById } from "../catalog-reader/persistence";

export const inventoryQueries = {
  async adjust(id: ProductId, input: InventoryAdjustmentInput) {
    const current = await findCatalogProductById(id);
    if (!current) {
      return { kind: "not_found" as const };
    }

    const resultingOnHand = sql<number>`${stockItems.onHandQuantity} + ${input.delta}`;
    const changed = await database()
      .update(stockItems)
      .set({ onHandQuantity: resultingOnHand, updatedAt: new Date() })
      .where(
        and(
          eq(stockItems.id, current.stockItemId),
          sql`${resultingOnHand} BETWEEN ${stockItems.reservedQuantity} AND 1000000`,
        ),
      )
      .returning({ onHandQuantity: stockItems.onHandQuantity });
    const adjustment = changed.at(0);
    if (adjustment) {
      return {
        kind: "changed" as const,
        product: { ...current, onHandQuantity: adjustment.onHandQuantity },
      };
    }

    const refreshed = await findCatalogProductById(id);
    if (!refreshed) {
      return { kind: "not_found" as const };
    }
    const nextOnHand = refreshed.onHandQuantity + input.delta;
    if (nextOnHand < 0 || nextOnHand > 1_000_000) {
      return { kind: "inventory_limit" as const };
    }
    if (nextOnHand < refreshed.reservedQuantity) {
      return { kind: "reservation_blocked" as const };
    }
    return { kind: "conflict" as const };
  },
};
