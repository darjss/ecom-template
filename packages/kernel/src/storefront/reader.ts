import {
  CatalogItemIdSchema,
  PublicBundleDetailSchema,
  PublicGroupingListingSchema,
  PublicGroupingSchema,
  PublicProductDetailSchema,
  PublicProductSummarySchema,
  type AnnouncementDocument,
  type CommerceSettings,
  type HomepageDocument,
  type LocationsDocument,
  type NavigationDocument,
  type OrderingNoticesDocument,
  type PersonalizationDefinition,
  type PoliciesDocument,
  type StoreDefinition,
  type StorefrontIdentityDocument,
  type PublicBundleDetail,
  type PublicCatalogItemSummary,
  type CatalogSearchResponse,
  type PublicGrouping,
  type PublicGroupingListing,
  type PublicProductDetail,
  type PublicProductSummary,
  type StorefrontSummary,
} from "@ecom/contracts";
import * as v from "valibot";
import { bundleQueries, readPersonalizations } from "../bundles/persistence";
import { catalogQueries } from "../catalog/persistence";
import { searchCatalog } from "../catalog-search/operations";
import { readDatabaseHealth } from "../db/health";
import { groupingQueries } from "../grouping/persistence";
import { cmsQueries } from "../cms/persistence";

type StoreShellLink = {
  readonly label: string;
  readonly href: string;
  readonly openInNewTab: boolean;
  readonly children: readonly StoreShellLink[];
};

export type StoreShell = {
  readonly identity: StorefrontIdentityDocument | undefined;
  readonly announcement: AnnouncementDocument | undefined;
  readonly primary: readonly StoreShellLink[];
  readonly footer: readonly { readonly label: string; readonly items: readonly StoreShellLink[] }[];
  readonly locations: LocationsDocument | undefined;
  readonly policies: PoliciesDocument | undefined;
  readonly commerceSettings: CommerceSettings | undefined;
};

type HomeCmsContent = {
  readonly homepage: HomepageDocument | undefined;
  readonly announcement: AnnouncementDocument | undefined;
};

export type StorefrontReader = {
  readonly readSummary: () => Promise<StorefrontSummary>;
  readonly readIdentity: () => Promise<StorefrontIdentityDocument | undefined>;
  readonly readNavigation: () => Promise<NavigationDocument | undefined>;
  readonly readLocations: () => Promise<LocationsDocument | undefined>;
  readonly readPolicies: () => Promise<PoliciesDocument | undefined>;
  readonly readCommerceSettings: () => Promise<CommerceSettings | undefined>;
  readonly readShell: () => Promise<StoreShell>;
  readonly readHomeCmsContent: (status?: "draft" | "published") => Promise<HomeCmsContent>;
  readonly readOrderingNotices: (
    status?: "draft" | "published",
  ) => Promise<OrderingNoticesDocument | undefined>;
  readonly listPublishedCatalogItems: () => Promise<readonly PublicCatalogItemSummary[]>;
  readonly searchCatalog: (input: {
    readonly query: string;
    readonly category?: string;
    readonly collection?: string;
    readonly page: number;
    readonly limit: number;
  }) => Promise<CatalogSearchResponse>;
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

const readStoreShell = async (
  capabilities: StoreDefinition["profile"]["capabilities"],
): Promise<StoreShell> => {
  const [
    identity,
    announcement,
    navigation,
    locations,
    policies,
    commerceSettings,
    catalogItems,
    groupings,
  ] = await Promise.all([
    cmsQueries.read("storefront_identity", "published"),
    cmsQueries.read("announcement", "published"),
    cmsQueries.read("navigation", "published"),
    cmsQueries.read("locations", "published"),
    cmsQueries.read("policies", "published"),
    cmsQueries.readSettings(),
    catalogQueries.listPublishedCatalogItems(),
    groupingQueries.listPublicGroupings(),
  ]);
  const catalogById = new Map(catalogItems.map((item) => [item.id, item]));
  const categoryById = new Map(groupings.categories.map((group) => [group.id, group]));
  const collectionById = new Map(groupings.collections.map((group) => [group.id, group]));
  const locationDocument = locations?.kind === "locations" ? locations.content : undefined;
  const policyDocument = policies?.kind === "policies" ? policies.content : undefined;
  const locationIds = new Set(
    locationDocument?.locations.filter(({ active }) => active).map(({ id }) => id),
  );
  const policyById = new Map(policyDocument?.policies.map((policy) => [policy.id, policy]));
  const resolveDestination = (
    destination: NavigationDocument["primary"][number]["destination"],
  ) => {
    switch (destination.kind) {
      case "home":
        return { href: "/", openInNewTab: false };
      case "category": {
        const category = categoryById.get(destination.id);
        return category ? { href: `/categories/${category.slug}`, openInNewTab: false } : undefined;
      }
      case "collection": {
        const collection = collectionById.get(destination.id);
        return collection
          ? { href: `/collections/${collection.slug}`, openInNewTab: false }
          : undefined;
      }
      case "catalog_item": {
        const item = catalogById.get(destination.id);
        return item
          ? {
              href: `/${item.kind === "bundle" ? "bundles" : "products"}/${item.slug}`,
              openInNewTab: false,
            }
          : undefined;
      }
      case "location":
        return locationIds.has(destination.id)
          ? { href: `/locations/${destination.id}`, openInNewTab: false }
          : undefined;
      case "policy": {
        const policy = policyById.get(destination.id);
        return policy ? { href: `/policies/${policy.kind}`, openInNewTab: false } : undefined;
      }
      case "external":
        return { href: destination.url, openInNewTab: destination.openInNewTab };
    }
  };
  const navigationDocument = navigation?.kind === "navigation" ? navigation.content : undefined;
  const primary =
    navigationDocument?.primary.flatMap((item) => {
      const target = item.enabled ? resolveDestination(item.destination) : undefined;
      return target
        ? [
            {
              label: item.label,
              ...target,
              children: item.children.flatMap((child) => {
                const childTarget = child.enabled
                  ? resolveDestination(child.destination)
                  : undefined;
                return childTarget ? [{ label: child.label, ...childTarget, children: [] }] : [];
              }),
            },
          ]
        : [];
    }) ?? [];
  const footer =
    navigationDocument?.footer.map((group) => ({
      label: group.label,
      items: group.items.flatMap((item) => {
        const target = item.enabled ? resolveDestination(item.destination) : undefined;
        return target ? [{ label: item.label, ...target, children: [] }] : [];
      }),
    })) ?? [];
  return {
    identity: identity?.kind === "storefront_identity" ? identity.content : undefined,
    announcement: announcement?.kind === "announcement" ? announcement.content : undefined,
    primary,
    footer,
    locations: locationDocument
      ? {
          ...locationDocument,
          locations: locationDocument.locations.map((location) => ({
            ...location,
            pickupEnabled:
              location.pickupEnabled &&
              capabilities.pickup &&
              commerceSettings?.pickupEnabled === true,
          })),
        }
      : undefined,
    policies: policyDocument,
    commerceSettings,
  };
};

const readCmsWithPublishedFallback = async (
  kind: "homepage" | "announcement" | "ordering_notices",
  status: "draft" | "published",
) =>
  (await cmsQueries.read(kind, status)) ??
  (status === "draft" ? await cmsQueries.read(kind, "published") : undefined);

const readHomeCmsContent = async (status: "draft" | "published") => {
  const [homepage, announcement] = await Promise.all([
    readCmsWithPublishedFallback("homepage", status),
    readCmsWithPublishedFallback("announcement", status),
  ]);
  return {
    homepage: homepage?.kind === "homepage" ? homepage.content : undefined,
    announcement: announcement?.kind === "announcement" ? announcement.content : undefined,
  };
};

const readOrderingNotices = async (status: "draft" | "published") => {
  const document = await readCmsWithPublishedFallback("ordering_notices", status);
  return document?.kind === "ordering_notices" ? document.content : undefined;
};

export const createStorefrontReader = (
  summary: StorefrontSummary,
  capabilities: StoreDefinition["profile"]["capabilities"],
): StorefrontReader => ({
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
  readShell: () => readStoreShell(capabilities),
  readHomeCmsContent: (status = "published") => readHomeCmsContent(status),
  readOrderingNotices: (status = "published") => readOrderingNotices(status),
  listPublishedCatalogItems: () => catalogQueries.listPublishedCatalogItems(),
  searchCatalog: async (input) => {
    const result = await searchCatalog(input);
    if (result.isErr()) {
      throw new Error("Catalog search is unavailable");
    }
    return result.value;
  },
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
    const { state: _state, createdAt: _createdAt, updatedAt: _updatedAt, ...publicBundle } = bundle;
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
