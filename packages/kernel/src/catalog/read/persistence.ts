import { ProductSchema, type Product, type ProductId } from "@ecom/contracts";
import { and, desc, eq } from "drizzle-orm";
import * as v from "valibot";
import { database } from "../../db/database";
import { catalogCachePurgeDebts, catalogItems, skus, stockItems, variants } from "../../db/schema";

const productProjection = {
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
    .select(productProjection)
    .from(catalogItems)
    .innerJoin(variants, and(eq(variants.productId, catalogItems.id), eq(variants.isDefault, true)))
    .innerJoin(skus, eq(skus.variantId, variants.id))
    .innerJoin(stockItems, eq(stockItems.variantId, variants.id))
    .leftJoin(catalogCachePurgeDebts, eq(catalogCachePurgeDebts.productId, catalogItems.id));

const projectProduct = (row: Awaited<ReturnType<typeof productQuery>>[number]): Product =>
  v.parse(ProductSchema, {
    id: row.id,
    defaultVariantId: row.defaultVariantId,
    stockItemId: row.stockItemId,
    slug: row.slug,
    state: row.state,
    name: row.name,
    description: row.description,
    priceMnt: row.priceMnt,
    sku: row.sku,
    onHandQuantity: row.onHandQuantity,
    reservedQuantity: row.reservedQuantity,
    cachePurgeDebt:
      row.cachePurgeAttemptCount === null
        ? null
        : {
            attemptCount: row.cachePurgeAttemptCount,
            requestId: row.cachePurgeRequestId,
            lastAttemptedAt: row.cachePurgeLastAttemptedAt?.toISOString() ?? null,
          },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });

export const findCatalogProductById = async (id: ProductId) => {
  const rows = await productQuery().where(eq(catalogItems.id, id)).limit(1);
  const row = rows.at(0);
  return row ? projectProduct(row) : undefined;
};

export const catalogReaderQueries = {
  findById: findCatalogProductById,

  async listAll() {
    const rows = await productQuery().orderBy(desc(catalogItems.createdAt));
    return rows.map(projectProduct);
  },

  async listPublished() {
    return database()
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
    return rows.at(0);
  },
};
