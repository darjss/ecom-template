import { fromString, typeidUnboxed } from "typeid-js";
import * as v from "valibot";
import { ContractClientErrorSchema, NetworkClientErrorSchema } from "./client-error";
import {
  CatalogItemIdSchema,
  CachePurgeDebtSchema,
  CatalogItemKindSchema,
  CatalogNameSchema,
  CatalogSlugSchema,
  ProductStateSchema,
  PublicCatalogItemSummarySchema,
} from "./catalog";
import { NormalizedTextSchema } from "./text";

const groupingIdSchema = (prefix: string, label: string) =>
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

export const CategoryIdSchema = groupingIdSchema("category", "Category ID");
export const CollectionIdSchema = groupingIdSchema("collection", "Collection ID");
export const TagIdSchema = groupingIdSchema("tag", "Tag ID");
export const GroupingStateSchema = v.picklist(["draft", "active", "archived"]);
export const GroupingPositionSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
  v.maxValue(10_000),
);
export const TagLabelSchema = v.pipe(
  NormalizedTextSchema,
  v.trim(),
  v.minLength(1),
  v.maxLength(80),
);
export const GroupingDescriptionSchema = v.pipe(NormalizedTextSchema, v.maxLength(5_000));
const GroupingTimestampSchema = v.pipe(v.string(), v.isoTimestamp());

export const GroupingCatalogItemSchema = v.strictObject({
  id: CatalogItemIdSchema,
  kind: CatalogItemKindSchema,
  name: CatalogNameSchema,
  state: ProductStateSchema,
});
export const CategorySchema = v.strictObject({
  kind: v.literal("category"),
  id: CategoryIdSchema,
  slug: CatalogSlugSchema,
  name: CatalogNameSchema,
  parentId: v.nullable(CategoryIdSchema),
  position: GroupingPositionSchema,
  state: GroupingStateSchema,
  catalogItemIds: v.array(CatalogItemIdSchema),
  createdAt: GroupingTimestampSchema,
  updatedAt: GroupingTimestampSchema,
  activatedAt: v.nullable(GroupingTimestampSchema),
  archivedAt: v.nullable(GroupingTimestampSchema),
});
export const CollectionSchema = v.strictObject({
  kind: v.literal("collection"),
  id: CollectionIdSchema,
  slug: CatalogSlugSchema,
  name: CatalogNameSchema,
  description: GroupingDescriptionSchema,
  state: GroupingStateSchema,
  catalogItemIds: v.array(CatalogItemIdSchema),
  createdAt: GroupingTimestampSchema,
  updatedAt: GroupingTimestampSchema,
  activatedAt: v.nullable(GroupingTimestampSchema),
  archivedAt: v.nullable(GroupingTimestampSchema),
});
export const TagSchema = v.strictObject({
  kind: v.literal("tag"),
  id: TagIdSchema,
  label: TagLabelSchema,
  state: GroupingStateSchema,
  catalogItemIds: v.array(CatalogItemIdSchema),
  createdAt: GroupingTimestampSchema,
  updatedAt: GroupingTimestampSchema,
  activatedAt: v.nullable(GroupingTimestampSchema),
  archivedAt: v.nullable(GroupingTimestampSchema),
});
export const GroupingSchema = v.variant("kind", [CategorySchema, CollectionSchema, TagSchema]);
export const GroupingListResponseSchema = v.strictObject({
  data: v.strictObject({
    categories: v.array(CategorySchema),
    collections: v.array(CollectionSchema),
    tags: v.array(TagSchema),
    catalogItems: v.array(GroupingCatalogItemSchema),
    cachePurgeDebt: v.nullable(CachePurgeDebtSchema),
  }),
});
const GroupingCachePurgeResultSchema = v.strictObject({
  cache: v.picklist(["not_required", "purged", "committed_but_not_purged"]),
  cachePurgeRequestId: v.nullable(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
});
export const GroupingMutationResponseSchema = v.strictObject({
  data: v.strictObject({
    grouping: GroupingSchema,
    ...GroupingCachePurgeResultSchema.entries,
  }),
});
export const GroupingCachePurgeResponseSchema = v.strictObject({
  data: GroupingCachePurgeResultSchema,
});

export const CategoryInputSchema = v.strictObject({
  name: CatalogNameSchema,
  slug: CatalogSlugSchema,
  parentId: v.nullable(CategoryIdSchema),
  position: GroupingPositionSchema,
});
export const CollectionInputSchema = v.strictObject({
  name: CatalogNameSchema,
  slug: CatalogSlugSchema,
  description: v.optional(GroupingDescriptionSchema, ""),
});
export const TagInputSchema = v.strictObject({ label: TagLabelSchema });
export const GroupingStateInputSchema = v.strictObject({
  state: v.picklist(["active", "archived"]),
});
export const GroupingMembershipInputSchema = v.strictObject({
  catalogItemIds: v.pipe(v.array(CatalogItemIdSchema), v.maxLength(500)),
});

export const GroupingFailureReasonSchema = v.picklist([
  "duplicate_slug",
  "duplicate_label",
  "not_found",
  "slug_locked",
  "parent_not_found",
  "category_cycle",
  "duplicate_membership",
]);
export const GroupingApiErrorSchema = v.strictObject({
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
    reason: v.optional(GroupingFailureReasonSchema),
  }),
});
export const GroupingClientErrorSchema = v.variant("kind", [
  NetworkClientErrorSchema,
  ContractClientErrorSchema,
  v.strictObject({
    kind: v.literal("api"),
    error: GroupingApiErrorSchema.entries.error,
  }),
]);

export const PublicGroupingSchema = v.strictObject({
  id: v.union([CategoryIdSchema, CollectionIdSchema]),
  slug: CatalogSlugSchema,
  name: CatalogNameSchema,
  description: GroupingDescriptionSchema,
});
export const PublicGroupingListingSchema = v.strictObject({
  grouping: PublicGroupingSchema,
  catalogItems: v.array(PublicCatalogItemSummarySchema),
});

export type CategoryId = v.InferOutput<typeof CategoryIdSchema>;
export type CollectionId = v.InferOutput<typeof CollectionIdSchema>;
export type TagId = v.InferOutput<typeof TagIdSchema>;
export type GroupingState = v.InferOutput<typeof GroupingStateSchema>;
export type Category = v.InferOutput<typeof CategorySchema>;
export type Collection = v.InferOutput<typeof CollectionSchema>;
export type Tag = v.InferOutput<typeof TagSchema>;
export type Grouping = v.InferOutput<typeof GroupingSchema>;
export type CategoryInput = v.InferOutput<typeof CategoryInputSchema>;
export type CollectionInput = v.InferOutput<typeof CollectionInputSchema>;
export type TagInput = v.InferOutput<typeof TagInputSchema>;
export type GroupingMembershipInput = v.InferOutput<typeof GroupingMembershipInputSchema>;
export type GroupingClientError = v.InferOutput<typeof GroupingClientErrorSchema>;
export type PublicGrouping = v.InferOutput<typeof PublicGroupingSchema>;
export type PublicGroupingListing = v.InferOutput<typeof PublicGroupingListingSchema>;

export const createCategoryId = () => typeidUnboxed("category");
export const createCollectionId = () => typeidUnboxed("collection");
export const createTagId = () => typeidUnboxed("tag");
