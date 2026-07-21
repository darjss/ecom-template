import {
  CatalogItemIdSchema,
  ProductIdSchema,
  ProductSchema,
  PublicCatalogItemSummarySchema,
  PublicProductDetailSchema,
  PublicProductSummarySchema,
  type CatalogItemId,
  type Product,
  type ProductId,
} from "@ecom/contracts";
import { and, desc, eq, inArray } from "drizzle-orm";
import * as v from "valibot";
import { database } from "../db/database";
import { catalogCachePurgeDebts, catalogItems, stockItems, variants } from "../db/schema";
import { catalogMediaQueries } from "../catalog-media/persistence";
import {
  readProductOptionConfiguration,
  readProductOptionConfigurations,
} from "../catalog-variants/persistence";

const ReturnedProductSchema = v.strictObject({
  id: v.string(),
  defaultVariantId: v.string(),
  stockItemId: v.string(),
  slug: v.string(),
  state: v.string(),
  name: v.string(),
  description: v.string(),
  priceMnt: v.number(),
  sku: v.string(),
  onHandQuantity: v.number(),
  reservedQuantity: v.number(),
  cachePurgeAttemptCount: v.nullable(v.number()),
  cachePurgeRequestId: v.nullable(v.string()),
  cachePurgeLastAttemptedAt: v.nullable(v.date()),
  createdAt: v.date(),
  updatedAt: v.date(),
});

const productSelection = {
  id: catalogItems.id,
  defaultVariantId: variants.id,
  stockItemId: stockItems.id,
  slug: catalogItems.slug,
  state: catalogItems.state,
  name: catalogItems.name,
  description: catalogItems.description,
  priceMnt: catalogItems.priceMnt,
  sku: variants.sku,
  onHandQuantity: stockItems.onHandQuantity,
  reservedQuantity: stockItems.reservedQuantity,
  cachePurgeAttemptCount: catalogCachePurgeDebts.attemptCount,
  cachePurgeRequestId: catalogCachePurgeDebts.requestId,
  cachePurgeLastAttemptedAt: catalogCachePurgeDebts.lastAttemptedAt,
  createdAt: catalogItems.createdAt,
  updatedAt: catalogItems.updatedAt,
};

const productQuery = () =>
  database()
    .select(productSelection)
    .from(catalogItems)
    .innerJoin(variants, and(eq(variants.productId, catalogItems.id), eq(variants.isDefault, true)))
    .innerJoin(stockItems, eq(stockItems.variantId, variants.id))
    .leftJoin(catalogCachePurgeDebts, eq(catalogCachePurgeDebts.productId, catalogItems.id));

const projectProduct = (
  source: unknown,
  images: Product["images"],
  optionConfiguration: Product["optionConfiguration"],
): Product => {
  const row = v.parse(ReturnedProductSchema, source);
  const { cachePurgeAttemptCount, cachePurgeRequestId, cachePurgeLastAttemptedAt, ...product } =
    row;
  return v.parse(ProductSchema, {
    ...product,
    cachePurgeDebt:
      cachePurgeAttemptCount === null
        ? null
        : {
            attemptCount: cachePurgeAttemptCount,
            requestId: cachePurgeRequestId,
            lastAttemptedAt: cachePurgeLastAttemptedAt?.toISOString() ?? null,
          },
    images,
    optionConfiguration,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  });
};

export const findCatalogProductById = async (id: ProductId) => {
  const rows = await productQuery().where(eq(catalogItems.id, id)).limit(1);
  const row = rows.at(0);
  if (!row) {
    return undefined;
  }
  const [images, optionConfiguration] = await Promise.all([
    catalogMediaQueries.listForCatalogItems([id]),
    readProductOptionConfiguration(id),
  ]);
  return projectProduct(
    row,
    images.map(({ image }) => image),
    optionConfiguration,
  );
};

export const catalogReaderQueries = {
  findById: findCatalogProductById,

  async listPublishedCatalogItems(ids?: readonly CatalogItemId[]) {
    if (ids?.length === 0) {
      return [];
    }
    const rows = await database()
      .select({
        id: catalogItems.id,
        kind: catalogItems.kind,
        slug: catalogItems.slug,
        name: catalogItems.name,
        description: catalogItems.description,
        priceMnt: catalogItems.priceMnt,
      })
      .from(catalogItems)
      .where(
        ids
          ? and(eq(catalogItems.state, "published"), inArray(catalogItems.id, ids))
          : eq(catalogItems.state, "published"),
      )
      .orderBy(desc(catalogItems.createdAt));
    const catalogItemIds = rows.map((row) => v.parse(CatalogItemIdSchema, row.id));
    const images = await catalogMediaQueries.listPublicForCatalogItems(catalogItemIds);
    return rows.map((row) =>
      v.parse(PublicCatalogItemSummarySchema, {
        ...row,
        id: v.parse(CatalogItemIdSchema, row.id),
        images: images
          .filter(({ catalogItemId }) => catalogItemId === row.id)
          .map(({ image }) => image),
      }),
    );
  },

  async listAll() {
    const rows = await productQuery().orderBy(desc(catalogItems.createdAt));
    const ids = rows.map((row) => v.parse(ProductIdSchema, row.id));
    const [images, configurations] = await Promise.all([
      catalogMediaQueries.listForCatalogItems(ids),
      readProductOptionConfigurations(ids),
    ]);
    return rows.map((row) => {
      const id = v.parse(ProductIdSchema, row.id);
      const optionConfiguration = configurations.find(
        ({ productId }) => productId === id,
      )?.configuration;
      if (!optionConfiguration) {
        throw new Error("Product option configuration is unavailable");
      }
      return projectProduct(
        row,
        images.filter(({ catalogItemId }) => catalogItemId === id).map(({ image }) => image),
        optionConfiguration,
      );
    });
  },

  async listPublished() {
    const rows = await database()
      .select({
        id: catalogItems.id,
        slug: catalogItems.slug,
        name: catalogItems.name,
        description: catalogItems.description,
        priceMnt: catalogItems.priceMnt,
      })
      .from(catalogItems)
      .where(and(eq(catalogItems.state, "published"), eq(catalogItems.kind, "product")))
      .orderBy(desc(catalogItems.createdAt));
    const ids = rows.map((row) => v.parse(ProductIdSchema, row.id));
    const images = await catalogMediaQueries.listPublicForCatalogItems(ids);
    return rows.map((row) =>
      v.parse(PublicProductSummarySchema, {
        ...row,
        images: images
          .filter(({ catalogItemId }) => catalogItemId === row.id)
          .map(({ image }) => image),
      }),
    );
  },

  async findPublishedBySlug(slug: string) {
    const rows = await database()
      .select({
        id: catalogItems.id,
        slug: catalogItems.slug,
        name: catalogItems.name,
        description: catalogItems.description,
        priceMnt: catalogItems.priceMnt,
      })
      .from(catalogItems)
      .where(
        and(
          eq(catalogItems.state, "published"),
          eq(catalogItems.kind, "product"),
          eq(catalogItems.slug, slug),
        ),
      )
      .limit(1);
    const row = rows.at(0);
    if (!row) {
      return undefined;
    }
    const id = v.parse(ProductIdSchema, row.id);
    const [images, configuration] = await Promise.all([
      catalogMediaQueries.listPublicForCatalogItems([id]),
      readProductOptionConfiguration(id),
    ]);
    const activeGroups = configuration.groups.filter(({ state }) => state === "active");
    const activeValueIds = new Set(
      activeGroups.flatMap(({ values }) =>
        values.filter(({ state }) => state === "active").map(({ id: valueId }) => valueId),
      ),
    );
    const publicImages = images.map(({ image }) => image);
    return v.parse(PublicProductDetailSchema, {
      ...row,
      images: publicImages,
      optionGroups: activeGroups.map((group) => ({
        id: group.id,
        label: group.label,
        position: group.position,
        values: group.values
          .filter(({ state }) => state === "active")
          .map(({ id: valueId, label, position }) => ({ id: valueId, label, position })),
      })),
      variants: configuration.variants
        .filter(
          (variant) =>
            variant.state === "active" &&
            (variant.isDefault ? activeGroups.length === 0 : activeGroups.length > 0),
        )
        .map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          priceMnt: variant.priceOverrideMnt ?? row.priceMnt,
          image:
            publicImages.find(({ mediaAssetId }) => mediaAssetId === variant.imageMediaAssetId) ??
            null,
          optionValues: variant.optionValueIds
            .filter((valueId) => activeValueIds.has(valueId))
            .flatMap((valueId) =>
              activeGroups.flatMap((group) => {
                const value = group.values.find(({ id: candidateId }) => candidateId === valueId);
                return value
                  ? [
                      {
                        groupId: group.id,
                        groupLabel: group.label,
                        valueId: value.id,
                        valueLabel: value.label,
                      },
                    ]
                  : [];
              }),
            ),
        })),
    });
  },
};
