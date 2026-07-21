import type { CustomerId } from "@ecom/contracts";
import { asc, desc, eq, inArray } from "drizzle-orm";
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
        state: payments.state,
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

const listByCustomer = async (customerId: CustomerId) => {
  const orderRows = await database()
    .select(orderSelection)
    .from(orders)
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.placedAt), desc(orders.orderNumber));
  return readOrderDetails(orderRows);
};

export const orderQueries = { readByStatusTokenHash, listByCustomer };
