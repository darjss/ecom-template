import * as v from "valibot";
import { ContractClientErrorSchema, NetworkClientErrorSchema } from "./client-error";
import {
  BundleIdSchema,
  CatalogNameSchema,
  CatalogSlugSchema,
  PriceMntSchema,
  ProductIdSchema,
  PublicCatalogImageSchema,
} from "./catalog";
import { CategoryIdSchema, CollectionIdSchema } from "./grouping";

export const SearchMatchSourceSchema = v.picklist([
  "sku_exact",
  "native",
  "krilleer_transliteration",
]);
export const SearchMatchFieldSchema = v.picklist([
  "sku",
  "slug",
  "title",
  "category_tags",
  "description",
  "mixed",
]);
export const SearchConfidenceSchema = v.picklist(["exact", "high", "medium", "low"]);

const SearchResultFields = {
  slug: CatalogSlugSchema,
  name: CatalogNameSchema,
  description: v.string(),
  priceMnt: PriceMntSchema,
  images: v.array(PublicCatalogImageSchema),
  matchedSource: SearchMatchSourceSchema,
  matchedField: SearchMatchFieldSchema,
  confidence: SearchConfidenceSchema,
};

export const CatalogItemSearchResultSchema = v.variant("kind", [
  v.strictObject({ kind: v.literal("product"), id: ProductIdSchema, ...SearchResultFields }),
  v.strictObject({ kind: v.literal("bundle"), id: BundleIdSchema, ...SearchResultFields }),
]);

const CategorySearchShortcutSchema = v.strictObject({
  kind: v.literal("category"),
  id: CategoryIdSchema,
  label: CatalogNameSchema,
  slug: CatalogSlugSchema,
  url: v.string(),
});
const CollectionSearchShortcutSchema = v.strictObject({
  kind: v.literal("collection"),
  id: CollectionIdSchema,
  label: CatalogNameSchema,
  slug: CatalogSlugSchema,
  url: v.string(),
});
export const SearchShortcutSchema = v.variant("kind", [
  CategorySearchShortcutSchema,
  CollectionSearchShortcutSchema,
]);

export const CatalogSearchResponseSchema = v.strictObject({
  query: v.string(),
  normalizationVersion: v.literal("krilleer-cyr-lat-v1"),
  results: v.strictObject({
    items: v.array(CatalogItemSearchResultSchema),
    page: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)),
    pageSize: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(48)),
    hasNext: v.boolean(),
  }),
  ambiguity: v.nullable(
    v.strictObject({
      confidence: v.literal("low"),
      candidateIds: v.pipe(
        v.array(v.union([ProductIdSchema, BundleIdSchema])),
        v.minLength(2),
        v.maxLength(48),
      ),
    }),
  ),
  shortcuts: v.strictObject({
    categories: v.pipe(v.array(CategorySearchShortcutSchema), v.maxLength(3)),
    collections: v.pipe(v.array(CollectionSearchShortcutSchema), v.maxLength(3)),
  }),
});

export const CatalogSearchApiErrorSchema = v.strictObject({
  error: v.strictObject({
    code: v.picklist(["validation", "unavailable"]),
    message: v.string(),
  }),
});
export const CatalogSearchClientErrorSchema = v.variant("kind", [
  NetworkClientErrorSchema,
  ContractClientErrorSchema,
  v.strictObject({ kind: v.literal("api"), error: CatalogSearchApiErrorSchema.entries.error }),
]);

export type CatalogItemSearchResult = v.InferOutput<typeof CatalogItemSearchResultSchema>;
export type CatalogSearchResponse = v.InferOutput<typeof CatalogSearchResponseSchema>;
export type CatalogSearchClientError = v.InferOutput<typeof CatalogSearchClientErrorSchema>;
