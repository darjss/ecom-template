import { fromString, typeidUnboxed } from "typeid-js";
import * as v from "valibot";
import type { ClientRequestError } from "./client-error";
import { NormalizedTextSchema } from "./text";

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

export const ProductIdSchema = typeIdSchema("product", "Product ID");
export const BundleIdSchema = typeIdSchema("bundle", "Bundle ID");
export const CatalogItemIdSchema = v.union([ProductIdSchema, BundleIdSchema]);
export const CatalogItemKindSchema = v.picklist(["product", "bundle"]);
export const VariantIdSchema = typeIdSchema("variant", "Variant ID");
export const OptionGroupIdSchema = typeIdSchema("option_group", "Option Group ID");
export const OptionValueIdSchema = typeIdSchema("option_value", "Option Value ID");
export const MediaAssetIdSchema = typeIdSchema("media", "Media Asset ID");
export const StockItemIdSchema = typeIdSchema("stock_item", "Stock Item ID");
export const InventoryEntryIdSchema = typeIdSchema("inventory_entry", "Inventory Entry ID");
export const InventoryReservationIdSchema = typeIdSchema("reservation", "Reservation ID");
export const ProductStateSchema = v.picklist(["draft", "published", "archived"]);
export const CatalogNameSchema = v.pipe(
  NormalizedTextSchema,
  v.trim(),
  v.minLength(1),
  v.maxLength(120),
);
export const CatalogDescriptionSchema = v.pipe(NormalizedTextSchema, v.maxLength(5_000));
export const CatalogSlugSchema = v.pipe(
  NormalizedTextSchema,
  v.trim(),
  v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  v.maxLength(100),
);
export const SkuSchema = v.pipe(
  v.string(),
  v.regex(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u),
  v.maxLength(64),
);
export const compactSku = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("mn-MN")
    .replaceAll(/[-/\p{White_Space}]/gu, "");
export const PriceMntSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(1),
  v.maxValue(1_000_000_000),
);
export const InventoryReasonSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(240));
export const InventoryQuantitySchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
  v.maxValue(1_000_000),
);
export const InventoryDeltaSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(-1_000_000),
  v.maxValue(1_000_000),
  v.check((value) => value !== 0),
);
export const MediaContentTypeSchema = v.picklist(["image/jpeg", "image/png", "image/webp"]);
export const MediaPositionSchema = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(7));
export const MediaAltTextSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(240));
export const MediaWidthSchema = v.picklist([320, 640, 960, 1280]);
export const MediaFormatSchema = v.picklist(["avif", "webp"]);
export const MediaAssetSchema = v.strictObject({
  id: MediaAssetIdSchema,
  declaredContentType: MediaContentTypeSchema,
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
});
export const CatalogImageSchema = v.strictObject({
  mediaAsset: MediaAssetSchema,
  position: MediaPositionSchema,
  altText: MediaAltTextSchema,
});
export const MediaUploadFieldsSchema = v.strictObject({
  position: MediaPositionSchema,
  altText: MediaAltTextSchema,
});
export const CachePurgeRequestIdSchema = v.nullable(
  v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
);
export const MediaUploadResponseSchema = v.strictObject({
  data: v.strictObject({
    image: CatalogImageSchema,
    cache: v.picklist(["not_required", "purged", "committed_but_not_purged"]),
    cachePurgeRequestId: CachePurgeRequestIdSchema,
  }),
});
export const MediaUploadMaxBytes = 8 * 1024 * 1024;
export const MediaUploadMultipartMaxBytes = MediaUploadMaxBytes + 64 * 1024;

export const CachePurgeDebtSchema = v.strictObject({
  attemptCount: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1_000_000)),
  requestId: CachePurgeRequestIdSchema,
  lastAttemptedAt: v.nullable(v.pipe(v.string(), v.isoTimestamp())),
});

export const OptionKeySchema = v.pipe(
  v.string(),
  v.trim(),
  v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  v.maxLength(48),
);
export const OptionLabelSchema = v.pipe(
  NormalizedTextSchema,
  v.trim(),
  v.minLength(1),
  v.maxLength(80),
);
export const OptionPositionSchema = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(99));
export const OptionValueSchema = v.strictObject({
  id: OptionValueIdSchema,
  key: OptionKeySchema,
  label: OptionLabelSchema,
  position: OptionPositionSchema,
  state: v.picklist(["active", "archived"]),
});
export const OptionGroupSchema = v.strictObject({
  id: OptionGroupIdSchema,
  key: OptionKeySchema,
  label: OptionLabelSchema,
  position: OptionPositionSchema,
  state: v.picklist(["active", "archived"]),
  values: v.pipe(v.array(OptionValueSchema), v.maxLength(12)),
});
export const VariantSchema = v.strictObject({
  id: VariantIdSchema,
  sku: SkuSchema,
  isDefault: v.boolean(),
  state: v.picklist(["active", "archived"]),
  priceOverrideMnt: v.nullable(PriceMntSchema),
  imageMediaAssetId: v.nullable(MediaAssetIdSchema),
  optionValueIds: v.array(OptionValueIdSchema),
  stockItemId: StockItemIdSchema,
  onHandQuantity: InventoryQuantitySchema,
  reservedQuantity: InventoryQuantitySchema,
});
export const ProductOptionConfigurationSchema = v.strictObject({
  groups: v.pipe(v.array(OptionGroupSchema), v.maxLength(3)),
  variants: v.pipe(v.array(VariantSchema), v.maxLength(101)),
});

export const ProductSchema = v.strictObject({
  id: ProductIdSchema,
  defaultVariantId: VariantIdSchema,
  stockItemId: StockItemIdSchema,
  slug: CatalogSlugSchema,
  state: ProductStateSchema,
  name: CatalogNameSchema,
  description: CatalogDescriptionSchema,
  priceMnt: PriceMntSchema,
  sku: SkuSchema,
  onHandQuantity: InventoryQuantitySchema,
  reservedQuantity: InventoryQuantitySchema,
  cachePurgeDebt: v.nullable(CachePurgeDebtSchema),
  images: v.array(CatalogImageSchema),
  optionConfiguration: ProductOptionConfigurationSchema,
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
  updatedAt: v.pipe(v.string(), v.isoTimestamp()),
});

export const CatalogListResponseSchema = v.strictObject({ data: v.array(ProductSchema) });
export const CatalogProductResponseSchema = v.strictObject({
  data: v.strictObject({
    product: ProductSchema,
    cache: v.picklist(["not_required", "purged", "committed_but_not_purged"]),
    cachePurgeRequestId: CachePurgeRequestIdSchema,
  }),
});
export const CreateProductInputSchema = v.strictObject({
  name: CatalogNameSchema,
  slug: CatalogSlugSchema,
  description: v.optional(CatalogDescriptionSchema, ""),
  priceMnt: PriceMntSchema,
  openingQuantity: InventoryQuantitySchema,
  inventoryReason: InventoryReasonSchema,
});
export const UpdateProductInputSchema = v.strictObject({
  name: CatalogNameSchema,
  slug: CatalogSlugSchema,
  description: CatalogDescriptionSchema,
  priceMnt: PriceMntSchema,
});
export const InventoryAdjustmentInputSchema = v.strictObject({
  delta: InventoryDeltaSchema,
  reason: InventoryReasonSchema,
});
const OptionValueDraftSchema = v.strictObject({
  id: v.optional(OptionValueIdSchema),
  key: OptionKeySchema,
  label: OptionLabelSchema,
  position: OptionPositionSchema,
});
const OptionGroupDraftSchema = v.strictObject({
  id: v.optional(OptionGroupIdSchema),
  key: OptionKeySchema,
  label: OptionLabelSchema,
  position: OptionPositionSchema,
  values: v.pipe(v.array(OptionValueDraftSchema), v.minLength(1), v.maxLength(12)),
});
const VariantDraftSchema = v.strictObject({
  id: v.optional(VariantIdSchema),
  optionValueIds: v.pipe(v.array(OptionValueIdSchema), v.minLength(1), v.maxLength(3)),
  priceOverrideMnt: v.nullable(PriceMntSchema),
  imageMediaAssetId: v.nullable(MediaAssetIdSchema),
  state: v.picklist(["active", "archived"]),
});
export const SaveProductOptionsInputSchema = v.strictObject({
  groups: v.pipe(v.array(OptionGroupDraftSchema), v.maxLength(3)),
  variants: v.pipe(v.array(VariantDraftSchema), v.maxLength(100)),
});
export const UpdateVariantPresentationInputSchema = v.strictObject({
  priceOverrideMnt: v.nullable(PriceMntSchema),
  imageMediaAssetId: v.nullable(MediaAssetIdSchema),
});

export const InventoryBlockingReservationSchema = v.strictObject({
  reservationId: InventoryReservationIdSchema,
  orderReference: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  quantity: v.pipe(v.number(), v.integer(), v.minValue(1)),
});
export const CatalogFailureReasonSchema = v.picklist([
  "duplicate_slug",
  "not_found",
  "invalid_lifecycle",
  "invalid_publication",
  "immutable_configuration",
  "duplicate_combination",
  "invalid_combination",
  "media_not_owned",
  "published_bundle_dependency",
  "published_cms_dependency",
  "reservation_blocked",
  "inventory_inconsistent",
  "inventory_limit",
  "committed_but_not_purged",
  "unsupported_media_type",
  "invalid_media_bytes",
  "media_too_large",
]);
export const CatalogApiErrorSchema = v.strictObject({
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
    reason: v.optional(CatalogFailureReasonSchema),
    blockers: v.optional(v.array(InventoryBlockingReservationSchema)),
  }),
});
export const PublicCatalogImageSchema = v.strictObject({
  mediaAssetId: MediaAssetIdSchema,
  position: MediaPositionSchema,
  altText: MediaAltTextSchema,
});
export const PublicCatalogItemSummarySchema = v.strictObject({
  id: CatalogItemIdSchema,
  kind: CatalogItemKindSchema,
  slug: CatalogSlugSchema,
  name: CatalogNameSchema,
  description: v.string(),
  priceMnt: PriceMntSchema,
  images: v.array(PublicCatalogImageSchema),
});
export const PublicProductSummarySchema = v.strictObject({
  id: ProductIdSchema,
  slug: CatalogSlugSchema,
  name: CatalogNameSchema,
  description: v.string(),
  priceMnt: PriceMntSchema,
  images: v.array(PublicCatalogImageSchema),
});
export const PublicVariantSchema = v.strictObject({
  id: VariantIdSchema,
  sku: SkuSchema,
  priceMnt: PriceMntSchema,
  image: v.nullable(PublicCatalogImageSchema),
  optionValues: v.array(
    v.strictObject({
      groupId: OptionGroupIdSchema,
      groupLabel: OptionLabelSchema,
      valueId: OptionValueIdSchema,
      valueLabel: OptionLabelSchema,
    }),
  ),
});
export const PublicOptionGroupSchema = v.strictObject({
  id: OptionGroupIdSchema,
  label: OptionLabelSchema,
  position: OptionPositionSchema,
  values: v.pipe(
    v.array(
      v.strictObject({
        id: OptionValueIdSchema,
        label: OptionLabelSchema,
        position: OptionPositionSchema,
      }),
    ),
    v.maxLength(12),
  ),
});
export const PublicProductDetailSchema = v.strictObject({
  ...PublicProductSummarySchema.entries,
  optionGroups: v.pipe(v.array(PublicOptionGroupSchema), v.maxLength(3)),
  variants: v.pipe(v.array(PublicVariantSchema), v.minLength(1), v.maxLength(100)),
});

export type ProductId = v.InferOutput<typeof ProductIdSchema>;
export type BundleId = v.InferOutput<typeof BundleIdSchema>;
export type CatalogItemId = v.InferOutput<typeof CatalogItemIdSchema>;
export type CatalogItemKind = v.InferOutput<typeof CatalogItemKindSchema>;
export type VariantId = v.InferOutput<typeof VariantIdSchema>;
export type OptionGroupId = v.InferOutput<typeof OptionGroupIdSchema>;
export type OptionValueId = v.InferOutput<typeof OptionValueIdSchema>;
export type MediaAssetId = v.InferOutput<typeof MediaAssetIdSchema>;
export type StockItemId = v.InferOutput<typeof StockItemIdSchema>;
export type InventoryEntryId = v.InferOutput<typeof InventoryEntryIdSchema>;
export type Product = v.InferOutput<typeof ProductSchema>;
export type CreateProductInput = v.InferOutput<typeof CreateProductInputSchema>;
export type UpdateProductInput = v.InferOutput<typeof UpdateProductInputSchema>;
export type InventoryAdjustmentInput = v.InferOutput<typeof InventoryAdjustmentInputSchema>;
export type SaveProductOptionsInput = v.InferOutput<typeof SaveProductOptionsInputSchema>;
export type UpdateVariantPresentationInput = v.InferOutput<
  typeof UpdateVariantPresentationInputSchema
>;
export type InventoryBlockingReservation = v.InferOutput<typeof InventoryBlockingReservationSchema>;
export type MediaContentType = v.InferOutput<typeof MediaContentTypeSchema>;
export type MediaWidth = v.InferOutput<typeof MediaWidthSchema>;
export type MediaFormat = v.InferOutput<typeof MediaFormatSchema>;
export type MediaUploadFields = v.InferOutput<typeof MediaUploadFieldsSchema>;
export type CatalogImage = v.InferOutput<typeof CatalogImageSchema>;
export type PublicCatalogImage = v.InferOutput<typeof PublicCatalogImageSchema>;
export type CatalogClientError = ClientRequestError<
  v.InferOutput<typeof CatalogApiErrorSchema>["error"]
>;
export type PublicCatalogItemSummary = v.InferOutput<typeof PublicCatalogItemSummarySchema>;
export type PublicProductSummary = v.InferOutput<typeof PublicProductSummarySchema>;
export type PublicProductDetail = v.InferOutput<typeof PublicProductDetailSchema>;

export const createProductId = () => typeidUnboxed("product");
export const createBundleId = () => typeidUnboxed("bundle");
export const createVariantId = () => typeidUnboxed("variant");
export const createOptionGroupId = () => typeidUnboxed("option_group");
export const createOptionValueId = () => typeidUnboxed("option_value");
export const createMediaAssetId = () => typeidUnboxed("media");
export const createStockItemId = () => typeidUnboxed("stock_item");
export const createInventoryEntryId = () => typeidUnboxed("inventory_entry");
export const parseProductId = (value: string) => fromString(value, "product");
export const parseVariantId = (value: string) => fromString(value, "variant");
export const parseOptionGroupId = (value: string) => fromString(value, "option_group");
export const parseOptionValueId = (value: string) => fromString(value, "option_value");
export const parseMediaAssetId = (value: string) => fromString(value, "media");
export const parseStockItemId = (value: string) => fromString(value, "stock_item");
export const parseInventoryEntryId = (value: string) => fromString(value, "inventory_entry");
