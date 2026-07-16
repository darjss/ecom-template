import { fromString, typeidUnboxed } from "typeid-js";
import * as v from "valibot";

export const ApiErrorSchema = v.strictObject({
  error: v.strictObject({
    code: v.picklist(["service_unavailable", "contract_failure"]),
    message: v.string(),
  }),
});

export const HealthResponseSchema = v.strictObject({
  data: v.strictObject({
    status: v.literal("ok"),
    database: v.literal("connected"),
    ephemeralKv: v.literal("connected"),
    media: v.literal("connected"),
    store: v.string(),
    checkedAt: v.string(),
  }),
});

export const StorefrontSummarySchema = v.strictObject({
  storeName: v.string(),
  location: v.string(),
  status: v.literal("open"),
});

export const CartLineSchema = v.strictObject({
  id: v.string(),
  title: v.string(),
  quantity: v.pipe(v.number(), v.integer(), v.minValue(1)),
  unitPriceMnt: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export const CartSchema = v.strictObject({
  lines: v.array(CartLineSchema),
});

export type ApiError = v.InferOutput<typeof ApiErrorSchema>;
export type HealthResponse = v.InferOutput<typeof HealthResponseSchema>;
export type StorefrontSummary = v.InferOutput<typeof StorefrontSummarySchema>;
export type Cart = v.InferOutput<typeof CartSchema>;
export type CartLine = v.InferOutput<typeof CartLineSchema>;

export const createCatalogItemId = () => typeidUnboxed("product");
export const parseCatalogItemId = (value: string) => fromString(value, "product");

export type SmsMessage = {
  readonly recipientPhone: string;
  readonly body: string;
  readonly requestId: string;
};

export type SmsSender = (message: SmsMessage) => Promise<void>;
