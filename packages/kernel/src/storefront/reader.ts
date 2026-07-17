import {
  PublicGroupingListingSchema,
  PublicGroupingSchema,
  PublicProductDetailSchema,
  PublicProductSummarySchema,
  type PublicGrouping,
  type PublicGroupingListing,
  type PublicProductDetail,
  type PublicProductSummary,
  type StorefrontSummary,
} from "@ecom/contracts";
import * as v from "valibot";
import { catalogQueries } from "../catalog/persistence";
import { readDatabaseHealth } from "../db/health";
import { groupingQueries } from "../grouping/persistence";

export type StorefrontReader = {
  readonly readSummary: () => Promise<StorefrontSummary>;
  readonly listPublishedProducts: () => Promise<readonly PublicProductSummary[]>;
  readonly readPublishedProduct: (slug: string) => Promise<PublicProductDetail | undefined>;
  readonly listPublishedGroupings: () => Promise<{
    readonly categories: readonly PublicGrouping[];
    readonly collections: readonly PublicGrouping[];
  }>;
  readonly readPublishedCategory: (slug: string) => Promise<PublicGroupingListing | undefined>;
  readonly readPublishedCollection: (slug: string) => Promise<PublicGroupingListing | undefined>;
};

const listPublishedProducts = async () => {
  const rows = await catalogQueries.listPublished();
  return rows.map((row) => v.parse(PublicProductSummarySchema, row));
};

const publicListing = async (
  grouping: Awaited<ReturnType<typeof groupingQueries.findPublicCategory>>,
) => {
  if (!grouping) return undefined;
  const productsById = new Map(
    (await listPublishedProducts()).map((product) => [product.id, product]),
  );
  const products = grouping.productIds.flatMap((id) => {
    const product = productsById.get(id);
    return product ? [product] : [];
  });
  return products.length > 0
    ? v.parse(PublicGroupingListingSchema, {
        grouping: {
          id: grouping.id,
          slug: grouping.slug,
          name: grouping.name,
          description: grouping.description,
        },
        products,
      })
    : undefined;
};

export const createStorefrontReader = (summary: StorefrontSummary): StorefrontReader => ({
  readSummary: async () => {
    const health = await readDatabaseHealth();
    if (health.isErr()) throw new Error("Store infrastructure is unavailable");
    return summary;
  },
  listPublishedProducts,
  readPublishedProduct: async (slug) => {
    const row = await catalogQueries.findPublishedBySlug(slug);
    return row ? v.parse(PublicProductDetailSchema, row) : undefined;
  },
  listPublishedGroupings: async () => {
    const [groups, products] = await Promise.all([
      groupingQueries.listPublicGroupings(),
      listPublishedProducts(),
    ]);
    const publishedIds = new Set(products.map((product) => product.id));
    const project = (group: (typeof groups.categories)[number]) =>
      v.parse(PublicGroupingSchema, {
        id: group.id,
        slug: group.slug,
        name: group.name,
        description: group.description,
      });
    return {
      categories: groups.categories
        .filter((group) => group.productIds.some((id) => publishedIds.has(id)))
        .map(project),
      collections: groups.collections
        .filter((group) => group.productIds.some((id) => publishedIds.has(id)))
        .map(project),
    };
  },
  readPublishedCategory: async (slug) =>
    publicListing(await groupingQueries.findPublicCategory(slug)),
  readPublishedCollection: async (slug) =>
    publicListing(await groupingQueries.findPublicCollection(slug)),
});
