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

const FixtureSchema = v.pipe(
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

const ids = {
  product: {
    p01: "product_01kxxjdsr4fk5v5cpmf12zrjkz",
    p02: "product_01kxxjdsr5fk5v5cpza07xvcvw",
    p03: "product_01kxxjdsr5fk5v5cq7ba97b47g",
    p04: "product_01kxxjdsr5fk5v5cqdp788vpbp",
    p05: "product_01kxxjdsr6fk5v5cqjdm4fj64k",
    p06: "product_01kxxjdsr6fk5v5cqz550j8303",
    p07: "product_01kxxjdsr6fk5v5cr40s6n1b10",
    p08: "product_01kxxjdsr6fk5v5cr8x01df3dj",
    p09: "product_01kxxjdsr6fk5v5crgh50xd38v",
  },
  bundle: {
    b01: "bundle_01kxxjdsr6fk5v5cryg79hzxwt",
    b02: "bundle_01kxxjdsr6fk5v5cs457qzmqpb",
  },
  variant: {
    p01: "variant_01kxxjdsr6fk5v5cs8dmj1x1qt",
    p02: "variant_01kxxjdsr6fk5v5csq8z0yxg8r",
    p03: "variant_01kxxjdsr6fk5v5csx1ewey6sj",
    p04: "variant_01kxxjdsr6fk5v5ct4yzp46m1v",
    p05Default: "variant_01kxxjdsr6fk5v5ct6p4a8x2bn",
    p05_800: "variant_01kxxjdsr6fk5v5ct8h6n0kwqe",
    p05_1600: "variant_01kxxjdsr6fk5v5ctp523zcrzs",
    p06: "variant_01kxxjdsr6fk5v5cty2q4ztgk4",
    p07Default: "variant_01kxxjdsr6fk5v5cv1h8k2p4mn",
    p07_s_sand: "variant_01kxxjdsr6fk5v5cv4mzqveafs",
    p07_l_sand: "variant_01kxxjdsr6fk5v5cva5mvd8kp3",
    p07_s_sky: "variant_01kxxjdsr6fk5v5cvq7r33gm3z",
    p07_l_sky: "variant_01kxxjdsr6fk5v5cvsey053gp9",
    p08: "variant_01kxxjdsr6fk5v5cw22r1zme3s",
    p09: "variant_01kxxjdsr6fk5v5cweag1p9m7n",
  },
  stock: {
    p01: "stock_item_01kxxjdsr6fk5v5cwmyh7ndz4x",
    p02: "stock_item_01kxxjdsr7fk5v5cwt2e86xmxg",
    p03: "stock_item_01kxxjdsr7fk5v5cx3rnxrpd2b",
    p04: "stock_item_01kxxjdsr7fk5v5cxe8j1k6p20",
    p05Default: "stock_item_01kxxjdsr7fk5v5cxf2a8m4q6r",
    p05_800: "stock_item_01kxxjdsr7fk5v5cxhqxhg0xsx",
    p05_1600: "stock_item_01kxxjdsr7fk5v5cxztw12j034",
    p06: "stock_item_01kxxjdsr7fk5v5cy0sm73yx6e",
    p07Default: "stock_item_01kxxjdsr7fk5v5cy4b6n8q2st",
    p07_s_sand: "stock_item_01kxxjdsr7fk5v5cy9gp7ngjh6",
    p07_l_sand: "stock_item_01kxxjdsr7fk5v5cygp51dwfbk",
    p07_s_sky: "stock_item_01kxxjdsr7fk5v5cyrh2cbr4yw",
    p07_l_sky: "stock_item_01kxxjdsr7fk5v5cz0xh5w4azd",
    p08: "stock_item_01kxxjdsr7fk5v5czfgwakepqq",
    p09: "stock_item_01kxxjdsr7fk5v5czk30de9kcz",
  },
  inventory: {
    p01: "inventory_entry_01kxxjdsr7fk5v5czxdj7bqakq",
    p02: "inventory_entry_01kxxjdsr7fk5v5d046exg32xb",
    p03: "inventory_entry_01kxxjdsr7fk5v5d0df1ksx2wr",
    p04: "inventory_entry_01kxxjdsr7fk5v5d0k7w989mdj",
    p05Default: "inventory_entry_01kxxjdsr7fk5v5d0q4a6m8r2t",
    p05_800: "inventory_entry_01kxxjdsr7fk5v5d0zd830qejt",
    p05_1600: "inventory_entry_01kxxjdsr7fk5v5d15xhb0mjfq",
    p06: "inventory_entry_01kxxjdsr7fk5v5d1f5ptxarbc",
    p07Default: "inventory_entry_01kxxjdsr7fk5v5d1h4k6m8q2s",
    p07_s_sand: "inventory_entry_01kxxjdsr7fk5v5d1jdvwy77f6",
    p07_l_sand: "inventory_entry_01kxxjdsr7fk5v5d1ytx2ramgd",
    p07_s_sky: "inventory_entry_01kxxjdsr7fk5v5d22f0yyhjvh",
    p07_l_sky: "inventory_entry_01kxxjdsr7fk5v5d2b78y6tzh2",
    p08: "inventory_entry_01kxxjdsr7fk5v5d2mfjncb420",
    p09: "inventory_entry_01kxxjdsr7fk5v5d2yv0yf5vpa",
  },
  optionGroup: {
    p05Weight: "option_group_01kxxjdsr7fk5v5d35y9ksgw8d",
    p07Size: "option_group_01kxxjdsr7fk5v5d3cftgz9mgh",
    p07Color: "option_group_01kxxjdsr7fk5v5d3mag2xa4q6",
  },
  optionValue: {
    p05_800: "option_value_01kxxjdsr7fk5v5d3sbjb80dmd",
    p05_1600: "option_value_01kxxjdsr7fk5v5d43axn2pyt7",
    p07Small: "option_value_01kxxjdsr7fk5v5d4eycj1yqm1",
    p07Large: "option_value_01kxxjdsr7fk5v5d4qf39e65g8",
    p07Sand: "option_value_01kxxjdsr7fk5v5d4wwxm68v3w",
    p07Sky: "option_value_01kxxjdsr7fk5v5d50xyx871ga",
  },
  personalization: {
    coverName: "personalization_01kxxjdsr7fk5v5d5f87bj16hn",
    ribbonColor: "personalization_01kxxjdsr7fk5v5d5jzst8cggt",
    withoutPriceTag: "personalization_01kxxjdsr8fk5v5d5sp6pehvd6",
  },
  personalizationValue: {
    ribbonSand: "personalization_value_01kxxjdsr8fk5v5d67mbs8eb8b",
    ribbonSky: "personalization_value_01kxxjdsr8fk5v5d6fycx09b04",
    ribbonLeaf: "personalization_value_01kxxjdsr8fk5v5d6hnjjvekdd",
  },
  category: {
    food: "category_01kxxjdsr8fk5v5d6sm27c24hk",
    household: "category_01kxxjdsr8fk5v5d77czrydnd4",
    cleaning: "category_01kxxjdsr8fk5v5d7ahr5swmk9",
    storage: "category_01kxxjdsr8fk5v5d7kdr4h9b4d",
    stationery: "category_01kxxjdsr8fk5v5d7txx47gb8q",
  },
  collection: {
    everyday: "collection_01kxxjdsr8fk5v5d81pxaa4sec",
    newHome: "collection_01kxxjdsr8fk5v5d8e43cz1dec",
    giftReady: "collection_01kxxjdsr8fk5v5d8gvnsmx7z4",
  },
  tag: {
    staples: "tag_01kxxjdsr8fk5v5d8xbapbx7vr",
    chilled: "tag_01kxxjdsr8fk5v5d964zq2dd6x",
    cleaning: "tag_01kxxjdsr8fk5v5d9dbfqefc39",
    reusable: "tag_01kxxjdsr8fk5v5d9mdr09k2ny",
    gift: "tag_01kxxjdsr8fk5v5d9r2z54p2hy",
    referenceChoice: "tag_01kxxjdsr8fk5v5da2h7vbx2mf",
  },
  discount: {
    d01: "discount_01kxxjdsr8fk5v5dadbpjvpyky",
    d02: "discount_01kxxjdsr8fk5v5dak53eseesb",
  },
  media: {
    hero: "media_01kxxjdsr8fk5v5dar3qy4c576",
    p01: "media_01kxxjdsr8fk5v5db0kyrsnjy6",
    p02: "media_01kxxjdsr8fk5v5dbbbjhch47r",
    p03: "media_01kxxjdsr8fk5v5dbh5kz4s7y1",
    p04: "media_01kxxjdsr8fk5v5dbzszyjz5v6",
    p05_800: "media_01kxxjdsr8fk5v5dc3hejztz1y",
    p05_1600: "media_01kxxjdsr8fk5v5dcbjg4y1gf8",
    p06: "media_01kxxjdsr8fk5v5dcj281cx3sh",
    p07Sand: "media_01kxxjdsr8fk5v5dctwks18cy3",
    p07Sky: "media_01kxxjdsr8fk5v5dd7cz9vheej",
    p08: "media_01kxxjdsr8fk5v5dd8zkgkwzsb",
    p09: "media_01kxxjdsr8fk5v5ddn9sygmj6b",
    b01: "media_01kxxjdsr8fk5v5ddvdb7hhjmd",
    b02: "media_01kxxjdsr8fk5v5de755qr0bfc",
  },
  location: "location_01kxxjdsr8fk5v5defwzk9cgdv",
  policy: {
    terms: "policy_01kxxjdsr8fk5v5dejp3t1w8c0",
    privacy: "policy_01kxxjdsr8fk5v5dewzycsm845",
    delivery: "policy_01kxxjdsr8fk5v5df2ae5ezb39",
    returnsRefunds: "policy_01kxxjdsr8fk5v5dfe9gebsdf0",
    payment: "policy_01kxxjdsr9fk5v5dfg53hxmt61",
  },
} as const;

const products = [
  {
    key: "p01",
    id: ids.product.p01,
    slug: "ugluunii-tsagaan-budaa-1kg",
    name: "Өглөөний цагаан будаа, 1 кг",
    description: "Өдөр тутмын хоолонд зориулсан, дахин битүүмжилдэг ууттай цагаан будаа.",
    brandText: "Ө48 Өдөр",
    priceMnt: 5_400,
    optionGroups: [],
    variants: [
      {
        id: ids.variant.p01,
        stockItemId: ids.stock.p01,
        inventoryEntryId: ids.inventory.p01,
        sku: "WF29-RICE-1K",
        isDefault: true,
        combinationKey: "__default__",
        optionValueIds: [],
        priceOverrideMnt: null,
        imageMediaAssetId: ids.media.p01,
        openingQuantity: 20,
        grossShipWeightGrams: 1_050,
      },
    ],
  },
  {
    key: "p02",
    id: ids.product.p02,
    slug: "dotoodyn-i-zergiin-guril-1kg",
    name: "Дотоодын I зэргийн гурил, 1 кг",
    description: "Банш, гурилан хоол болон өдөр тутмын жигнэлтэд хэрэглэх савласан гурил.",
    brandText: "Ө48 Өдөр",
    priceMnt: 2_900,
    optionGroups: [],
    variants: [
      {
        id: ids.variant.p02,
        stockItemId: ids.stock.p02,
        inventoryEntryId: ids.inventory.p02,
        sku: "WF29-FLOUR-1K",
        isDefault: true,
        combinationKey: "__default__",
        optionValueIds: [],
        priceOverrideMnt: null,
        imageMediaAssetId: ids.media.p02,
        openingQuantity: 30,
        grossShipWeightGrams: 1_050,
      },
    ],
  },
  {
    key: "p03",
    id: ids.product.p03,
    slug: "savlasan-suu-1l",
    name: "Савласан сүү, 1 л",
    description: "Хөргөлттэй хадгалах, өдөр тутмын хэрэглээний савласан сүү.",
    brandText: "Ө48 Өдөр",
    priceMnt: 5_500,
    optionGroups: [],
    variants: [
      {
        id: ids.variant.p03,
        stockItemId: ids.stock.p03,
        inventoryEntryId: ids.inventory.p03,
        sku: "WF29-MILK-1L",
        isDefault: true,
        combinationKey: "__default__",
        optionValueIds: [],
        priceOverrideMnt: null,
        imageMediaAssetId: ids.media.p03,
        openingQuantity: 3,
        grossShipWeightGrams: 1_080,
      },
    ],
  },
  {
    key: "p04",
    id: ids.product.p04,
    slug: "urgamlyn-tos-1l",
    name: "Ургамлын тос, 1 л",
    description: "Хоол хийхэд зориулсан нэг литрийн савлагаатай ургамлын тос.",
    brandText: "Ө48 Өдөр",
    priceMnt: 12_900,
    optionGroups: [],
    variants: [
      {
        id: ids.variant.p04,
        stockItemId: ids.stock.p04,
        inventoryEntryId: ids.inventory.p04,
        sku: "WF29-OIL-1L",
        isDefault: true,
        combinationKey: "__default__",
        optionValueIds: [],
        priceOverrideMnt: null,
        imageMediaAssetId: ids.media.p04,
        openingQuantity: 0,
        grossShipWeightGrams: 1_050,
      },
    ],
  },
  {
    key: "p05",
    id: ids.product.p05,
    slug: "unergui-ugaalgyn-nuntag",
    name: "Үнэргүй угаалгын нунтаг",
    description: "Өдөр тутмын хувцас угаалтад зориулсан хоёр хэмжээтэй нунтаг.",
    brandText: "Ө48 Гэр",
    priceMnt: 9_500,
    optionGroups: [
      {
        id: ids.optionGroup.p05Weight,
        key: "weight",
        label: "Жин",
        position: 0,
        values: [
          { id: ids.optionValue.p05_800, key: "800g", label: "800 г", position: 0 },
          { id: ids.optionValue.p05_1600, key: "1600g", label: "1.6 кг", position: 1 },
        ],
      },
    ],
    variants: [
      {
        id: ids.variant.p05Default,
        stockItemId: ids.stock.p05Default,
        inventoryEntryId: ids.inventory.p05Default,
        sku: "WF29-WASH-DEFAULT",
        isDefault: true,
        state: "archived",
        combinationKey: "__default__",
        optionValueIds: [],
        priceOverrideMnt: null,
        imageMediaAssetId: ids.media.p05_800,
        openingQuantity: 0,
        grossShipWeightGrams: 850,
      },
      {
        id: ids.variant.p05_800,
        stockItemId: ids.stock.p05_800,
        inventoryEntryId: ids.inventory.p05_800,
        sku: "WF29-WASH-800",
        isDefault: false,
        combinationKey: ids.optionValue.p05_800,
        optionValueIds: [ids.optionValue.p05_800],
        priceOverrideMnt: null,
        imageMediaAssetId: ids.media.p05_800,
        openingQuantity: 8,
        grossShipWeightGrams: 850,
      },
      {
        id: ids.variant.p05_1600,
        stockItemId: ids.stock.p05_1600,
        inventoryEntryId: ids.inventory.p05_1600,
        sku: "WF29-WASH-1600",
        isDefault: false,
        combinationKey: ids.optionValue.p05_1600,
        optionValueIds: [ids.optionValue.p05_1600],
        priceOverrideMnt: 17_900,
        imageMediaAssetId: ids.media.p05_1600,
        openingQuantity: 0,
        grossShipWeightGrams: 1_680,
      },
    ],
  },
  {
    key: "p06",
    id: ids.product.p06,
    slug: "ayaga-tavag-ugaagch-shingen-500ml",
    name: "Аяга таваг угаагч шингэн, 500 мл",
    description: "Гал тогооны өдөр тутмын цэвэрлэгээнд зориулсан шингэн.",
    brandText: "Ө48 Гэр",
    priceMnt: 7_500,
    optionGroups: [],
    variants: [
      {
        id: ids.variant.p06,
        stockItemId: ids.stock.p06,
        inventoryEntryId: ids.inventory.p06,
        sku: "WF29-DISH-500",
        isDefault: true,
        combinationKey: "__default__",
        optionValueIds: [],
        priceOverrideMnt: null,
        imageMediaAssetId: ids.media.p06,
        openingQuantity: 12,
        grossShipWeightGrams: 560,
      },
    ],
  },
  {
    key: "p07",
    id: ids.product.p07,
    slug: "udur-tutmyn-daavuun-tsunkh",
    name: "Өдөр тутмын даавуун цүнх",
    description: "Хоёр хэмжээ, хоёр өнгөөс сонгох, эвхэж авч явах даавуун цүнх.",
    brandText: "Ө48 Гэр",
    priceMnt: 18_900,
    optionGroups: [
      {
        id: ids.optionGroup.p07Size,
        key: "size",
        label: "Хэмжээ",
        position: 0,
        values: [
          { id: ids.optionValue.p07Small, key: "small", label: "Жижиг", position: 0 },
          { id: ids.optionValue.p07Large, key: "large", label: "Том", position: 1 },
        ],
      },
      {
        id: ids.optionGroup.p07Color,
        key: "color",
        label: "Өнгө",
        position: 1,
        values: [
          { id: ids.optionValue.p07Sand, key: "sand", label: "Элсний шар", position: 0 },
          { id: ids.optionValue.p07Sky, key: "sky", label: "Тэнгэрийн хөх", position: 1 },
        ],
      },
    ],
    variants: [
      {
        id: ids.variant.p07Default,
        stockItemId: ids.stock.p07Default,
        inventoryEntryId: ids.inventory.p07Default,
        sku: "WF29-TOTE-DEFAULT",
        isDefault: true,
        state: "archived",
        combinationKey: "__default__",
        optionValueIds: [],
        priceOverrideMnt: null,
        imageMediaAssetId: ids.media.p07Sand,
        openingQuantity: 0,
        grossShipWeightGrams: 190,
      },
      {
        id: ids.variant.p07_s_sand,
        stockItemId: ids.stock.p07_s_sand,
        inventoryEntryId: ids.inventory.p07_s_sand,
        sku: "WF29-TOTE-S-SAND",
        isDefault: false,
        combinationKey: [ids.optionValue.p07Small, ids.optionValue.p07Sand].toSorted().join("|"),
        optionValueIds: [ids.optionValue.p07Small, ids.optionValue.p07Sand],
        priceOverrideMnt: null,
        imageMediaAssetId: ids.media.p07Sand,
        openingQuantity: 7,
        grossShipWeightGrams: 190,
      },
      {
        id: ids.variant.p07_l_sand,
        stockItemId: ids.stock.p07_l_sand,
        inventoryEntryId: ids.inventory.p07_l_sand,
        sku: "WF29-TOTE-L-SAND",
        isDefault: false,
        combinationKey: [ids.optionValue.p07Large, ids.optionValue.p07Sand].toSorted().join("|"),
        optionValueIds: [ids.optionValue.p07Large, ids.optionValue.p07Sand],
        priceOverrideMnt: 22_900,
        imageMediaAssetId: ids.media.p07Sand,
        openingQuantity: 2,
        grossShipWeightGrams: 260,
      },
      {
        id: ids.variant.p07_s_sky,
        stockItemId: ids.stock.p07_s_sky,
        inventoryEntryId: ids.inventory.p07_s_sky,
        sku: "WF29-TOTE-S-SKY",
        isDefault: false,
        combinationKey: [ids.optionValue.p07Small, ids.optionValue.p07Sky].toSorted().join("|"),
        optionValueIds: [ids.optionValue.p07Small, ids.optionValue.p07Sky],
        priceOverrideMnt: null,
        imageMediaAssetId: ids.media.p07Sky,
        openingQuantity: 4,
        grossShipWeightGrams: 190,
      },
      {
        id: ids.variant.p07_l_sky,
        stockItemId: ids.stock.p07_l_sky,
        inventoryEntryId: ids.inventory.p07_l_sky,
        sku: "WF29-TOTE-L-SKY",
        isDefault: false,
        combinationKey: [ids.optionValue.p07Large, ids.optionValue.p07Sky].toSorted().join("|"),
        optionValueIds: [ids.optionValue.p07Large, ids.optionValue.p07Sky],
        priceOverrideMnt: 22_900,
        imageMediaAssetId: ids.media.p07Sky,
        openingQuantity: 0,
        grossShipWeightGrams: 260,
      },
    ],
  },
  {
    key: "p08",
    id: ids.product.p08,
    slug: "nertei-temdegleliin-devter",
    name: "Нэртэй тэмдэглэлийн дэвтэр",
    description: "Нүүрний богино бичвэр, боодлын туузыг сонгон бэлдэх дэвтэр.",
    brandText: "Ө48 Бэлэг",
    priceMnt: 14_900,
    optionGroups: [],
    variants: [
      {
        id: ids.variant.p08,
        stockItemId: ids.stock.p08,
        inventoryEntryId: ids.inventory.p08,
        sku: "WF29-Ө-001",
        isDefault: true,
        combinationKey: "__default__",
        optionValueIds: [],
        priceOverrideMnt: null,
        imageMediaAssetId: ids.media.p08,
        openingQuantity: 15,
        grossShipWeightGrams: 320,
      },
    ],
  },
  {
    key: "p09",
    id: ids.product.p09,
    slug: "yooton-sakhar-500g",
    name: "Ёотон сахар, 500 г",
    description: "Цай, кофенд хэрэглэх жижиг савлагаатай ёотон сахар.",
    brandText: "Ө48 Өдөр",
    priceMnt: 2_700,
    optionGroups: [],
    variants: [
      {
        id: ids.variant.p09,
        stockItemId: ids.stock.p09,
        inventoryEntryId: ids.inventory.p09,
        sku: "WF29-YO-500",
        isDefault: true,
        combinationKey: "__default__",
        optionValueIds: [],
        priceOverrideMnt: null,
        imageMediaAssetId: ids.media.p09,
        openingQuantity: 10,
        grossShipWeightGrams: 530,
      },
    ],
  },
] as const;

const bundles = [
  {
    key: "b01",
    id: ids.bundle.b01,
    slug: "tseverlegeenii-khoslol",
    name: "Цэвэрлэгээний хослол",
    description: "Угаалгын нунтаг 800 г болон аяга таваг угаагч шингэний тогтмол багц.",
    brandText: "Ө48 Гэр",
    priceMnt: 15_900,
    sku: "WF29-BND-CLEAN",
    components: [
      { variantId: ids.variant.p05_800, quantity: 1 },
      { variantId: ids.variant.p06, quantity: 1 },
    ],
  },
  {
    key: "b02",
    id: ids.bundle.b02,
    slug: "gal-togoony-nuuts-bagts",
    name: "Гал тогооны нөөц багц",
    description: "Хоёр будаа, нэг гурил, нэг ургамлын тос бүхий тогтмол багц.",
    brandText: "Ө48 Гэр",
    priceMnt: 24_900,
    sku: "WF29-BND-PANTRY",
    components: [
      { variantId: ids.variant.p01, quantity: 2 },
      { variantId: ids.variant.p02, quantity: 1 },
      { variantId: ids.variant.p04, quantity: 1 },
    ],
  },
] as const;

const categories = [
  {
    id: ids.category.food,
    slug: "khuns",
    name: "Хүнс",
    parentId: null,
    position: 0,
    catalogItemIds: [
      ids.product.p01,
      ids.product.p02,
      ids.product.p03,
      ids.product.p04,
      ids.product.p09,
      ids.bundle.b02,
    ],
  },
  {
    id: ids.category.household,
    slug: "ger-akhui",
    name: "Гэр ахуй",
    parentId: null,
    position: 1,
    catalogItemIds: [],
  },
  {
    id: ids.category.cleaning,
    slug: "tseverlegee",
    name: "Цэвэрлэгээ",
    parentId: ids.category.household,
    position: 0,
    catalogItemIds: [ids.product.p05, ids.product.p06, ids.bundle.b01],
  },
  {
    id: ids.category.storage,
    slug: "tsunkh-khadgalalt",
    name: "Цүнх, хадгалалт",
    parentId: ids.category.household,
    position: 1,
    catalogItemIds: [ids.product.p07],
  },
  {
    id: ids.category.stationery,
    slug: "bichig-khereg",
    name: "Бичиг хэрэг",
    parentId: ids.category.household,
    position: 2,
    catalogItemIds: [ids.product.p08],
  },
] as const;

const collections = [
  {
    id: ids.collection.everyday,
    slug: "udur-tutmyn-kheregtsee",
    name: "Өдөр тутмын хэрэгцээ",
    description: "Өдөр бүр сонгох хүнс, гэр ахуйн жишиг бараа.",
    catalogItemIds: [
      ids.product.p01,
      ids.product.p02,
      ids.product.p03,
      ids.product.p04,
      ids.product.p05,
      ids.product.p06,
      ids.product.p07,
      ids.product.p09,
      ids.bundle.b01,
    ],
  },
  {
    id: ids.collection.newHome,
    slug: "shine-ger",
    name: "Шинэ гэр",
    description: "Шинэ гэрт хэрэг болох цэвэрлэгээ, хадгалалт, бэлгийн сонголт.",
    catalogItemIds: [
      ids.product.p05,
      ids.product.p06,
      ids.product.p07,
      ids.product.p08,
      ids.bundle.b01,
    ],
  },
  {
    id: ids.collection.giftReady,
    slug: "beleglekhed-belen",
    name: "Бэлэглэхэд бэлэн",
    description: "Шууд бэлдэх жижиг бэлгийн сонголтууд.",
    catalogItemIds: [ids.product.p07, ids.product.p08],
  },
] as const;

const tags = [
  {
    id: ids.tag.staples,
    label: "Үндсэн хүнс",
    catalogItemIds: [
      ids.product.p01,
      ids.product.p02,
      ids.product.p04,
      ids.product.p09,
      ids.bundle.b02,
    ],
  },
  { id: ids.tag.chilled, label: "Хөргөлттэй", catalogItemIds: [ids.product.p03] },
  {
    id: ids.tag.cleaning,
    label: "Цэвэрлэгээ",
    catalogItemIds: [ids.product.p05, ids.product.p06, ids.bundle.b01],
  },
  { id: ids.tag.reusable, label: "Дахин ашиглана", catalogItemIds: [ids.product.p07] },
  { id: ids.tag.gift, label: "Бэлэг", catalogItemIds: [ids.product.p07, ids.product.p08] },
  {
    id: ids.tag.referenceChoice,
    label: "Жишиг сонголт",
    catalogItemIds: [ids.product.p01, ids.product.p03, ids.product.p05, ids.product.p07],
  },
] as const;

const media = [
  {
    key: "hero",
    id: ids.media.hero,
    fileName: "hero-pantry.webp",
    sha256: "003b24d2360a0be42ba339bef750cf838cd80fcf71d6b46edd9f138537ad406a",
    usage: "homepage",
  },
  {
    key: "p01",
    id: ids.media.p01,
    fileName: "p01-rice.webp",
    sha256: "e0b05283a7e3df961a9d7da2a982c2dcbf3033734222b0ff8d2ee58f50be04d3",
    catalogItemId: ids.product.p01,
    position: 0,
    altText: "Дахин битүүмжилдэг ууттай нэг килограмм цагаан будаа",
  },
  {
    key: "p02",
    id: ids.media.p02,
    fileName: "p02-flour.webp",
    sha256: "8c034b6093de4af2a0f548af11c813c83e9a62e3e03d42ec0d49b1990ff4c0a8",
    catalogItemId: ids.product.p02,
    position: 0,
    altText: "Цайвар савлагаатай нэг килограмм гурил",
  },
  {
    key: "p03",
    id: ids.media.p03,
    fileName: "p03-milk.webp",
    sha256: "3719a85261c9a75b014fd26f0660d094bd4e0aa6ab9f5db372e426fd1d49ae27",
    catalogItemId: ids.product.p03,
    position: 0,
    altText: "Нэг литрийн цагаан савласан сүү",
  },
  {
    key: "p04",
    id: ids.media.p04,
    fileName: "p04-oil.webp",
    sha256: "dd8ad1d1187f2951e824e934cdfb38e156df6511b1e55172745fb866b499af44",
    catalogItemId: ids.product.p04,
    position: 0,
    altText: "Шар тагтай нэг литрийн ургамлын тос",
  },
  {
    key: "p05_800",
    id: ids.media.p05_800,
    fileName: "p05-detergent-800.webp",
    sha256: "4ac12fd01b5efc5bd9f5704d2f1c60082943a0928050cfec14266ff891d4189d",
    catalogItemId: ids.product.p05,
    position: 0,
    altText: "Найман зуун граммын үнэргүй угаалгын нунтаг",
  },
  {
    key: "p05_1600",
    id: ids.media.p05_1600,
    fileName: "p05-detergent-1600.webp",
    sha256: "32eff39641e506746b3c84f5994e68de9fe295e918867045be21307c3911ece5",
    catalogItemId: ids.product.p05,
    position: 1,
    altText: "Нэг бүхэл зургаан килограммын үнэргүй угаалгын нунтаг",
  },
  {
    key: "p06",
    id: ids.media.p06,
    fileName: "p06-dish-liquid.webp",
    sha256: "0e8fe169ecc9721d379f914445fde6af99fe3ad6350ee60c1905ac5357f20b07",
    catalogItemId: ids.product.p06,
    position: 0,
    altText: "Таван зуун миллилитрийн аяга таваг угаагч шингэн",
  },
  {
    key: "p07_sand",
    id: ids.media.p07Sand,
    fileName: "p07-tote-sand.webp",
    sha256: "cc24a5f95d5be04c339fbbeda8be33b108a91c66fbbc8784879ce60371ebb094",
    catalogItemId: ids.product.p07,
    position: 0,
    altText: "Элсний шар өнгийн өдөр тутмын даавуун цүнх",
  },
  {
    key: "p07_sky",
    id: ids.media.p07Sky,
    fileName: "p07-tote-sky.webp",
    sha256: "146b0076a01b98df94333f51d3cc1b941cf979630b42172efb736a01d3b9be0b",
    catalogItemId: ids.product.p07,
    position: 1,
    altText: "Тэнгэрийн хөх өнгийн өдөр тутмын даавуун цүнх",
  },
  {
    key: "p08",
    id: ids.media.p08,
    fileName: "p08-notebook.webp",
    sha256: "b3117910ba4eb60e4367b350d414e10ae16e90d81a39d1494e12dfcb8d7bad33",
    catalogItemId: ids.product.p08,
    position: 0,
    altText: "Хөх туузтай даавуун хавтастай тэмдэглэлийн дэвтэр",
  },
  {
    key: "p09",
    id: ids.media.p09,
    fileName: "p09-sugar-cubes.webp",
    sha256: "e9661d55921ef464b5c0d98f08e4d843784f34a4f5168cc1ee098996d80df3c2",
    catalogItemId: ids.product.p09,
    position: 0,
    altText: "Таван зуун граммын ёотон сахарын хайрцаг",
  },
  {
    key: "b01",
    id: ids.media.b01,
    fileName: "b01-cleaning-bundle.webp",
    sha256: "4e9bc824200514d5dbe7e27b31a69dbe679bebeca48a7ca632b4319522fa7a7e",
    catalogItemId: ids.bundle.b01,
    position: 0,
    altText: "Угаалгын нунтаг, аяга таваг угаагч шингэнтэй цэвэрлэгээний хослол",
  },
  {
    key: "b02",
    id: ids.media.b02,
    fileName: "b02-pantry-bundle.webp",
    sha256: "702051bb8b7cdd91669967ac8c9e1858d681fa6f4a5eb7f2b66fe16664d6184a",
    catalogItemId: ids.bundle.b02,
    position: 0,
    altText: "Хоёр будаа, нэг гурил, нэг ургамлын тостой гал тогооны нөөц багц",
  },
] as const;

const personalizations = [
  {
    id: ids.personalization.coverName,
    catalogItemId: ids.product.p08,
    kind: "text",
    key: "cover_name",
    label: "Нүүрний бичвэр",
    position: 0,
    required: false,
    maxLength: 24,
    values: [],
  },
  {
    id: ids.personalization.ribbonColor,
    catalogItemId: ids.product.p08,
    kind: "single_select",
    key: "ribbon_color",
    label: "Туузны өнгө",
    position: 1,
    required: true,
    maxLength: null,
    values: [
      { id: ids.personalizationValue.ribbonSand, key: "sand", label: "Элсний шар", position: 0 },
      { id: ids.personalizationValue.ribbonSky, key: "sky", label: "Тэнгэрийн хөх", position: 1 },
      { id: ids.personalizationValue.ribbonLeaf, key: "leaf", label: "Навчин ногоон", position: 2 },
    ],
  },
  {
    id: ids.personalization.withoutPriceTag,
    catalogItemId: ids.product.p08,
    kind: "checkbox",
    key: "without_price_tag",
    label: "Үнийн шошгогүй боох",
    position: 2,
    required: false,
    maxLength: null,
    values: [],
  },
] as const;

const cmsDocuments = [
  {
    kind: "storefront_identity",
    content: {
      version: 1,
      displayName: "Өрнүүн 48",
      legalName: "Өрнүүн 48 — зохиомол жишиг өгөгдөл, бүртгэлгүй",
      tagline: "Өдөр бүрийн хэрэгцээг цэгцтэй",
      summary:
        "Гал тогоо, гэр ахуй, жижиг бэлгийн хэрэгцээг нэг дороос сонгох зохиомол жишиг дэлгүүр.",
      logoMediaAssetId: null,
      faviconMediaAssetId: null,
      publicPhone: null,
      publicEmail: "sainuu@urnuun48.invalid",
      socialLinks: [],
    },
  },
  {
    kind: "homepage",
    content: {
      version: 1,
      headline: "Өдөр бүрийн хэрэгцээг цэгцтэй",
      summary:
        "Хүнс, цэвэрлэгээ, дахин ашиглах ахуйн сонголт, жижиг бэлгийг нэг танил тавиураас сонгоорой.",
      hero: {
        mediaAssetId: ids.media.hero,
        altText: "Өрнүүн 48 дэлгүүрийн зохиомол жишиг бараанууд өрсөн цайвар модон тавиур",
      },
      featuredCatalogItemIds: [ids.product.p07, ids.product.p08, ids.bundle.b01, ids.product.p03],
    },
  },
  {
    kind: "locations",
    content: {
      version: 1,
      locations: [
        {
          id: ids.location,
          name: "Өрнүүн 48 — жишиг цэг",
          address: "Улаанбаатар хот, Зохиомол дүүрэг, Канар гудамж 29 (бодит хаяг биш)",
          phone: null,
          openingHours: "Даваа–Ням 09:00–21:00 (жишиг)",
          directionsUrl: null,
          active: true,
          pickupEnabled: true,
        },
      ],
    },
  },
  {
    kind: "policies",
    content: {
      version: 1,
      policies: [
        {
          id: ids.policy.terms,
          kind: "terms",
          title: "Үйлчилгээний нөхцөл",
          contentMarkdown:
            "## Жишиг дэлгүүр\n\nЭнэ дэлгүүр нь системийн ажиллагааг шалгах **зохиомол жишиг өгөгдөл** юм. Бодит захиалга хүлээн авахгүй.",
        },
        {
          id: ids.policy.privacy,
          kind: "privacy",
          title: "Нууцлал",
          contentMarkdown:
            "## Нууцлал\n\nЖишиг орчинд бодит хүний холбоо барих мэдээлэл, төлбөрийн мэдээлэл оруулахгүй.",
        },
        {
          id: ids.policy.delivery,
          kind: "delivery",
          title: "Хүргэлт ба авах",
          contentMarkdown:
            "## Хүргэлт\n\nУлаанбаатар хотын жишиг хүргэлтийн төлбөр 6,000₮. Хөнгөлөлтийн дараах барааны дүн 120,000₮-өөс дээш бол хүргэлт үнэгүй.\n\n## Өөрөө авах\n\nӨрнүүн 48 — жишиг цэгээс үнэгүй авна.",
        },
        {
          id: ids.policy.returnsRefunds,
          kind: "returns_refunds",
          title: "Буцаалт ба мөнгө буцаалт",
          contentMarkdown:
            "## Жишиг журам\n\nБуцаалт, мөнгө буцаалтын ажиллагааг зөвхөн батлагдсан канар хувилбараар шалгана.",
        },
        {
          id: ids.policy.payment,
          kind: "payment",
          title: "Төлбөр",
          contentMarkdown:
            "## Төлбөрийн сонголт\n\nЖишиг орчин QPay, банкны шилжүүлэг, баталгаажуулалттай бэлэн төлбөрийн тохиргоог агуулна. Бодит мөнгө ашиглахгүй.",
        },
      ],
    },
  },
  {
    kind: "navigation",
    content: {
      version: 1,
      primary: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          label: "Нүүр",
          enabled: true,
          destination: { kind: "home" },
          children: [],
        },
        {
          id: "00000000-0000-4000-8000-000000000002",
          label: "Хүнс",
          enabled: true,
          destination: { kind: "category", id: ids.category.food },
          children: [],
        },
        {
          id: "00000000-0000-4000-8000-000000000003",
          label: "Гэр ахуй",
          enabled: true,
          destination: { kind: "category", id: ids.category.household },
          children: [
            {
              id: "00000000-0000-4000-8000-000000000004",
              label: "Цэвэрлэгээ",
              enabled: true,
              destination: { kind: "category", id: ids.category.cleaning },
            },
            {
              id: "00000000-0000-4000-8000-000000000005",
              label: "Цүнх, хадгалалт",
              enabled: true,
              destination: { kind: "category", id: ids.category.storage },
            },
            {
              id: "00000000-0000-4000-8000-000000000006",
              label: "Бичиг хэрэг",
              enabled: true,
              destination: { kind: "category", id: ids.category.stationery },
            },
          ],
        },
        {
          id: "00000000-0000-4000-8000-000000000007",
          label: "Шинэ гэр",
          enabled: true,
          destination: { kind: "collection", id: ids.collection.newHome },
          children: [],
        },
      ],
      footer: [
        {
          id: "00000000-0000-4000-8000-000000000008",
          label: "Дэлгүүр",
          items: [
            {
              id: "00000000-0000-4000-8000-000000000009",
              label: "Өөрөө авах цэг",
              enabled: true,
              destination: { kind: "location", id: ids.location },
            },
            {
              id: "00000000-0000-4000-8000-000000000010",
              label: "Өдөр тутмын хэрэгцээ",
              enabled: true,
              destination: { kind: "collection", id: ids.collection.everyday },
            },
          ],
        },
        {
          id: "00000000-0000-4000-8000-000000000011",
          label: "Мэдээлэл",
          items: [
            {
              id: "00000000-0000-4000-8000-000000000012",
              label: "Хүргэлт",
              enabled: true,
              destination: { kind: "policy", id: ids.policy.delivery },
            },
            {
              id: "00000000-0000-4000-8000-000000000013",
              label: "Төлбөр",
              enabled: true,
              destination: { kind: "policy", id: ids.policy.payment },
            },
          ],
        },
      ],
    },
  },
  {
    kind: "announcement",
    content: {
      version: 1,
      enabled: true,
      message: "120,000₮-өөс дээш захиалгад хүргэлт үнэгүй — жишиг дэлгүүр",
      emphasis: "promotion",
      link: { label: "Нөхцөл харах", href: "/policies/delivery" },
    },
  },
  {
    kind: "ordering_notices",
    content: {
      version: 1,
      notices: [
        {
          id: "00000000-0000-4000-8000-000000000014",
          enabled: true,
          title: "Зохиомол жишиг дэлгүүр",
          contentMarkdown: "Энэ бол зохиомол жишиг дэлгүүр. Бодит захиалга хүлээн авахгүй.",
          placements: ["product", "cart", "checkout"],
        },
        {
          id: "00000000-0000-4000-8000-000000000015",
          enabled: true,
          title: "Үлдэгдлийг дахин шалгана",
          contentMarkdown:
            "Худалдан авахын өмнө үнэ, сонголт, үлдэгдлийг серверээс шинэчлэн шалгана.",
          placements: ["product", "cart"],
        },
      ],
    },
  },
] as const;

export const referenceStoreFixture = v.parse(FixtureSchema, {
  storeKey: "wf29-urnuun48",
  seededAt: "2026-07-14T00:00:00.000Z",
  paymentProvider: "byl",
  commerceSettings: {
    bankTransferEnabled: true,
    cashOnDeliveryEnabled: true,
    customerAccountsEnabled: true,
    telegramEnabled: true,
    pickupEnabled: true,
    deliveryEnabled: true,
    deliveryFeeMnt: 6_000,
    freeDeliveryThresholdMnt: 120_000,
  },
  scenarioKeys: [
    "wf29.search.tiers",
    "wf29.bundle.reserve",
    "wf29.cache.live-stock",
    "wf29.guest.qpay-transfer",
    "wf29.cod.pickup",
    "wf29.cancel.refund",
    "wf29.customer.link",
    "wf29.stock.race",
  ],
  products,
  bundles,
  categories,
  collections,
  tags,
  discounts: [
    {
      id: ids.discount.d01,
      name: "Шинэ гэрийн 5,000₮",
      mode: "code",
      code: "WF29-5000",
      calculation: "fixed_mnt",
      value: 5_000,
      minimumSubtotalMnt: 30_000,
      globalLimit: 29,
      targets: [{ kind: "collection", id: ids.collection.newHome }],
    },
    {
      id: ids.discount.d02,
      name: "Өдөр тутмын автомат 7%",
      mode: "automatic",
      code: null,
      calculation: "percentage",
      value: 7,
      minimumSubtotalMnt: 50_000,
      globalLimit: null,
      targets: [{ kind: "all" }],
    },
  ],
  personalizations,
  media,
  locationId: ids.location,
  policyIds: {
    terms: ids.policy.terms,
    privacy: ids.policy.privacy,
    delivery: ids.policy.delivery,
    returnsRefunds: ids.policy.returnsRefunds,
    payment: ids.policy.payment,
  },
  cmsDocuments,
});
