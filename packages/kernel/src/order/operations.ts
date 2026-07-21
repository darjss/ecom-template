import {
  OrderStatusPathSchema,
  OrderStatusTokenSchema,
  OrderSummarySchema,
  type CustomerId,
  type OrderStatusPath,
  type OrderStatusToken,
  type OrderSummary,
} from "@ecom/contracts";
import { Result } from "better-result";
import * as v from "valibot";
import { orderQueries } from "./persistence";

export type OrderAccessFailure =
  | { readonly code: "not_found" }
  | { readonly code: "infrastructure_unavailable" };
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

const projectOrders = (rows: OrderRows): OrderSummary[] | undefined => {
  const projected = [];
  for (const order of rows.orderRows) {
    const fulfillment = rows.fulfillmentRows.find(({ orderId }) => orderId === order.id);
    if (!fulfillment) {
      return undefined;
    }
    const payment = rows.paymentRows.find(({ orderId }) => orderId === order.id);
    projected.push(
      v.parse(OrderSummarySchema, {
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
