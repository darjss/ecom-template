import * as v from "valibot";
import { ContractClientErrorSchema, NetworkClientErrorSchema } from "./client-error";
import { BundleIdSchema, PriceMntSchema, VariantIdSchema } from "./catalog";

export const PurchaseQuantitySchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(1),
  v.maxValue(999),
);

export const AvailabilityTargetSchema = v.variant("kind", [
  v.strictObject({
    kind: v.literal("variant"),
    id: VariantIdSchema,
    quantity: PurchaseQuantitySchema,
  }),
  v.strictObject({
    kind: v.literal("bundle"),
    id: BundleIdSchema,
    quantity: PurchaseQuantitySchema,
  }),
]);

export const AvailabilityRequestSchema = v.strictObject({
  targets: v.pipe(
    v.array(AvailabilityTargetSchema),
    v.minLength(1),
    v.maxLength(50),
    v.check(
      (targets) => new Set(targets.map(({ kind, id }) => `${kind}:${id}`)).size === targets.length,
      "Purchase targets must be unique",
    ),
  ),
});

export const AvailabilityFactSchema = v.variant("kind", [
  v.strictObject({
    kind: v.literal("variant"),
    id: VariantIdSchema,
    sellable: v.boolean(),
    unitPriceMnt: PriceMntSchema,
  }),
  v.strictObject({
    kind: v.literal("bundle"),
    id: BundleIdSchema,
    sellable: v.boolean(),
    unitPriceMnt: PriceMntSchema,
  }),
]);

export const AvailabilityResponseSchema = v.strictObject({
  data: v.strictObject({
    checkedAt: v.pipe(v.string(), v.isoTimestamp()),
    facts: v.pipe(v.array(AvailabilityFactSchema), v.maxLength(50)),
  }),
});

export const AvailabilityApiErrorSchema = v.strictObject({
  error: v.strictObject({
    code: v.picklist(["validation", "unavailable"]),
    message: v.string(),
  }),
});

export const AvailabilityClientErrorSchema = v.variant("kind", [
  NetworkClientErrorSchema,
  ContractClientErrorSchema,
  v.strictObject({
    kind: v.literal("api"),
    error: AvailabilityApiErrorSchema.entries.error,
  }),
]);

export type AvailabilityTarget = v.InferOutput<typeof AvailabilityTargetSchema>;
export type AvailabilityRequest = v.InferOutput<typeof AvailabilityRequestSchema>;
export type AvailabilityFact = v.InferOutput<typeof AvailabilityFactSchema>;
export type AvailabilityResponse = v.InferOutput<typeof AvailabilityResponseSchema>;
export type AvailabilityClientError = v.InferOutput<typeof AvailabilityClientErrorSchema>;
