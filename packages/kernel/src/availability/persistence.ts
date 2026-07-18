import type { BundleId, VariantId } from "@ecom/contracts";
import { eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { database } from "../db/database";
import { bundleComponents, catalogItems, stockItems, variants } from "../db/schema";

export const availabilityQueries = {
  async readSnapshot(variantIds: readonly VariantId[], bundleIds: readonly BundleId[]) {
    const componentProducts = alias(catalogItems, "availability_component_products");
    const db = database();
    const variantInventoryQuery = db
      .select({
        id: variants.id,
        variantState: variants.state,
        priceOverrideMnt: variants.priceOverrideMnt,
        onHandQuantity: stockItems.onHandQuantity,
        reservedQuantity: stockItems.reservedQuantity,
      })
      .from(variants)
      .innerJoin(stockItems, eq(stockItems.variantId, variants.id))
      .where(inArray(variants.id, variantIds));
    const variantProductQuery = db
      .select({
        id: variants.id,
        productState: catalogItems.state,
        productKind: catalogItems.kind,
        productPriceMnt: catalogItems.priceMnt,
      })
      .from(variants)
      .innerJoin(catalogItems, eq(catalogItems.id, variants.productId))
      .where(inArray(variants.id, variantIds));
    const bundleQuery = db
      .select({
        id: catalogItems.id,
        state: catalogItems.state,
        kind: catalogItems.kind,
        priceMnt: catalogItems.priceMnt,
      })
      .from(catalogItems)
      .where(inArray(catalogItems.id, bundleIds));
    const componentInventoryQuery = db
      .select({
        bundleId: bundleComponents.bundleId,
        variantId: bundleComponents.variantId,
        quantity: bundleComponents.quantity,
        variantState: variants.state,
        onHandQuantity: stockItems.onHandQuantity,
        reservedQuantity: stockItems.reservedQuantity,
      })
      .from(bundleComponents)
      .innerJoin(variants, eq(variants.id, bundleComponents.variantId))
      .leftJoin(stockItems, eq(stockItems.variantId, variants.id))
      .where(inArray(bundleComponents.bundleId, bundleIds));
    const componentProductQuery = db
      .select({
        bundleId: bundleComponents.bundleId,
        variantId: bundleComponents.variantId,
        productState: componentProducts.state,
        productKind: componentProducts.kind,
      })
      .from(bundleComponents)
      .innerJoin(variants, eq(variants.id, bundleComponents.variantId))
      .innerJoin(componentProducts, eq(componentProducts.id, variants.productId))
      .where(inArray(bundleComponents.bundleId, bundleIds));
    if (bundleIds.length === 0) {
      const [inventoryRows, productRows] = await db.batch([
        variantInventoryQuery,
        variantProductQuery,
      ] as const);
      const products = new Map(productRows.map((row) => [row.id, row]));
      return {
        variantRows: inventoryRows.flatMap((row) => {
          const product = products.get(row.id);
          return product ? [{ ...row, ...product }] : [];
        }),
        bundles: [],
        components: [],
        checkedAt: new Date().toISOString(),
      };
    }
    if (variantIds.length === 0) {
      const [bundles, inventoryRows, productRows] = await db.batch([
        bundleQuery,
        componentInventoryQuery,
        componentProductQuery,
      ] as const);
      const products = new Map(productRows.map((row) => [`${row.bundleId}:${row.variantId}`, row]));
      return {
        variantRows: [],
        bundles,
        components: inventoryRows.flatMap((row) => {
          const product = products.get(`${row.bundleId}:${row.variantId}`);
          return product ? [{ ...row, ...product }] : [];
        }),
        checkedAt: new Date().toISOString(),
      };
    }
    const [variantInventory, variantProducts, bundles, componentInventory, componentProductsRows] =
      await db.batch([
        variantInventoryQuery,
        variantProductQuery,
        bundleQuery,
        componentInventoryQuery,
        componentProductQuery,
      ] as const);
    const productsByVariant = new Map(variantProducts.map((row) => [row.id, row]));
    const productsByComponent = new Map(
      componentProductsRows.map((row) => [`${row.bundleId}:${row.variantId}`, row]),
    );
    return {
      variantRows: variantInventory.flatMap((row) => {
        const product = productsByVariant.get(row.id);
        return product ? [{ ...row, ...product }] : [];
      }),
      bundles,
      components: componentInventory.flatMap((row) => {
        const product = productsByComponent.get(`${row.bundleId}:${row.variantId}`);
        return product ? [{ ...row, ...product }] : [];
      }),
      checkedAt: new Date().toISOString(),
    };
  },
};
