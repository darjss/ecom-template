import {
  CheckoutBundleComponentSnapshotSchema,
  CheckoutOptionSnapshotSchema,
  CheckoutPersonalizationSchema,
  GuestTrackingOrderSchema,
  type GuestTrackingOrder,
} from "@ecom/contracts";
import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import * as v from "valibot";
import { database } from "../db/database";
import { fulfillments, guestTrackingLinks, orderLines, orders, payments } from "../db/schema";

const terminalLifetimeMs = 30 * 24 * 60 * 60 * 1_000;
const effectiveExpiry = (capabilityExpiry: Date, terminalAt: Date | null) =>
  new Date(
    Math.min(
      capabilityExpiry.getTime(),
      terminalAt === null ? Number.POSITIVE_INFINITY : terminalAt.getTime() + terminalLifetimeMs,
    ),
  );

export const guestTrackingQueries = {
  async read(
    orderId: string,
    tokenHash: string,
    now: Date,
  ): Promise<GuestTrackingOrder | undefined> {
    const db = database();
    const capabilityRows = await db
      .select({
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        state: orders.state,
        placedAt: orders.placedAt,
        terminalAt: orders.terminalAt,
        totalMnt: orders.grandTotalMnt,
        capabilityExpiry: guestTrackingLinks.expiresAt,
      })
      .from(guestTrackingLinks)
      .innerJoin(orders, eq(orders.id, guestTrackingLinks.orderId))
      .where(
        and(
          eq(guestTrackingLinks.orderId, orderId),
          eq(guestTrackingLinks.tokenHash, tokenHash),
          isNull(guestTrackingLinks.revokedAt),
          gt(guestTrackingLinks.expiresAt, now),
        ),
      )
      .limit(1);
    const capability = capabilityRows.at(0);
    if (!capability) {
      return undefined;
    }
    const expiresAt = effectiveExpiry(capability.capabilityExpiry, capability.terminalAt);
    if (expiresAt.getTime() <= now.getTime()) {
      return undefined;
    }
    const [lineRows, paymentRows, fulfillmentRows] = await db.batch([
      db
        .select({
          position: orderLines.position,
          name: orderLines.itemName,
          sku: orderLines.sku,
          quantity: orderLines.quantity,
          unitPriceMnt: orderLines.unitPriceMnt,
          totalMnt: orderLines.totalMnt,
          optionsJson: orderLines.optionsJson,
          personalizationsJson: orderLines.personalizationsJson,
          bundleComponentsJson: orderLines.bundleComponentsJson,
        })
        .from(orderLines)
        .where(eq(orderLines.orderId, orderId))
        .orderBy(asc(orderLines.position)),
      db
        .select({
          id: payments.id,
          method: payments.method,
          state: payments.state,
          expectedAmountMnt: payments.expectedAmountMnt,
          confirmedAmountMnt: payments.confirmedAmountMnt,
          refundedAmountMnt: payments.refundedAmountMnt,
          updatedAt: payments.updatedAt,
        })
        .from(payments)
        .where(eq(payments.orderId, orderId))
        .orderBy(asc(payments.attemptNumber)),
      db
        .select({
          id: fulfillments.id,
          mode: fulfillments.mode,
          state: fulfillments.state,
          updatedAt: fulfillments.updatedAt,
        })
        .from(fulfillments)
        .where(eq(fulfillments.orderId, orderId))
        .limit(1),
    ] as const);
    const fulfillment = fulfillmentRows.at(0);
    if (!fulfillment) {
      throw new Error("Tracked Order has no Fulfillment");
    }
    return v.parse(GuestTrackingOrderSchema, {
      orderId: capability.orderId,
      orderNumber: capability.orderNumber,
      state: capability.state,
      placedAt: capability.placedAt.toISOString(),
      totalMnt: capability.totalMnt,
      lines: lineRows.map((line) => ({
        position: line.position,
        name: line.name,
        sku: line.sku,
        quantity: line.quantity,
        unitPriceMnt: line.unitPriceMnt,
        totalMnt: line.totalMnt,
        options: v.parse(v.array(CheckoutOptionSnapshotSchema), JSON.parse(line.optionsJson)),
        personalizations: v.parse(
          v.array(CheckoutPersonalizationSchema),
          JSON.parse(line.personalizationsJson),
        ),
        bundleComponents: v.parse(
          v.array(CheckoutBundleComponentSnapshotSchema),
          JSON.parse(line.bundleComponentsJson),
        ),
      })),
      payments: paymentRows.map((payment) => ({
        ...payment,
        updatedAt: payment.updatedAt.toISOString(),
      })),
      fulfillment: { ...fulfillment, updatedAt: fulfillment.updatedAt.toISOString() },
      expiresAt: expiresAt.toISOString(),
    });
  },
  async rotate(orderId: string, tokenHash: string, expiresAt: Date, now: Date) {
    const rows = await database()
      .update(guestTrackingLinks)
      .set({ tokenHash, expiresAt, revokedAt: null, createdAt: now })
      .where(
        and(
          eq(guestTrackingLinks.orderId, orderId),
          isNull(guestTrackingLinks.revokedAt),
          gt(guestTrackingLinks.expiresAt, now),
          sql`EXISTS (SELECT 1 FROM ${orders} WHERE ${orders.id} = ${orderId} AND ${orders.state} = 'placed' AND ${orders.terminalAt} IS NULL)`,
        ),
      )
      .returning({ orderId: guestTrackingLinks.orderId });
    return rows.length === 1;
  },
  async hasHash(orderId: string, tokenHash: string) {
    const rows = await database()
      .select({ orderId: guestTrackingLinks.orderId })
      .from(guestTrackingLinks)
      .where(
        and(eq(guestTrackingLinks.orderId, orderId), eq(guestTrackingLinks.tokenHash, tokenHash)),
      )
      .limit(1);
    return rows.length === 1;
  },
};
