import { fromString, typeidUnboxed } from "typeid-js";
import * as v from "valibot";
import { ContractClientErrorSchema, NetworkClientErrorSchema } from "./client-error";
import { ProductIdSchema, VariantIdSchema } from "./catalog";
import { CategoryIdSchema, CollectionIdSchema } from "./grouping";
import { NormalizedTextSchema } from "./text";

const discountId = (value: string) => {
  try {
    fromString(value, "discount");
    return true;
  } catch {
    return false;
  }
};

export const DiscountRuleIdSchema = v.pipe(v.string(), v.check(discountId, "Invalid Discount ID"));
export const DiscountNameSchema = v.pipe(
  NormalizedTextSchema,
  v.trim(),
  v.minLength(1),
  v.maxLength(120),
);
export const DiscountCodeSchema = v.pipe(
  v.string(),
  v.trim(),
  v.toUpperCase(),
  v.regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/),
  v.maxLength(32),
);
export const DiscountStateSchema = v.picklist(["draft", "active", "inactive"]);
export const DiscountTargetSchema = v.variant("kind", [
  v.strictObject({ kind: v.literal("all") }),
  v.strictObject({ kind: v.literal("product"), id: ProductIdSchema }),
  v.strictObject({ kind: v.literal("variant"), id: VariantIdSchema }),
  v.strictObject({ kind: v.literal("category"), id: CategoryIdSchema }),
  v.strictObject({ kind: v.literal("collection"), id: CollectionIdSchema }),
]);
const DiscountRuleFields = {
  name: DiscountNameSchema,
  mode: v.picklist(["automatic", "code"]),
  code: v.nullable(DiscountCodeSchema),
  calculation: v.picklist(["percentage", "fixed_mnt"]),
  value: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1_000_000_000)),
  targets: v.pipe(
    v.array(DiscountTargetSchema),
    v.minLength(1),
    v.maxLength(100),
    v.check(
      (targets) => new Set(targets.map((target) => JSON.stringify(target))).size === targets.length,
    ),
  ),
  startsAt: v.nullable(v.pipe(v.string(), v.isoTimestamp())),
  endsAt: v.nullable(v.pipe(v.string(), v.isoTimestamp())),
  minimumSubtotalMnt: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1_000_000_000)),
  globalLimit: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1_000_000))),
} as const;
export const DiscountRuleInputSchema = v.pipe(
  v.strictObject(DiscountRuleFields),
  v.check(
    (input) => (input.mode === "code") === (input.code !== null),
    "Code must match Discount mode",
  ),
  v.check(
    (input) => input.calculation !== "percentage" || input.value <= 100,
    "Percentage cannot exceed 100",
  ),
  v.check(
    (input) => input.startsAt === null || input.endsAt === null || input.startsAt < input.endsAt,
    "Discount window is invalid",
  ),
  v.check(
    (input) => input.targets.length === 1 || input.targets.every(({ kind }) => kind !== "all"),
    "Whole-catalog target cannot be combined",
  ),
);
export const DiscountRuleSchema = v.strictObject({
  id: DiscountRuleIdSchema,
  ...DiscountRuleFields,
  state: DiscountStateSchema,
  revision: v.pipe(v.number(), v.integer(), v.minValue(1)),
  redemptionCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
  updatedAt: v.pipe(v.string(), v.isoTimestamp()),
});
export const DiscountListResponseSchema = v.strictObject({ data: v.array(DiscountRuleSchema) });
export const DiscountMutationResponseSchema = v.strictObject({ data: DiscountRuleSchema });
export const DiscountUpdateInputSchema = v.strictObject({
  expectedRevision: v.pipe(v.number(), v.integer(), v.minValue(1)),
  rule: DiscountRuleInputSchema,
});
export const DiscountStateInputSchema = v.strictObject({
  expectedRevision: v.pipe(v.number(), v.integer(), v.minValue(1)),
  state: v.picklist(["active", "inactive"]),
});
export const DiscountFailureReasonSchema = v.picklist([
  "not_found",
  "duplicate_code",
  "invalid_lifecycle",
  "invalid_target",
  "revision_conflict",
]);
export const DiscountApiErrorSchema = v.strictObject({
  error: v.strictObject({
    code: v.picklist([
      "unauthorized",
      "forbidden",
      "validation",
      "not_found",
      "conflict",
      "unavailable",
    ]),
    message: v.string(),
    reason: v.optional(DiscountFailureReasonSchema),
  }),
});
export const DiscountClientErrorSchema = v.variant("kind", [
  NetworkClientErrorSchema,
  ContractClientErrorSchema,
  v.strictObject({ kind: v.literal("api"), error: DiscountApiErrorSchema.entries.error }),
]);

export type DiscountRuleId = v.InferOutput<typeof DiscountRuleIdSchema>;
export type DiscountTarget = v.InferOutput<typeof DiscountTargetSchema>;
export type DiscountRuleInput = v.InferOutput<typeof DiscountRuleInputSchema>;
export type DiscountRule = v.InferOutput<typeof DiscountRuleSchema>;
export type DiscountClientError = v.InferOutput<typeof DiscountClientErrorSchema>;
export const createDiscountRuleId = () => typeidUnboxed("discount");
