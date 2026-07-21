import { fromString, typeidUnboxed } from "typeid-js";
import * as v from "valibot";
import { ContractClientErrorSchema, NetworkClientErrorSchema } from "./client-error";
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
export const OrderStatusResponseSchema = v.strictObject({ data: OrderSummarySchema });
export const CustomerOrdersResponseSchema = v.strictObject({
  data: v.strictObject({ orders: v.array(OrderSummarySchema) }),
});
export const OrderAccessApiErrorSchema = v.strictObject({
  error: v.strictObject({
    code: v.picklist(["unauthorized", "not_found", "unavailable"]),
    message: v.string(),
  }),
});
export const OrderAccessClientErrorSchema = v.variant("kind", [
  NetworkClientErrorSchema,
  ContractClientErrorSchema,
  v.strictObject({ kind: v.literal("api"), error: OrderAccessApiErrorSchema.entries.error }),
]);

export type OrderId = v.InferOutput<typeof OrderIdSchema>;
export type OrderStatusToken = v.InferOutput<typeof OrderStatusTokenSchema>;
export type OrderStatusPath = v.InferOutput<typeof OrderStatusPathSchema>;
export type OrderSummary = v.InferOutput<typeof OrderSummarySchema>;
export type OrderAccessClientError = v.InferOutput<typeof OrderAccessClientErrorSchema>;

export const createOrderId = () => typeidUnboxed("order");
