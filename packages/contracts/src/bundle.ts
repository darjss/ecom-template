import { fromString } from "typeid-js";
import * as v from "valibot";
import {
  BundleIdSchema,
  CatalogDescriptionSchema,
  CatalogNameSchema,
  CatalogSlugSchema,
  PriceMntSchema,
  PublicCatalogImageSchema,
  SkuSchema,
  VariantIdSchema,
} from "./catalog";

const typeIdSchema = (prefix: string, label: string) =>
  v.pipe(
    v.string(),
    v.check((value) => {
      try {
        fromString(value, prefix);
        return true;
      } catch {
        return false;
      }
    }, `Invalid ${label}`),
  );

export const PersonalizationIdSchema = typeIdSchema("personalization", "Personalization ID");
export const PersonalizationValueIdSchema = typeIdSchema(
  "personalization_value",
  "Personalization Value ID",
);
export const BundleQuantitySchema = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(999));
export const PersonalizationKeySchema = v.pipe(
  v.string(),
  v.trim(),
  v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  v.maxLength(48),
);
export const PersonalizationLabelSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1),
  v.maxLength(80),
);
export const PersonalizationPositionSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
  v.maxValue(11),
);
export const PersonalizationSelectValueSchema = v.strictObject({
  id: PersonalizationValueIdSchema,
  key: PersonalizationKeySchema,
  label: PersonalizationLabelSchema,
  position: PersonalizationPositionSchema,
  state: v.picklist(["active", "archived"]),
});
const PersonalizationStateSchema = v.picklist(["active", "archived"]);
const PersonalizationDefinitionFields = {
  id: PersonalizationIdSchema,
  key: PersonalizationKeySchema,
  label: PersonalizationLabelSchema,
  position: PersonalizationPositionSchema,
  required: v.boolean(),
  state: PersonalizationStateSchema,
};

export const PersonalizationDefinitionSchema = v.variant("kind", [
  v.strictObject({
    ...PersonalizationDefinitionFields,
    kind: v.literal("text"),
    maxLength: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(240)),
    values: v.tuple([]),
  }),
  v.strictObject({
    ...PersonalizationDefinitionFields,
    kind: v.literal("single_select"),
    maxLength: v.null(),
    values: v.pipe(v.array(PersonalizationSelectValueSchema), v.minLength(1), v.maxLength(12)),
  }),
  v.strictObject({
    ...PersonalizationDefinitionFields,
    kind: v.literal("checkbox"),
    maxLength: v.null(),
    values: v.tuple([]),
  }),
]);
export const PersonalizationDefinitionsSchema = v.pipe(
  v.array(PersonalizationDefinitionSchema),
  v.maxLength(12),
);

export const BundleComponentSchema = v.strictObject({
  variantId: VariantIdSchema,
  quantity: BundleQuantitySchema,
  productName: CatalogNameSchema,
  variantLabel: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(240)),
});

export const PublicBundleDetailSchema = v.strictObject({
  id: BundleIdSchema,
  slug: CatalogSlugSchema,
  name: CatalogNameSchema,
  description: CatalogDescriptionSchema,
  priceMnt: PriceMntSchema,
  sku: SkuSchema,
  images: v.array(PublicCatalogImageSchema),
  components: v.pipe(v.array(BundleComponentSchema), v.minLength(1), v.maxLength(24)),
  personalizations: PersonalizationDefinitionsSchema,
});

export type BundleComponent = v.InferOutput<typeof BundleComponentSchema>;
export type PersonalizationDefinition = v.InferOutput<typeof PersonalizationDefinitionSchema>;
export type PublicBundleDetail = v.InferOutput<typeof PublicBundleDetailSchema>;
