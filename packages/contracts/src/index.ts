import { fromString, typeidUnboxed } from "typeid-js";
import * as v from "valibot";

export const ApiErrorCodeSchema = v.picklist([
  "unauthorized",
  "forbidden",
  "not_found",
  "validation",
  "conflict",
  "rate_limited",
  "unavailable",
  "internal",
]);

export const ApiErrorSchema = v.strictObject({
  error: v.strictObject({
    code: ApiErrorCodeSchema,
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

export const StoreDefinitionSchema = v.strictObject({
  profile: v.strictObject({
    slug: v.pipe(v.string(), v.regex(/^[a-z0-9-]+$/)),
    name: v.pipe(v.string(), v.minLength(1)),
    location: v.pipe(v.string(), v.minLength(1)),
    origin: v.pipe(v.string(), v.url()),
    currency: v.literal("MNT"),
    locale: v.literal("mn-MN"),
  }),
  providers: v.strictObject({
    payment: v.picklist(["byl", "qpay"]),
    notifications: v.array(v.picklist(["sms_gateway", "telegram"])),
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

export const ClientErrorSchema = v.variant("kind", [
  v.strictObject({ kind: v.literal("network"), message: v.string() }),
  v.strictObject({ kind: v.literal("contract"), message: v.string() }),
  v.strictObject({ kind: v.literal("api"), error: ApiErrorSchema.entries.error }),
]);

export type ApiError = v.InferOutput<typeof ApiErrorSchema>;
export type HealthResponse = v.InferOutput<typeof HealthResponseSchema>;
export type StoreDefinition = v.InferOutput<typeof StoreDefinitionSchema>;
export type StorefrontSummary = v.InferOutput<typeof StorefrontSummarySchema>;
export type Cart = v.InferOutput<typeof CartSchema>;
export type CartLine = v.InferOutput<typeof CartLineSchema>;
export type ClientError = v.InferOutput<typeof ClientErrorSchema>;

export const createCatalogItemId = () => typeidUnboxed("product");
export const parseCatalogItemId = (value: string) => fromString(value, "product");
