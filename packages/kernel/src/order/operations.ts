import {
  AdminOrderSchema,
  OrderStatusPathSchema,
  OrderStatusTokenSchema,
  OrderSummarySchema,
  type AdminOrder,
  type CustomerId,
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
export type AdminOrderFailure = OrderAccessFailure | { readonly code: "forbidden" };
export type OrderStatusAccess = {
  readonly statusTokenHash: string;
  readonly statusPath: OrderStatusPath;
};

const toHex = (bytes: Uint8Array) =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const hashOrderStatusToken = async (token: OrderStatusToken) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
};

export const createOrderStatusAccess = async () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = v.parse(OrderStatusTokenSchema, toHex(bytes));
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
