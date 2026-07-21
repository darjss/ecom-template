import {
  AdminOrderSchema,
  OrderStatusPathSchema,
  OrderStatusTokenSchema,
  OrderSummarySchema,
  type AdminOrder,
  type CustomerId,
  type OrderFulfillmentMode,
  type OrderFulfillmentState,
  type OrderId,
  type OrderStatusPath,
  type OrderStatusToken,
  type OrderSummary,
} from "@ecom/contracts";
import { Result } from "better-result";
import * as v from "valibot";
import { hasStaffCapability, type StaffActor } from "../staff/operations";
import { orderQueries } from "./persistence";

export type OrderAccessFailure =
  | { readonly code: "not_found" }
  | { readonly code: "infrastructure_unavailable" };
export type OrderOperationFailure =
  | { readonly code: "forbidden" }
  | { readonly code: "not_found" }
  | { readonly code: "payment_not_confirmable" }
  | { readonly code: "payment_required" }
  | { readonly code: "fulfillment_not_advanceable" }
  | { readonly code: "infrastructure_unavailable" };
export type AdminOrderFailure = OrderAccessFailure | { readonly code: "forbidden" };
export type OrderStatusAccess = {
  readonly statusTokenHash: string;
  readonly statusPath: OrderStatusPath;
};

const toHex = (bytes: Uint8Array) =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const hashText = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
};

const hashOrderStatusToken = (token: OrderStatusToken) => hashText(token);

export const createOrderStatusAccess = async (placementKey: string) => {
  const token = v.parse(OrderStatusTokenSchema, await hashText(placementKey));
  return {
    statusTokenHash: await hashOrderStatusToken(token),
    statusPath: v.parse(OrderStatusPathSchema, `/orders/status/${token}`),
  };
};

type OrderRows = Awaited<ReturnType<typeof orderQueries.readByStatusTokenHash>>;
type OrderRow = OrderRows["orderRows"][number];

const projectOrder = (order: OrderRow, rows: OrderRows): OrderSummary | undefined => {
  const fulfillment = rows.fulfillmentRows.find(({ orderId }) => orderId === order.id);
  if (!fulfillment) {
    return undefined;
  }
  const payment = rows.paymentRows.find(({ orderId }) => orderId === order.id);
  return v.parse(OrderSummarySchema, {
    id: order.id,
    orderNumber: order.orderNumber,
    state: order.state,
    placedAt: order.placedAt.toISOString(),
    subtotalMnt: order.subtotalMnt,
    discountTotalMnt: order.discountTotalMnt,
    deliveryFeeMnt: order.deliveryFeeMnt,
    totalMnt: order.grandTotalMnt,
    lines: rows.lineRows
      .filter(({ orderId }) => orderId === order.id)
      .map(({ name, sku, quantity, unitPriceMnt, discountMnt, totalMnt }) => ({
        name,
        sku,
        quantity,
        unitPriceMnt,
        discountMnt,
        totalMnt,
      })),
    payment: payment
      ? {
          method: payment.method,
          state: payment.state,
          expectedAmountMnt: payment.expectedAmountMnt,
          confirmedAmountMnt: payment.confirmedAmountMnt,
          refundedAmountMnt: payment.refundedAmountMnt,
        }
      : null,
    fulfillment: { mode: fulfillment.mode, state: fulfillment.state },
  });
};

const projectOrders = (rows: OrderRows): OrderSummary[] | undefined => {
  const projected = [];
  for (const order of rows.orderRows) {
    const summary = projectOrder(order, rows);
    if (!summary) {
      return undefined;
    }
    projected.push(summary);
  }
  return projected;
};

const projectAdminOrders = (rows: OrderRows): AdminOrder[] | undefined => {
  const projected = [];
  for (const order of rows.orderRows) {
    const summary = projectOrder(order, rows);
    if (!summary) {
      return undefined;
    }
    const destination =
      order.fulfillmentMode === "delivery" && order.deliveryAddress
        ? { mode: "delivery" as const, address: order.deliveryAddress }
        : order.fulfillmentMode === "pickup" && order.pickupName && order.pickupAddress
          ? {
              mode: "pickup" as const,
              name: order.pickupName,
              address: order.pickupAddress,
            }
          : undefined;
    if (!destination) {
      return undefined;
    }
    projected.push(
      v.parse(AdminOrderSchema, {
        ...summary,
        recipient: { name: order.recipientName, phone: order.recipientPhone },
        destination,
      }),
    );
  }
  return projected;
};

const fulfillmentNextState = (
  mode: OrderFulfillmentMode,
  state: OrderFulfillmentState,
): { readonly state: OrderFulfillmentState; readonly completesOrder: boolean } | undefined => {
  if (state === "unfulfilled") {
    return { state: "processing", completesOrder: false };
  }
  if (state === "processing") {
    return { state: "ready", completesOrder: false };
  }
  if (mode === "delivery" && state === "ready") {
    return { state: "handed_off", completesOrder: false };
  }
  if (mode === "delivery" && state === "handed_off") {
    return { state: "fulfilled", completesOrder: true };
  }
  return mode === "pickup" && state === "ready"
    ? { state: "picked_up", completesOrder: true }
    : undefined;
};

const readProjectedOrders = async (id: OrderId) => projectOrders(await orderQueries.readById(id));
const readProjectedAdminOrders = async (id: OrderId) =>
  projectAdminOrders(await orderQueries.readById(id));

export const readStaffOrder = async (
  actor: StaffActor,
  id: OrderId,
): Promise<Result<OrderSummary, OrderOperationFailure>> => {
  if (!hasStaffCapability(actor.role, "orders_fulfillment")) {
    return Result.err({ code: "forbidden" });
  }
  try {
    const orders = await readProjectedOrders(id);
    if (!orders) {
      return Result.err({ code: "infrastructure_unavailable" });
    }
    const order = orders.at(0);
    return order ? Result.ok(order) : Result.err({ code: "not_found" });
  } catch {
    return Result.err({ code: "infrastructure_unavailable" });
  }
};

export const confirmOrderPayment = async (
  actor: StaffActor,
  id: OrderId,
): Promise<Result<AdminOrder, OrderOperationFailure>> => {
  if (!hasStaffCapability(actor.role, "financial")) {
    return Result.err({ code: "forbidden" });
  }
  try {
    const orders = await readProjectedAdminOrders(id);
    if (!orders) {
      return Result.err({ code: "infrastructure_unavailable" });
    }
    const order = orders.at(0);
    if (!order) {
      return Result.err({ code: "not_found" });
    }
    if (order.state !== "placed" || order.payment?.method !== "bank_transfer") {
      return Result.err({ code: "payment_not_confirmable" });
    }
    if (order.payment.state === "confirmed") {
      return Result.ok(order);
    }
    if (order.payment.state !== "awaiting_confirmation") {
      return Result.err({ code: "payment_not_confirmable" });
    }
    await orderQueries.confirmBankTransfer(id, actor.staffId, new Date());
    const confirmedOrders = await readProjectedAdminOrders(id);
    if (!confirmedOrders) {
      return Result.err({ code: "infrastructure_unavailable" });
    }
    const confirmed = confirmedOrders.at(0);
    return confirmed?.payment?.state === "confirmed"
      ? Result.ok(confirmed)
      : Result.err({ code: "payment_not_confirmable" });
  } catch {
    return Result.err({ code: "infrastructure_unavailable" });
  }
};

export const advanceOrderFulfillment = async (
  actor: StaffActor,
  id: OrderId,
): Promise<Result<AdminOrder, OrderOperationFailure>> => {
  if (!hasStaffCapability(actor.role, "orders_fulfillment")) {
    return Result.err({ code: "forbidden" });
  }
  try {
    const orders = await readProjectedAdminOrders(id);
    if (!orders) {
      return Result.err({ code: "infrastructure_unavailable" });
    }
    const order = orders.at(0);
    if (!order) {
      return Result.err({ code: "not_found" });
    }
    if (order.payment?.state !== "confirmed") {
      return Result.err({ code: "payment_required" });
    }
    const next =
      order.state === "placed"
        ? fulfillmentNextState(order.fulfillment.mode, order.fulfillment.state)
        : undefined;
    if (!next) {
      return Result.err({ code: "fulfillment_not_advanceable" });
    }
    await orderQueries.advanceFulfillment(
      id,
      order.fulfillment.state,
      next.state,
      next.completesOrder,
      new Date(),
    );
    const advancedOrders = await readProjectedAdminOrders(id);
    if (!advancedOrders) {
      return Result.err({ code: "infrastructure_unavailable" });
    }
    const advanced = advancedOrders.at(0);
    return advanced?.fulfillment.state === next.state
      ? Result.ok(advanced)
      : Result.err({ code: "fulfillment_not_advanceable" });
  } catch {
    return Result.err({ code: "infrastructure_unavailable" });
  }
};

export const readOrderByStatusToken = async (
  token: OrderStatusToken,
): Promise<Result<OrderSummary, OrderAccessFailure>> => {
  try {
    const rows = await orderQueries.readByStatusTokenHash(await hashOrderStatusToken(token));
    const orders = projectOrders(rows);
    if (!orders) {
      return Result.err({ code: "infrastructure_unavailable" });
    }
    const order = orders.at(0);
    return order ? Result.ok(order) : Result.err({ code: "not_found" });
  } catch {
    return Result.err({ code: "infrastructure_unavailable" });
  }
};

export const listCustomerOrders = async (
  customerId: CustomerId,
): Promise<Result<readonly OrderSummary[], OrderAccessFailure>> => {
  try {
    const orders = projectOrders(await orderQueries.listByCustomer(customerId));
    return orders
      ? Result.ok(orders)
      : Result.err<never, OrderAccessFailure>({ code: "infrastructure_unavailable" });
  } catch {
    return Result.err({ code: "infrastructure_unavailable" });
  }
};

export const listAdminOrders = async (
  actor: StaffActor,
): Promise<Result<readonly AdminOrder[], AdminOrderFailure>> => {
  if (!hasStaffCapability(actor.role, "orders_fulfillment")) {
    return Result.err({ code: "forbidden" });
  }
  try {
    const orders = projectAdminOrders(await orderQueries.listRecent());
    return orders
      ? Result.ok(orders)
      : Result.err<never, AdminOrderFailure>({ code: "infrastructure_unavailable" });
  } catch {
    return Result.err({ code: "infrastructure_unavailable" });
  }
};

export const readAdminOrder = async (
  actor: StaffActor,
  id: OrderId,
): Promise<Result<AdminOrder, AdminOrderFailure>> => {
  if (!hasStaffCapability(actor.role, "orders_fulfillment")) {
    return Result.err({ code: "forbidden" });
  }
  try {
    const orders = projectAdminOrders(await orderQueries.readById(id));
    if (!orders) {
      return Result.err({ code: "infrastructure_unavailable" });
    }
    const order = orders.at(0);
    return order ? Result.ok(order) : Result.err({ code: "not_found" });
  } catch {
    return Result.err({ code: "infrastructure_unavailable" });
  }
};
