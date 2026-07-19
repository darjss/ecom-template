import { fromString, typeidUnboxed } from "typeid-js";
import * as v from "valibot";
import { ContractClientErrorSchema, NetworkClientErrorSchema } from "./client-error";
import {
  CheckoutAmountMntSchema,
  CheckoutBundleComponentSnapshotSchema,
  CheckoutOptionSnapshotSchema,
  CheckoutPersonalizationSchema,
  FulfillmentIdSchema,
  OrderIdSchema,
  PaymentIdSchema,
} from "./checkout";

export const GuestTrackingLinkIdSchema = v.pipe(
  v.string(),
  v.check((value) => {
    try {
      fromString(value, "tracking_link");
      return true;
    } catch {
      return false;
    }
  }, "Invalid Guest Tracking Link ID"),
);
export const GuestTrackingTokenSchema = v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]{43}$/));
export const GuestTrackingRequestSchema = v.strictObject({
  orderId: OrderIdSchema,
  token: GuestTrackingTokenSchema,
});
const TrackingTimestampSchema = v.pipe(v.string(), v.isoTimestamp());
export const GuestTrackingOrderSchema = v.strictObject({
  orderId: OrderIdSchema,
  orderNumber: v.pipe(v.number(), v.integer(), v.minValue(1)),
  state: v.picklist(["placed", "completed", "cancelled"]),
  placedAt: TrackingTimestampSchema,
  totalMnt: CheckoutAmountMntSchema,
  lines: v.array(
    v.strictObject({
      position: v.pipe(v.number(), v.integer(), v.minValue(0)),
      name: v.pipe(v.string(), v.minLength(1), v.maxLength(120)),
      sku: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
      quantity: v.pipe(v.number(), v.integer(), v.minValue(1)),
      unitPriceMnt: CheckoutAmountMntSchema,
      totalMnt: CheckoutAmountMntSchema,
      options: v.array(CheckoutOptionSnapshotSchema),
      personalizations: v.array(CheckoutPersonalizationSchema),
      bundleComponents: v.array(CheckoutBundleComponentSnapshotSchema),
    }),
  ),
  payments: v.array(
    v.strictObject({
      id: PaymentIdSchema,
      method: v.picklist(["qpay", "bank_transfer", "cash_on_delivery"]),
      state: v.picklist([
        "pending",
        "awaiting_confirmation",
        "confirmed",
        "rejected",
        "failed",
        "expired",
        "superseded",
        "released_unresolved",
        "partially_refunded",
        "refunded",
      ]),
      expectedAmountMnt: CheckoutAmountMntSchema,
      confirmedAmountMnt: CheckoutAmountMntSchema,
      refundedAmountMnt: CheckoutAmountMntSchema,
      updatedAt: TrackingTimestampSchema,
    }),
  ),
  fulfillment: v.strictObject({
    id: FulfillmentIdSchema,
    mode: v.picklist(["delivery", "pickup"]),
    state: v.picklist([
      "unfulfilled",
      "processing",
      "ready",
      "handed_off",
      "picked_up",
      "fulfilled",
      "delivery_failed",
      "returned",
      "cancelled",
    ]),
    updatedAt: TrackingTimestampSchema,
  }),
  expiresAt: TrackingTimestampSchema,
});
export const GuestTrackingResponseSchema = v.strictObject({ data: GuestTrackingOrderSchema });
export const GuestTrackingApiErrorSchema = v.strictObject({
  error: v.strictObject({
    code: v.picklist(["not_found", "rate_limited", "unavailable"]),
    message: v.string(),
  }),
});
export const GuestTrackingClientErrorSchema = v.variant("kind", [
  NetworkClientErrorSchema,
  ContractClientErrorSchema,
  v.strictObject({ kind: v.literal("api"), error: GuestTrackingApiErrorSchema.entries.error }),
]);

export type GuestTrackingRequest = v.InferOutput<typeof GuestTrackingRequestSchema>;
export const createGuestTrackingLinkId = () => typeidUnboxed("tracking_link");
export type GuestTrackingOrder = v.InferOutput<typeof GuestTrackingOrderSchema>;
export type GuestTrackingClientError = v.InferOutput<typeof GuestTrackingClientErrorSchema>;
