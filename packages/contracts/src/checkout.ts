import * as v from "valibot";
import { CartLineSchema, CartPersonalizationAnswerSchema } from "./cart";
import { BundleIdSchema, CatalogItemIdSchema, VariantIdSchema } from "./catalog";
import { ContractClientErrorSchema, NetworkClientErrorSchema } from "./client-error";
import { LocationIdSchema } from "./cms";
import { DiscountCodeSchema, DiscountRuleIdSchema } from "./discount";

export const CheckoutAmountMntSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
  v.maxValue(100_000_000_000),
);
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
  quantity: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(99_900)),
});
export const CheckoutPersonalizationSchema = v.strictObject({
  label: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
  answer: CartPersonalizationAnswerSchema,
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
  unitPriceMnt: CheckoutAmountMntSchema,
  merchandiseAmountMnt: CheckoutAmountMntSchema,
  discountMnt: CheckoutAmountMntSchema,
  totalMnt: CheckoutAmountMntSchema,
  personalizations: v.array(CheckoutPersonalizationSchema),
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
    amountMnt: CheckoutAmountMntSchema,
    submittedCode: v.nullable(DiscountCodeSchema),
    codeAccepted: v.boolean(),
  }),
]);
export const CheckoutQuoteSchema = v.strictObject({
  quotedAt: v.pipe(v.string(), v.isoTimestamp()),
  lines: v.array(CheckoutQuoteLineSchema),
  subtotalMnt: CheckoutAmountMntSchema,
  discount: CheckoutDiscountOutcomeSchema,
  postDiscountMerchandiseMnt: CheckoutAmountMntSchema,
  fulfillment: CheckoutFulfillmentSchema,
  deliveryFeeMnt: CheckoutAmountMntSchema,
  fees: v.array(
    v.strictObject({
      kind: v.literal("delivery"),
      label: v.string(),
      amountMnt: CheckoutAmountMntSchema,
    }),
  ),
  totalMnt: CheckoutAmountMntSchema,
  commercialFingerprint: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/)),
});
export const CheckoutQuoteResponseSchema = v.strictObject({ data: CheckoutQuoteSchema });
export const CheckoutFailureReasonSchema = v.picklist([
  "catalog_unavailable",
  "invalid_personalization",
  "insufficient_inventory",
  "delivery_unavailable",
  "pickup_unavailable",
]);
export const CheckoutApiErrorSchema = v.strictObject({
  error: v.strictObject({
    code: v.picklist(["validation", "conflict", "unavailable"]),
    message: v.string(),
    reason: v.optional(CheckoutFailureReasonSchema),
    linePositions: v.optional(
      v.array(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(99))),
    ),
  }),
});
export const CheckoutClientErrorSchema = v.variant("kind", [
  NetworkClientErrorSchema,
  ContractClientErrorSchema,
  v.strictObject({ kind: v.literal("api"), error: CheckoutApiErrorSchema.entries.error }),
]);

export type CheckoutQuoteInput = v.InferOutput<typeof CheckoutQuoteInputSchema>;
export type CheckoutQuote = v.InferOutput<typeof CheckoutQuoteSchema>;
export type CheckoutQuoteLine = v.InferOutput<typeof CheckoutQuoteLineSchema>;
export type CheckoutClientError = v.InferOutput<typeof CheckoutClientErrorSchema>;
