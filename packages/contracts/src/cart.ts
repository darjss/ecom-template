import * as v from "valibot";
import { PersonalizationKeySchema, PersonalizationValueIdSchema } from "./bundle";
import { BundleIdSchema, VariantIdSchema } from "./catalog";
import { PurchaseQuantitySchema } from "./availability";

export const CartPersonalizationAnswerSchema = v.variant("kind", [
  v.strictObject({
    key: PersonalizationKeySchema,
    kind: v.literal("text"),
    value: v.pipe(v.string(), v.maxLength(240)),
  }),
  v.strictObject({
    key: PersonalizationKeySchema,
    kind: v.literal("single_select"),
    valueId: PersonalizationValueIdSchema,
  }),
  v.strictObject({
    key: PersonalizationKeySchema,
    kind: v.literal("checkbox"),
    checked: v.boolean(),
  }),
]);

export const CartPersonalizationAnswersSchema = v.pipe(
  v.array(CartPersonalizationAnswerSchema),
  v.maxLength(12),
  v.check(
    (answers) => new Set(answers.map(({ key }) => key)).size === answers.length,
    "Personalization answer keys must be unique",
  ),
);

const CartLineFields = {
  quantity: PurchaseQuantitySchema,
  personalizations: CartPersonalizationAnswersSchema,
};

export const CartLineSchema = v.variant("kind", [
  v.strictObject({ kind: v.literal("variant"), variantId: VariantIdSchema, ...CartLineFields }),
  v.strictObject({ kind: v.literal("bundle"), bundleId: BundleIdSchema, ...CartLineFields }),
]);

export const CartSchema = v.strictObject({
  version: v.literal(1),
  lines: v.pipe(v.array(CartLineSchema), v.maxLength(100)),
});

export type CartPersonalizationAnswer = v.InferOutput<typeof CartPersonalizationAnswerSchema>;
export type CartLine = v.InferOutput<typeof CartLineSchema>;
export type Cart = v.InferOutput<typeof CartSchema>;
