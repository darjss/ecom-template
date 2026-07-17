import {
  ProductIdSchema,
  ProductSchema,
  PublicProductDetailSchema,
  PublicProductSummarySchema,
  type Product,
  type ProductId,
} from "@ecom/contracts";
import { and, desc, eq } from "drizzle-orm";
import * as v from "valibot";
import { database } from "../db/database";
import { catalogCachePurgeDebts, catalogItems, skus, stockItems, variants } from "../db/schema";
import { catalogMediaQueries } from "../catalog/media-persistence";

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
  sku: skus.sku,
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
    .innerJoin(skus, eq(skus.variantId, variants.id))
    .innerJoin(stockItems, eq(stockItems.variantId, variants.id))
    .leftJoin(catalogCachePurgeDebts, eq(catalogCachePurgeDebts.productId, catalogItems.id));

const projectProduct = (source: unknown, images: Product["images"]): Product => {
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
  const images = await catalogMediaQueries.listForCatalogItems([id]);
  return projectProduct(
    row,
    images.map(({ image }) => image),
  );
};

export const catalogReaderQueries = {
  findById: findCatalogProductById,

  async listAll() {
    const rows = await productQuery().orderBy(desc(catalogItems.createdAt));
    const products = rows.map((row) => projectProduct(row, []));
    const images = await catalogMediaQueries.listForCatalogItems(products.map(({ id }) => id));
    return products.map((product) => ({
      ...product,
      images: images
        .filter(({ catalogItemId }) => catalogItemId === product.id)
        .map(({ image }) => image),
    }));
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
      .innerJoin(
        variants,
        and(
          eq(variants.productId, catalogItems.id),
          eq(variants.isDefault, true),
          eq(variants.state, "active"),
        ),
      )
      .where(eq(catalogItems.state, "published"))
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
        variantId: variants.id,
      })
      .from(catalogItems)
      .innerJoin(
        variants,
        and(
          eq(variants.productId, catalogItems.id),
          eq(variants.isDefault, true),
          eq(variants.state, "active"),
        ),
      )
      .where(and(eq(catalogItems.state, "published"), eq(catalogItems.slug, slug)))
      .limit(1);
    const row = rows.at(0);
    if (!row) {
      return undefined;
    }
    const id = v.parse(ProductIdSchema, row.id);
    const images = await catalogMediaQueries.listPublicForCatalogItems([id]);
    return v.parse(PublicProductDetailSchema, {
      ...row,
      images: images.map(({ image }) => image),
    });
  },
};
