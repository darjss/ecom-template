import {
  CatalogItemIdSchema,
  PublicBundleDetailSchema,
  PublicGroupingListingSchema,
  PublicGroupingSchema,
  PublicProductDetailSchema,
  PublicProductSummarySchema,
  type CommerceSettings,
  type LocationsDocument,
  type NavigationDocument,
  type PersonalizationDefinition,
  type PoliciesDocument,
  type StorefrontIdentityDocument,
  type PublicBundleDetail,
  type PublicCatalogItemSummary,
  type PublicGrouping,
  type PublicGroupingListing,
  type PublicProductDetail,
  type PublicProductSummary,
  type StorefrontSummary,
} from "@ecom/contracts";
import * as v from "valibot";
import { bundleQueries, readPersonalizations } from "../bundles/persistence";
import { catalogQueries } from "../catalog/persistence";
import { readDatabaseHealth } from "../db/health";
import { groupingQueries } from "../grouping/persistence";
import { cmsQueries } from "../cms/persistence";

export type StorefrontReader = {
  readonly readSummary: () => Promise<StorefrontSummary>;
  readonly readIdentity: () => Promise<StorefrontIdentityDocument | undefined>;
  readonly readNavigation: () => Promise<NavigationDocument | undefined>;
  readonly readLocations: () => Promise<LocationsDocument | undefined>;
  readonly readPolicies: () => Promise<PoliciesDocument | undefined>;
  readonly readCommerceSettings: () => Promise<CommerceSettings | undefined>;
  readonly listPublishedCatalogItems: () => Promise<readonly PublicCatalogItemSummary[]>;
  readonly listPublishedProducts: () => Promise<readonly PublicProductSummary[]>;
  readonly readPublishedProduct: (slug: string) => Promise<PublicProductDetail | undefined>;
  readonly readPublishedBundle: (slug: string) => Promise<PublicBundleDetail | undefined>;
  readonly readPersonalizations: (
    catalogItemId: string,
  ) => Promise<readonly PersonalizationDefinition[]>;
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

const projectPublicGrouping = (group: {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
}) =>
  v.parse(PublicGroupingSchema, {
    id: group.id,
    slug: group.slug,
    name: group.name,
    description: group.description,
  });

const publicListing = async (
  grouping: Awaited<ReturnType<typeof groupingQueries.findPublicCategory>>,
) => {
  if (!grouping) {
    return undefined;
  }
  const catalogItems = await catalogQueries.listPublishedCatalogItems(grouping.catalogItemIds);
  const catalogItemsById = new Map(
    catalogItems.map((catalogItem) => [catalogItem.id, catalogItem]),
  );
  return v.parse(PublicGroupingListingSchema, {
    grouping: {
      id: grouping.id,
      slug: grouping.slug,
      name: grouping.name,
      description: grouping.description,
    },
    catalogItems: grouping.catalogItemIds.flatMap((id) => {
      const catalogItem = catalogItemsById.get(id);
      return catalogItem ? [catalogItem] : [];
    }),
  });
};

export const createStorefrontReader = (summary: StorefrontSummary): StorefrontReader => ({
  readSummary: async () => {
    const health = await readDatabaseHealth();
    if (health.isErr()) {
      throw new Error("Store infrastructure is unavailable");
    }
    return summary;
  },
  readIdentity: async () => {
    const document = await cmsQueries.read("storefront_identity", "published");
    return document?.kind === "storefront_identity" ? document.content : undefined;
  },
  readNavigation: async () => {
    const document = await cmsQueries.read("navigation", "published");
    return document?.kind === "navigation" ? document.content : undefined;
  },
  readLocations: async () => {
    const document = await cmsQueries.read("locations", "published");
    return document?.kind === "locations" ? document.content : undefined;
  },
  readPolicies: async () => {
    const document = await cmsQueries.read("policies", "published");
    return document?.kind === "policies" ? document.content : undefined;
  },
  readCommerceSettings: () => cmsQueries.readSettings(),
  listPublishedCatalogItems: () => catalogQueries.listPublishedCatalogItems(),
  listPublishedProducts,
  readPublishedProduct: async (slug) => {
    const row = await catalogQueries.findPublishedBySlug(slug);
    return row ? v.parse(PublicProductDetailSchema, row) : undefined;
  },
  readPublishedBundle: async (slug) => {
    const bundle = await bundleQueries.findPublishedBySlug(slug);
    if (!bundle) {
      return undefined;
    }
    const {
      state: _state,
      cachePurgeDebt: _cachePurgeDebt,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...publicBundle
    } = bundle;
    return v.parse(PublicBundleDetailSchema, {
      ...publicBundle,
      images: bundle.images.map(({ mediaAsset, position, altText }) => ({
        mediaAssetId: mediaAsset.id,
        position,
        altText,
      })),
      personalizations: bundle.personalizations.filter(({ state }) => state === "active"),
    });
  },
  readPersonalizations: async (catalogItemId) => {
    const parsedId = v.safeParse(CatalogItemIdSchema, catalogItemId);
    if (!parsedId.success) {
      return [];
    }
    const rows = await readPersonalizations([parsedId.output]);
    return rows.at(0)?.definitions.filter(({ state }) => state === "active") ?? [];
  },
  listPublishedGroupings: async () => {
    const [groups, catalogItems] = await Promise.all([
      groupingQueries.listPublicGroupings(),
      catalogQueries.listPublishedCatalogItems(),
    ]);
    const publishedIds = new Set(catalogItems.map((catalogItem) => catalogItem.id));
    return {
      categories: groups.categories
        .filter((group) => group.catalogItemIds.some((id) => publishedIds.has(id)))
        .map(projectPublicGrouping),
      collections: groups.collections
        .filter((group) => group.catalogItemIds.some((id) => publishedIds.has(id)))
        .map(projectPublicGrouping),
    };
  },
  readPublishedCategory: async (slug) =>
    publicListing(await groupingQueries.findPublicCategory(slug)),
  readPublishedCollection: async (slug) =>
    publicListing(await groupingQueries.findPublicCollection(slug)),
});
