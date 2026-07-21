import { fromString, typeidUnboxed } from "typeid-js";
import * as v from "valibot";
import { CartLineSchema } from "./cart";
import {
  PersonalizationIdSchema,
  PersonalizationKeySchema,
  PersonalizationValueIdSchema,
} from "./bundle";
import {
  BundleIdSchema,
  CatalogItemIdSchema,
  OptionGroupIdSchema,
  OptionValueIdSchema,
  VariantIdSchema,
} from "./catalog";
import { ContractClientErrorSchema, NetworkClientErrorSchema } from "./client-error";
import { LocationIdSchema } from "./cms";
import { DiscountCodeSchema, DiscountRuleIdSchema } from "./discount";
import { MoneyMntSchema } from "./money";
import { OrderIdSchema, OrderStatusPathSchema } from "./order";

const typeIdSchema = (prefix: string) =>
  v.pipe(
    v.string(),
    v.check((value) => {
      try {
        fromString(value, prefix);
        return true;
      } catch {
        return false;
      }
    }, `Invalid ${prefix} ID`),
  );

export const OrderLineIdSchema = typeIdSchema("order_line");
export const OrderDiscountIdSchema = typeIdSchema("order_discount");
export const PaymentIdSchema = typeIdSchema("payment");
export const PaymentEntryIdSchema = typeIdSchema("payment_entry");
export const FulfillmentIdSchema = typeIdSchema("fulfillment");
export const ReservationIdSchema = typeIdSchema("reservation");
export const CheckoutFulfillmentSchema = v.variant("kind", [
  v.strictObject({ kind: v.literal("delivery") }),
  v.strictObject({ kind: v.literal("pickup"), locationId: LocationIdSchema }),
]);
export const CheckoutQuoteInputSchema = v.strictObject({
  lines: v.pipe(v.array(CartLineSchema), v.minLength(1), v.maxLength(100)),
  code: v.nullable(DiscountCodeSchema),
  fulfillment: CheckoutFulfillmentSchema,
});
export const CheckoutDemandSchema = v.strictObject({
  variantId: VariantIdSchema,
  quantity: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1_000_000)),
});
export const CheckoutPersonalizationSchema = v.strictObject({
  definitionId: PersonalizationIdSchema,
  key: PersonalizationKeySchema,
  label: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
  value: v.variant("kind", [
    v.strictObject({
      kind: v.literal("text"),
      text: v.pipe(v.string(), v.maxLength(240)),
    }),
    v.strictObject({
      kind: v.literal("single_select"),
      valueId: PersonalizationValueIdSchema,
      label: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
    }),
    v.strictObject({ kind: v.literal("checkbox"), checked: v.boolean() }),
  ]),
});
export const CheckoutOptionSnapshotSchema = v.strictObject({
  groupId: OptionGroupIdSchema,
  groupKey: v.pipe(v.string(), v.minLength(1), v.maxLength(48)),
  groupLabel: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
  valueId: OptionValueIdSchema,
  valueKey: v.pipe(v.string(), v.minLength(1), v.maxLength(48)),
  valueLabel: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
});
export const CheckoutBundleComponentSnapshotSchema = v.strictObject({
  variantId: VariantIdSchema,
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(120)),
  sku: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
  perBundleQuantity: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(999)),
  totalQuantity: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1_000_000)),
});
export const CheckoutQuoteLineSchema = v.strictObject({
  position: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(99)),
  source: v.variant("kind", [
    v.strictObject({
      kind: v.literal("variant"),
      id: VariantIdSchema,
      catalogItemId: CatalogItemIdSchema,
    }),
    v.strictObject({
      kind: v.literal("bundle"),
      id: BundleIdSchema,
      catalogItemId: CatalogItemIdSchema,
    }),
  ]),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(120)),
  sku: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
  quantity: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(999)),
  unitPriceMnt: MoneyMntSchema,
  merchandiseAmountMnt: MoneyMntSchema,
  discountMnt: MoneyMntSchema,
  totalMnt: MoneyMntSchema,
  options: v.array(CheckoutOptionSnapshotSchema),
  personalizations: v.array(CheckoutPersonalizationSchema),
  bundleComponents: v.array(CheckoutBundleComponentSnapshotSchema),
  demand: v.array(CheckoutDemandSchema),
});
export const CheckoutDiscountOutcomeSchema = v.variant("kind", [
  v.strictObject({
    kind: v.literal("none"),
    submittedCode: v.nullable(DiscountCodeSchema),
    codeAccepted: v.boolean(),
  }),
  v.strictObject({
    kind: v.literal("applied"),
    ruleId: DiscountRuleIdSchema,
    name: v.pipe(v.string(), v.minLength(1), v.maxLength(120)),
    amountMnt: MoneyMntSchema,
    submittedCode: v.nullable(DiscountCodeSchema),
    codeAccepted: v.boolean(),
  }),
]);
export const CheckoutQuoteSchema = v.strictObject({
  quotedAt: v.pipe(v.string(), v.isoTimestamp()),
  lines: v.array(CheckoutQuoteLineSchema),
  subtotalMnt: MoneyMntSchema,
  discount: CheckoutDiscountOutcomeSchema,
  postDiscountMerchandiseMnt: MoneyMntSchema,
  fulfillment: CheckoutFulfillmentSchema,
  deliveryFeeMnt: MoneyMntSchema,
  fees: v.array(
    v.strictObject({
      kind: v.literal("delivery"),
      label: v.string(),
      amountMnt: MoneyMntSchema,
    }),
  ),
  totalMnt: MoneyMntSchema,
  commercialFingerprint: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/)),
});
export const CheckoutQuoteResponseSchema = v.strictObject({ data: CheckoutQuoteSchema });
export const CheckoutOptionsResponseSchema = v.strictObject({
  data: v.strictObject({
    deliveryEnabled: v.boolean(),
    pickupLocations: v.array(
      v.strictObject({
        id: LocationIdSchema,
        name: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
        address: v.pipe(v.string(), v.minLength(1), v.maxLength(240)),
      }),
    ),
  }),
});
export const CheckoutFailureReasonSchema = v.picklist([
  "catalog_unavailable",
  "invalid_personalization",
  "insufficient_inventory",
  "quantity_exceeded",
  "delivery_unavailable",
  "pickup_unavailable",
]);
export const PlacementIdempotencyKeySchema = v.pipe(v.string(), v.uuid(), v.maxLength(64));
export const AnonymousOrderContactSchema = v.strictObject({
  recipientName: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
  recipientPhone: v.pipe(v.string(), v.regex(/^\+976[5-9]\d{7}$/)),
  deliveryAddress: v.nullable(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(500))),
});
export const PlaceOrderInputSchema = v.pipe(
  v.strictObject({
    idempotencyKey: PlacementIdempotencyKeySchema,
    acceptedCommercialFingerprint: CheckoutQuoteSchema.entries.commercialFingerprint,
    quoteInput: CheckoutQuoteInputSchema,
    contact: AnonymousOrderContactSchema,
    paymentMethod: v.literal("bank_transfer"),
  }),
  v.check(
    ({ quoteInput, contact }) =>
      quoteInput.fulfillment.kind === "delivery"
        ? contact.deliveryAddress !== null
        : contact.deliveryAddress === null,
    "Delivery address must match fulfillment mode",
  ),
);
export const PlaceOrderResultSchema = v.strictObject({
  orderId: OrderIdSchema,
  orderNumber: v.pipe(v.number(), v.integer(), v.minValue(1)),
  orderState: v.literal("placed"),
  statusPath: OrderStatusPathSchema,
  totalMnt: MoneyMntSchema,
  payment: v.nullable(
    v.strictObject({
      id: PaymentIdSchema,
      method: v.literal("bank_transfer"),
      state: v.literal("awaiting_confirmation"),
      expectedAmountMnt: MoneyMntSchema,
    }),
  ),
  fulfillment: v.strictObject({
    id: FulfillmentIdSchema,
    mode: v.picklist(["delivery", "pickup"]),
    state: v.literal("unfulfilled"),
  }),
  reservation: v.strictObject({
    id: ReservationIdSchema,
    state: v.picklist(["active", "consumed"]),
  }),
});
export const PlaceOrderResponseSchema = v.strictObject({ data: PlaceOrderResultSchema });
export const CheckoutApiErrorSchema = v.strictObject({
  error: v.strictObject({
    code: v.picklist(["validation", "conflict", "unavailable"]),
    message: v.string(),
    reason: v.optional(
      v.picklist([
        "catalog_unavailable",
        "invalid_personalization",
        "insufficient_inventory",
        "quantity_exceeded",
        "delivery_unavailable",
        "pickup_unavailable",
        "commercial_changed",
        "idempotency_conflict",
        "bank_transfer_unavailable",
      ]),
    ),
    linePositions: v.optional(
      v.array(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(99))),
    ),
    currentQuote: v.optional(CheckoutQuoteSchema),
  }),
});
export const CheckoutClientErrorSchema = v.variant("kind", [
  NetworkClientErrorSchema,
  ContractClientErrorSchema,
  v.strictObject({ kind: v.literal("api"), error: CheckoutApiErrorSchema.entries.error }),
]);

export type CheckoutQuoteInput = v.InferOutput<typeof CheckoutQuoteInputSchema>;
export type CheckoutQuote = v.InferOutput<typeof CheckoutQuoteSchema>;
export type CheckoutOptions = v.InferOutput<typeof CheckoutOptionsResponseSchema>["data"];
export type CheckoutQuoteLine = v.InferOutput<typeof CheckoutQuoteLineSchema>;
export type CheckoutClientError = v.InferOutput<typeof CheckoutClientErrorSchema>;
export type PlaceOrderInput = v.InferOutput<typeof PlaceOrderInputSchema>;
export type PlaceOrderResult = v.InferOutput<typeof PlaceOrderResultSchema>;
export const createOrderLineId = () => typeidUnboxed("order_line");
export const createOrderDiscountId = () => typeidUnboxed("order_discount");
export const createPaymentId = () => typeidUnboxed("payment");
export const createPaymentEntryId = () => typeidUnboxed("payment_entry");
export const createFulfillmentId = () => typeidUnboxed("fulfillment");
export const createReservationId = () => typeidUnboxed("reservation");
