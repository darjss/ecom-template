import { fromString, typeidUnboxed } from "typeid-js";
import * as v from "valibot";
import {
  ContractClientErrorSchema,
  NetworkClientErrorSchema,
  type ClientRequestError,
} from "./client-error";
import { MoneyMntSchema } from "./money";

export const OrderIdSchema = v.pipe(
  v.string(),
  v.check((value) => {
    try {
      fromString(value, "order");
      return true;
    } catch {
      return false;
    }
  }, "Invalid order ID"),
);
export const OrderStatusTokenSchema = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/));
export const OrderStatusPathSchema = v.pipe(
  v.string(),
  v.regex(/^\/orders\/status\/[a-f0-9]{64}$/),
);

export const OrderStateSchema = v.picklist(["placed", "completed", "cancelled"]);
export const OrderPaymentMethodSchema = v.picklist(["qpay", "bank_transfer", "cash_on_delivery"]);
export const OrderPaymentStateSchema = v.picklist([
  "pending",
  "awaiting_confirmation",
  "confirmed",
  "failed",
  "expired",
  "rejected",
  "superseded",
  "released_unresolved",
  "partially_refunded",
  "refunded",
]);
export const OrderFulfillmentModeSchema = v.picklist(["delivery", "pickup"]);
export const OrderFulfillmentStateSchema = v.picklist([
  "unfulfilled",
  "processing",
  "ready",
  "handed_off",
  "picked_up",
  "fulfilled",
  "delivery_failed",
  "returned",
  "cancelled",
]);
export const OrderSummarySchema = v.strictObject({
  id: OrderIdSchema,
  orderNumber: v.pipe(v.number(), v.integer(), v.minValue(1)),
  state: OrderStateSchema,
  placedAt: v.pipe(v.string(), v.isoTimestamp()),
  subtotalMnt: MoneyMntSchema,
  discountTotalMnt: MoneyMntSchema,
  deliveryFeeMnt: MoneyMntSchema,
  totalMnt: MoneyMntSchema,
  lines: v.pipe(
    v.array(
      v.strictObject({
        name: v.pipe(v.string(), v.minLength(1), v.maxLength(120)),
        sku: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
        quantity: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(999)),
        unitPriceMnt: MoneyMntSchema,
        discountMnt: MoneyMntSchema,
        totalMnt: MoneyMntSchema,
      }),
    ),
    v.minLength(1),
    v.maxLength(100),
  ),
  payment: v.nullable(
    v.strictObject({
      method: OrderPaymentMethodSchema,
      state: OrderPaymentStateSchema,
      expectedAmountMnt: MoneyMntSchema,
      confirmedAmountMnt: MoneyMntSchema,
      refundedAmountMnt: MoneyMntSchema,
    }),
  ),
  fulfillment: v.strictObject({
    mode: OrderFulfillmentModeSchema,
    state: OrderFulfillmentStateSchema,
  }),
});
export const AdminOrderSchema = v.strictObject({
  ...OrderSummarySchema.entries,
  recipient: v.strictObject({
    name: v.pipe(v.string(), v.minLength(1), v.maxLength(120)),
    phone: v.pipe(v.string(), v.minLength(1), v.maxLength(32)),
  }),
  destination: v.variant("mode", [
    v.strictObject({
      mode: v.literal("delivery"),
      address: v.pipe(v.string(), v.minLength(1), v.maxLength(500)),
    }),
    v.strictObject({
      mode: v.literal("pickup"),
      name: v.pipe(v.string(), v.minLength(1), v.maxLength(120)),
      address: v.pipe(v.string(), v.minLength(1), v.maxLength(500)),
    }),
  ]),
});
export const OrderStatusResponseSchema = v.strictObject({ data: OrderSummarySchema });
export const CustomerOrdersResponseSchema = v.strictObject({
  data: v.strictObject({ orders: v.array(OrderSummarySchema) }),
});
export const AdminOrdersResponseSchema = v.strictObject({
  data: v.strictObject({ orders: v.array(AdminOrderSchema) }),
});
export const AdminOrderResponseSchema = v.strictObject({ data: AdminOrderSchema });
export const OrderOperationApiErrorSchema = v.strictObject({
  error: v.strictObject({
    code: v.picklist([
      "unauthorized",
      "forbidden",
      "not_found",
      "validation",
      "conflict",
      "unavailable",
    ]),
    reason: v.optional(
      v.picklist(["payment_not_confirmable", "payment_required", "fulfillment_not_advanceable"]),
    ),
    message: v.string(),
  }),
});
export const OrderAccessApiErrorSchema = v.strictObject({
  error: v.strictObject({
    code: v.picklist(["unauthorized", "not_found", "unavailable"]),
    message: v.string(),
  }),
});
export const AdminOrderApiErrorSchema = v.strictObject({
  error: v.strictObject({
    code: v.picklist(["unauthorized", "forbidden", "not_found", "validation", "unavailable"]),
    message: v.string(),
  }),
});
export const OrderAccessClientErrorSchema = v.variant("kind", [
  NetworkClientErrorSchema,
  ContractClientErrorSchema,
  v.strictObject({ kind: v.literal("api"), error: OrderAccessApiErrorSchema.entries.error }),
]);
export const AdminOrderClientErrorSchema = v.variant("kind", [
  NetworkClientErrorSchema,
  ContractClientErrorSchema,
  v.strictObject({ kind: v.literal("api"), error: AdminOrderApiErrorSchema.entries.error }),
]);

export type OrderId = v.InferOutput<typeof OrderIdSchema>;
export type OrderStatusToken = v.InferOutput<typeof OrderStatusTokenSchema>;
export type OrderStatusPath = v.InferOutput<typeof OrderStatusPathSchema>;
export type OrderPaymentState = v.InferOutput<typeof OrderPaymentStateSchema>;
export type OrderFulfillmentMode = v.InferOutput<typeof OrderFulfillmentModeSchema>;
export type OrderFulfillmentState = v.InferOutput<typeof OrderFulfillmentStateSchema>;
export type OrderSummary = v.InferOutput<typeof OrderSummarySchema>;
export type AdminOrder = v.InferOutput<typeof AdminOrderSchema>;
export type OrderOperationApiError = v.InferOutput<typeof OrderOperationApiErrorSchema>;
export type OrderOperationClientError = ClientRequestError<OrderOperationApiError["error"]>;
export type OrderAccessClientError = v.InferOutput<typeof OrderAccessClientErrorSchema>;
export type AdminOrderClientError = v.InferOutput<typeof AdminOrderClientErrorSchema>;

export const createOrderId = () => typeidUnboxed("order");
