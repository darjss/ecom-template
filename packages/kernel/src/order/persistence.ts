import type { CustomerId, OrderFulfillmentState, OrderId, StaffId } from "@ecom/contracts";
import { and, asc, desc, eq, exists, inArray, sql } from "drizzle-orm";
import { database } from "../db/database";
import { fulfillments, orderLines, orders, payments } from "../db/schema";

type OrderRow = Pick<
  typeof orders.$inferSelect,
  | "id"
  | "orderNumber"
  | "state"
  | "placedAt"
  | "subtotalMnt"
  | "discountTotalMnt"
  | "deliveryFeeMnt"
  | "grandTotalMnt"
  | "recipientName"
  | "recipientPhone"
  | "fulfillmentMode"
  | "deliveryAddress"
  | "pickupName"
  | "pickupAddress"
>;
const orderSelection = {
  id: orders.id,
  orderNumber: orders.orderNumber,
  state: orders.state,
  placedAt: orders.placedAt,
  subtotalMnt: orders.subtotalMnt,
  discountTotalMnt: orders.discountTotalMnt,
  deliveryFeeMnt: orders.deliveryFeeMnt,
  grandTotalMnt: orders.grandTotalMnt,
  recipientName: orders.recipientName,
  recipientPhone: orders.recipientPhone,
  fulfillmentMode: orders.fulfillmentMode,
  deliveryAddress: orders.deliveryAddress,
  pickupName: orders.pickupName,
  pickupAddress: orders.pickupAddress,
};

const readOrderDetails = async (orderRows: readonly OrderRow[]) => {
  const ids = orderRows.map(({ id }) => id);
  if (ids.length === 0) {
    return { orderRows, lineRows: [], paymentRows: [], fulfillmentRows: [] };
  }
  const db = database();
  const [lineRows, paymentRows, fulfillmentRows] = await db.batch([
    db
      .select({
        orderId: orderLines.orderId,
        name: orderLines.itemName,
        sku: orderLines.sku,
        quantity: orderLines.quantity,
        unitPriceMnt: orderLines.unitPriceMnt,
        discountMnt: orderLines.discountMnt,
        totalMnt: orderLines.totalMnt,
      })
      .from(orderLines)
      .where(inArray(orderLines.orderId, ids))
      .orderBy(asc(orderLines.orderId), asc(orderLines.position)),
    db
      .select({
        orderId: payments.orderId,
        method: payments.method,
        state: payments.status,
        expectedAmountMnt: payments.expectedAmountMnt,
        confirmedAmountMnt: payments.confirmedAmountMnt,
        refundedAmountMnt: payments.refundedAmountMnt,
      })
      .from(payments)
      .where(inArray(payments.orderId, ids))
      .orderBy(asc(payments.orderId), desc(payments.attemptNumber)),
    db
      .select({
        orderId: fulfillments.orderId,
        mode: fulfillments.mode,
        state: fulfillments.state,
      })
      .from(fulfillments)
      .where(inArray(fulfillments.orderId, ids)),
  ] as const);
  return { orderRows, lineRows, paymentRows, fulfillmentRows };
};

const readByStatusTokenHash = async (statusTokenHash: string) => {
  const orderRows = await database()
    .select(orderSelection)
    .from(orders)
    .where(eq(orders.statusTokenHash, statusTokenHash))
    .limit(1);
  return readOrderDetails(orderRows);
};

const readById = async (id: OrderId) => {
  const orderRows = await database()
    .select(orderSelection)
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  return readOrderDetails(orderRows);
};

const listByCustomer = async (customerId: CustomerId) => {
  const orderRows = await database()
    .select(orderSelection)
    .from(orders)
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.placedAt), desc(orders.orderNumber));
  return readOrderDetails(orderRows);
};

const listRecent = async () => {
  const orderRows = await database()
    .select(orderSelection)
    .from(orders)
    .orderBy(desc(orders.placedAt), desc(orders.orderNumber))
    .limit(100);
  return readOrderDetails(orderRows);
};

const confirmBankTransfer = async (orderId: OrderId, staffId: StaffId, now: Date) => {
  const changed = await database()
    .update(payments)
    .set({
      status: "confirmed",
      confirmedAmountMnt: sql`${payments.expectedAmountMnt}`,
      confirmedBy: staffId,
      confirmedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(payments.orderId, orderId),
        eq(payments.method, "bank_transfer"),
        eq(payments.status, "awaiting_confirmation"),
      ),
    )
    .returning({ id: payments.id });
  return changed.length > 0;
};

const advanceFulfillment = async (
  orderId: OrderId,
  currentState: OrderFulfillmentState,
  nextState: OrderFulfillmentState,
  completesOrder: boolean,
  now: Date,
) => {
  const db = database();
  const fulfillmentUpdate = db
    .update(fulfillments)
    .set({ state: nextState, updatedAt: now })
    .where(and(eq(fulfillments.orderId, orderId), eq(fulfillments.state, currentState)))
    .returning({ id: fulfillments.id });
  if (!completesOrder) {
    return (await fulfillmentUpdate).length > 0;
  }
  const [changed] = await db.batch([
    fulfillmentUpdate,
    db
      .update(orders)
      .set({ state: "completed" })
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.state, "placed"),
          exists(
            db
              .select({ id: fulfillments.id })
              .from(fulfillments)
              .where(and(eq(fulfillments.orderId, orderId), eq(fulfillments.state, nextState))),
          ),
        ),
      ),
  ] as const);
  return changed.length > 0;
};

export const orderQueries = {
  readByStatusTokenHash,
  readById,
  listByCustomer,
  listRecent,
  confirmBankTransfer,
  advanceFulfillment,
};
