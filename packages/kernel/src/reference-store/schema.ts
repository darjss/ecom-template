import {
  BundleIdSchema,
  CatalogDescriptionSchema,
  CatalogNameSchema,
  CatalogSlugSchema,
  CategoryIdSchema,
  CmsDocumentSchema,
  CollectionIdSchema,
  CommerceSettingsSchema,
  DiscountCodeSchema,
  DiscountRuleIdSchema,
  DiscountTargetSchema,
  GroupingDescriptionSchema,
  InventoryEntryIdSchema,
  InventoryQuantitySchema,
  LocationIdSchema,
  MediaAltTextSchema,
  MediaAssetIdSchema,
  MediaPositionSchema,
  OptionGroupIdSchema,
  OptionValueIdSchema,
  PersonalizationIdSchema,
  PersonalizationValueIdSchema,
  PolicyIdSchema,
  PriceMntSchema,
  ProductIdSchema,
  SkuSchema,
  StockItemIdSchema,
  compactSku,
  TagIdSchema,
  TagLabelSchema,
  VariantIdSchema,
} from "@ecom/contracts";
import { createPipeHandlers } from "dismatch";
import * as v from "valibot";

const FixtureKeySchema = v.pipe(v.string(), v.regex(/^[a-z0-9_]+$/));
const HashSchema = v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/));
const NonNegativeIntegerSchema = v.pipe(v.number(), v.integer(), v.minValue(0));
const CatalogItemIdSchema = v.union([ProductIdSchema, BundleIdSchema]);
const FixtureMediaFields = {
  key: FixtureKeySchema,
  id: MediaAssetIdSchema,
  fileName: v.pipe(v.string(), v.regex(/^[a-z0-9-]+\.webp$/)),
  sha256: HashSchema,
};
const FixtureMediaSchema = v.union([
  v.strictObject({
    ...FixtureMediaFields,
    usage: v.optional(v.literal("homepage"), "homepage"),
  }),
  v.strictObject({
    ...FixtureMediaFields,
    usage: v.optional(v.literal("catalog"), "catalog"),
    catalogItemId: CatalogItemIdSchema,
    position: MediaPositionSchema,
    altText: MediaAltTextSchema,
  }),
]);

const FixtureOptionGroupSchema = v.strictObject({
  id: OptionGroupIdSchema,
  key: FixtureKeySchema,
  label: CatalogNameSchema,
  position: NonNegativeIntegerSchema,
  values: v.array(
    v.strictObject({
      id: OptionValueIdSchema,
      key: FixtureKeySchema,
      label: CatalogNameSchema,
      position: NonNegativeIntegerSchema,
    }),
  ),
});

const FixtureVariantSchema = v.strictObject({
  id: VariantIdSchema,
  stockItemId: StockItemIdSchema,
  inventoryEntryId: InventoryEntryIdSchema,
  sku: SkuSchema,
  isDefault: v.boolean(),
  state: v.optional(v.picklist(["active", "archived"]), "active"),
  combinationKey: v.string(),
  optionValueIds: v.array(OptionValueIdSchema),
  priceOverrideMnt: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))),
  imageMediaAssetId: v.nullable(MediaAssetIdSchema),
  openingQuantity: InventoryQuantitySchema,
  grossShipWeightGrams: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100_000)),
});

const FixtureProductSchema = v.strictObject({
  key: FixtureKeySchema,
  id: ProductIdSchema,
  slug: CatalogSlugSchema,
  name: CatalogNameSchema,
  description: CatalogDescriptionSchema,
  brandText: CatalogNameSchema,
  priceMnt: PriceMntSchema,
  optionGroups: v.array(FixtureOptionGroupSchema),
  variants: v.pipe(v.array(FixtureVariantSchema), v.minLength(1)),
});

const FixtureBundleSchema = v.strictObject({
  key: FixtureKeySchema,
  id: BundleIdSchema,
  slug: CatalogSlugSchema,
  name: CatalogNameSchema,
  description: CatalogDescriptionSchema,
  brandText: CatalogNameSchema,
  priceMnt: PriceMntSchema,
  sku: SkuSchema,
  components: v.array(
    v.strictObject({
      variantId: VariantIdSchema,
      quantity: v.pipe(v.number(), v.integer(), v.minValue(1)),
    }),
  ),
});

const discountTargetReference = createPipeHandlers<v.InferOutput<typeof DiscountTargetSchema>>(
  "kind",
).match<string | null>({
  all: () => null,
  product: ({ id }) => id,
  variant: ({ id }) => id,
  category: ({ id }) => id,
  collection: ({ id }) => id,
});

export const ReferenceStoreFixtureSchema = v.pipe(
  v.strictObject({
    storeKey: v.literal("wf29-urnuun48"),
    seededAt: v.pipe(v.string(), v.isoTimestamp()),
    paymentProvider: v.literal("byl"),
    commerceSettings: CommerceSettingsSchema,
    scenarioKeys: v.tuple([
      v.literal("wf29.search.tiers"),
      v.literal("wf29.bundle.reserve"),
      v.literal("wf29.cache.live-stock"),
      v.literal("wf29.guest.qpay-transfer"),
      v.literal("wf29.cod.pickup"),
      v.literal("wf29.cancel.refund"),
      v.literal("wf29.customer.link"),
      v.literal("wf29.stock.race"),
    ]),
    products: v.pipe(v.array(FixtureProductSchema), v.length(9)),
    bundles: v.pipe(v.array(FixtureBundleSchema), v.length(2)),
    categories: v.pipe(
      v.array(
        v.strictObject({
          id: CategoryIdSchema,
          slug: CatalogSlugSchema,
          name: CatalogNameSchema,
          parentId: v.nullable(CategoryIdSchema),
          position: NonNegativeIntegerSchema,
          catalogItemIds: v.array(CatalogItemIdSchema),
        }),
      ),
      v.length(5),
    ),
    collections: v.pipe(
      v.array(
        v.strictObject({
          id: CollectionIdSchema,
          slug: CatalogSlugSchema,
          name: CatalogNameSchema,
          description: GroupingDescriptionSchema,
          catalogItemIds: v.array(CatalogItemIdSchema),
        }),
      ),
      v.length(3),
    ),
    tags: v.pipe(
      v.array(
        v.strictObject({
          id: TagIdSchema,
          label: TagLabelSchema,
          catalogItemIds: v.array(CatalogItemIdSchema),
        }),
      ),
      v.length(6),
    ),
    discounts: v.pipe(
      v.array(
        v.strictObject({
          id: DiscountRuleIdSchema,
          name: CatalogNameSchema,
          mode: v.picklist(["automatic", "code"]),
          code: v.nullable(DiscountCodeSchema),
          calculation: v.picklist(["percentage", "fixed_mnt"]),
          value: PriceMntSchema,
          minimumSubtotalMnt: NonNegativeIntegerSchema,
          globalLimit: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))),
          targets: v.pipe(v.array(DiscountTargetSchema), v.minLength(1)),
        }),
      ),
      v.length(2),
    ),
    personalizations: v.pipe(
      v.array(
        v.strictObject({
          id: PersonalizationIdSchema,
          catalogItemId: CatalogItemIdSchema,
          kind: v.picklist(["text", "single_select", "checkbox"]),
          key: FixtureKeySchema,
          label: CatalogNameSchema,
          position: NonNegativeIntegerSchema,
          required: v.boolean(),
          maxLength: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))),
          values: v.array(
            v.strictObject({
              id: PersonalizationValueIdSchema,
              key: FixtureKeySchema,
              label: CatalogNameSchema,
              position: NonNegativeIntegerSchema,
            }),
          ),
        }),
      ),
      v.length(3),
    ),
    media: v.pipe(v.array(FixtureMediaSchema), v.length(14)),
    locationId: LocationIdSchema,
    policyIds: v.strictObject({
      terms: PolicyIdSchema,
      privacy: PolicyIdSchema,
      delivery: PolicyIdSchema,
      returnsRefunds: PolicyIdSchema,
      payment: PolicyIdSchema,
    }),
    cmsDocuments: v.pipe(v.array(CmsDocumentSchema), v.length(7)),
  }),
  v.check((fixture) => {
    const products = new Set(fixture.products.map(({ id }) => id));
    const bundles = new Set(fixture.bundles.map(({ id }) => id));
    const catalogItems = new Set([...products, ...bundles]);
    const variantIds = new Set(
      fixture.products.flatMap(({ variants: productVariants }) =>
        productVariants.map(({ id }) => id),
      ),
    );
    const categories = new Set(fixture.categories.map(({ id }) => id));
    const collections = new Set(fixture.collections.map(({ id }) => id));
    const references = new Set([...catalogItems, ...variantIds, ...categories, ...collections]);
    const identifiers = [
      ...catalogItems,
      ...variantIds,
      ...fixture.products.flatMap(({ variants: productVariants }) =>
        productVariants.flatMap(({ stockItemId, inventoryEntryId }) => [
          stockItemId,
          inventoryEntryId,
        ]),
      ),
      ...categories,
      ...collections,
      ...fixture.tags.map(({ id }) => id),
      ...fixture.discounts.map(({ id }) => id),
      ...fixture.personalizations.flatMap(({ id: personalizationId, values }) => [
        personalizationId,
        ...values.map(({ id: valueId }) => valueId),
      ]),
      ...fixture.media.map(({ id }) => id),
    ];
    const skus = [
      ...fixture.products.flatMap(({ variants: productVariants }) =>
        productVariants.map(({ sku }) => sku),
      ),
      ...fixture.bundles.map(({ sku }) => sku),
    ];
    const compactSkus = skus.map(compactSku);
    return (
      new Set(identifiers).size === identifiers.length &&
      new Set(skus).size === skus.length &&
      new Set(compactSkus).size === compactSkus.length &&
      fixture.products.every((product) => {
        const optionValues = new Set(
          product.optionGroups.flatMap(({ values }) => values.map(({ id }) => id)),
        );
        return product.variants.every(({ optionValueIds }) =>
          optionValueIds.every((id) => optionValues.has(id)),
        );
      }) &&
      fixture.bundles.every(({ components }) =>
        components.every(({ variantId }) => variantIds.has(variantId)),
      ) &&
      fixture.categories.every(
        ({ parentId, catalogItemIds }) =>
          (parentId === null || categories.has(parentId)) &&
          catalogItemIds.every((id) => catalogItems.has(id)),
      ) &&
      fixture.collections.every(({ catalogItemIds }) =>
        catalogItemIds.every((id) => catalogItems.has(id)),
      ) &&
      fixture.tags.every(({ catalogItemIds }) =>
        catalogItemIds.every((id) => catalogItems.has(id)),
      ) &&
      fixture.personalizations.every(({ catalogItemId }) => catalogItems.has(catalogItemId)) &&
      fixture.media.every(
        (media) => media.usage === "homepage" || catalogItems.has(media.catalogItemId),
      ) &&
      fixture.discounts.every(({ targets }) =>
        targets.every((target) => {
          const reference = discountTargetReference(target);
          return reference === null || references.has(reference);
        }),
      )
    );
  }, "Reference Store fixture relationships are inconsistent"),
);

export type ReferenceStoreFixture = v.InferOutput<typeof ReferenceStoreFixtureSchema>;
