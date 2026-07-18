import { fromString, typeidUnboxed } from "typeid-js";
import * as v from "valibot";
import { ContractClientErrorSchema, NetworkClientErrorSchema } from "./client-error";
import {
  BundleIdSchema,
  CachePurgeDebtSchema,
  CachePurgeRequestIdSchema,
  CatalogImageSchema,
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
const personalizationDefinitionSchemas = (
  id: typeof PersonalizationIdSchema | v.OptionalSchema<typeof PersonalizationIdSchema, undefined>,
  state:
    | v.PicklistSchema<["active", "archived"], undefined>
    | v.OptionalSchema<v.PicklistSchema<["active", "archived"], undefined>, "active">,
  selectValue:
    | typeof PersonalizationSelectValueSchema
    | v.StrictObjectSchema<
        {
          id: v.OptionalSchema<typeof PersonalizationValueIdSchema, undefined>;
          key: typeof PersonalizationKeySchema;
          label: typeof PersonalizationLabelSchema;
          position: typeof PersonalizationPositionSchema;
          state: v.OptionalSchema<v.PicklistSchema<["active", "archived"], undefined>, "active">;
        },
        undefined
      >,
) => {
  const fields = {
    id,
    key: PersonalizationKeySchema,
    label: PersonalizationLabelSchema,
    position: PersonalizationPositionSchema,
    required: v.boolean(),
    state,
  };
  return [
    v.strictObject({
      ...fields,
      kind: v.literal("text"),
      maxLength: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(240)),
      values: v.tuple([]),
    }),
    v.strictObject({
      ...fields,
      kind: v.literal("single_select"),
      maxLength: v.null(),
      values: v.pipe(v.array(selectValue), v.minLength(1), v.maxLength(12)),
    }),
    v.strictObject({
      ...fields,
      kind: v.literal("checkbox"),
      maxLength: v.null(),
      values: v.tuple([]),
    }),
  ] as const;
};

const PersonalizationStateSchema = v.picklist(["active", "archived"]);
export const PersonalizationDefinitionSchema = v.variant(
  "kind",
  personalizationDefinitionSchemas(
    PersonalizationIdSchema,
    PersonalizationStateSchema,
    PersonalizationSelectValueSchema,
  ),
);
export const PersonalizationDefinitionsSchema = v.pipe(
  v.array(PersonalizationDefinitionSchema),
  v.maxLength(12),
);

const PersonalizationValueDraftSchema = v.strictObject({
  id: v.optional(PersonalizationValueIdSchema),
  key: PersonalizationKeySchema,
  label: PersonalizationLabelSchema,
  position: PersonalizationPositionSchema,
  state: v.optional(PersonalizationStateSchema, "active"),
});
export const PersonalizationDefinitionDraftSchema = v.variant(
  "kind",
  personalizationDefinitionSchemas(
    v.optional(PersonalizationIdSchema),
    v.optional(PersonalizationStateSchema, "active"),
    PersonalizationValueDraftSchema,
  ),
);
export const SavePersonalizationsInputSchema = v.strictObject({
  definitions: v.pipe(
    v.array(PersonalizationDefinitionDraftSchema),
    v.maxLength(12),
    v.check(
      (definitions) =>
        definitions.every(
          (definition) =>
            definition.kind !== "single_select" ||
            definition.state !== "active" ||
            !definition.required ||
            definition.values.some((value) => value.state === "active"),
        ),
      "An active required single-select definition needs an active value",
    ),
  ),
});
export const PersonalizationListResponseSchema = v.strictObject({
  data: PersonalizationDefinitionsSchema,
});
export const PersonalizationMutationResponseSchema = v.strictObject({
  data: v.strictObject({
    definitions: PersonalizationDefinitionsSchema,
    cache: v.picklist(["not_required", "purged", "committed_but_not_purged"]),
    cachePurgeRequestId: CachePurgeRequestIdSchema,
  }),
});

export const BundleComponentSchema = v.strictObject({
  variantId: VariantIdSchema,
  quantity: BundleQuantitySchema,
  productName: CatalogNameSchema,
  variantLabel: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(240)),
});
export const BundleSchema = v.strictObject({
  id: BundleIdSchema,
  slug: CatalogSlugSchema,
  state: v.picklist(["draft", "published", "archived"]),
  name: CatalogNameSchema,
  description: v.pipe(v.string(), v.maxLength(5_000)),
  priceMnt: PriceMntSchema,
  sku: SkuSchema,
  cachePurgeDebt: v.nullable(CachePurgeDebtSchema),
  components: v.pipe(v.array(BundleComponentSchema), v.maxLength(24)),
  personalizations: PersonalizationDefinitionsSchema,
  images: v.array(CatalogImageSchema),
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
  updatedAt: v.pipe(v.string(), v.isoTimestamp()),
});
export const BundleListResponseSchema = v.strictObject({ data: v.array(BundleSchema) });
export const BundleMutationResponseSchema = v.strictObject({
  data: v.strictObject({
    bundle: BundleSchema,
    cache: v.picklist(["not_required", "purged", "committed_but_not_purged"]),
    cachePurgeRequestId: CachePurgeRequestIdSchema,
  }),
});
export const CreateBundleInputSchema = v.strictObject({
  name: CatalogNameSchema,
  slug: CatalogSlugSchema,
  description: v.optional(v.pipe(v.string(), v.maxLength(5_000)), ""),
  priceMnt: PriceMntSchema,
});
export const UpdateBundleInputSchema = v.strictObject({
  name: CatalogNameSchema,
  slug: CatalogSlugSchema,
  description: v.pipe(v.string(), v.maxLength(5_000)),
  priceMnt: PriceMntSchema,
});
export const SaveBundleComponentsInputSchema = v.strictObject({
  components: v.pipe(
    v.array(v.strictObject({ variantId: VariantIdSchema, quantity: BundleQuantitySchema })),
    v.minLength(1),
    v.maxLength(24),
  ),
});
export const BundleFailureReasonSchema = v.picklist([
  "duplicate_slug",
  "not_found",
  "invalid_lifecycle",
  "invalid_publication",
  "invalid_component",
  "duplicate_component",
  "immutable_components",
  "slug_locked",
  "published_bundle_dependency",
  "published_cms_dependency",
  "invalid_personalization",
  "committed_but_not_purged",
]);
export const BundleApiErrorSchema = v.strictObject({
  error: v.strictObject({
    code: v.picklist([
      "unauthorized",
      "forbidden",
      "not_found",
      "validation",
      "conflict",
      "unavailable",
    ]),
    message: v.string(),
    reason: v.optional(BundleFailureReasonSchema),
  }),
});
export const BundleClientErrorSchema = v.variant("kind", [
  NetworkClientErrorSchema,
  ContractClientErrorSchema,
  v.strictObject({
    kind: v.literal("api"),
    error: BundleApiErrorSchema.entries.error,
  }),
]);

export const PublicBundleDetailSchema = v.strictObject({
  id: BundleIdSchema,
  slug: CatalogSlugSchema,
  name: CatalogNameSchema,
  description: v.pipe(v.string(), v.maxLength(5_000)),
  priceMnt: PriceMntSchema,
  sku: SkuSchema,
  images: v.array(PublicCatalogImageSchema),
  components: v.pipe(v.array(BundleComponentSchema), v.minLength(1), v.maxLength(24)),
  personalizations: PersonalizationDefinitionsSchema,
});

export const PersonalizationAnswerSchema = v.variant("kind", [
  v.strictObject({ key: PersonalizationKeySchema, kind: v.literal("text"), value: v.string() }),
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
export const PersonalizationAnswersSchema = v.pipe(
  v.array(PersonalizationAnswerSchema),
  v.maxLength(12),
);
export const BundleDemandSchema = v.strictObject({
  variantId: VariantIdSchema,
  quantity: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(999_000)),
});

export type Bundle = v.InferOutput<typeof BundleSchema>;
export type BundleComponent = v.InferOutput<typeof BundleComponentSchema>;
export type CreateBundleInput = v.InferOutput<typeof CreateBundleInputSchema>;
export type UpdateBundleInput = v.InferOutput<typeof UpdateBundleInputSchema>;
export type SaveBundleComponentsInput = v.InferOutput<typeof SaveBundleComponentsInputSchema>;
export type SavePersonalizationsInput = v.InferOutput<typeof SavePersonalizationsInputSchema>;
export type PersonalizationDefinition = v.InferOutput<typeof PersonalizationDefinitionSchema>;
export type PersonalizationAnswer = v.InferOutput<typeof PersonalizationAnswerSchema>;
export type PublicBundleDetail = v.InferOutput<typeof PublicBundleDetailSchema>;
export type BundleDemand = v.InferOutput<typeof BundleDemandSchema>;
export type BundleClientError = v.InferOutput<typeof BundleClientErrorSchema>;

export const createPersonalizationId = () => typeidUnboxed("personalization");
export const createPersonalizationValueId = () => typeidUnboxed("personalization_value");
