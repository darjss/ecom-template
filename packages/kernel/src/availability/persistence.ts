import type { BundleId, VariantId } from "@ecom/contracts";
import { eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { database } from "../db/database";
import { bundleComponents, catalogItems, stockItems, variants } from "../db/schema";

export const availabilityQueries = {
  async readSnapshot(variantIds: readonly VariantId[], bundleIds: readonly BundleId[]) {
    const componentProducts = alias(catalogItems, "availability_component_products");
    const db = database();
    const [variantRows, bundles, components] = await db.batch([
      db
        .select({
          id: variants.id,
          variantState: variants.state,
          productState: catalogItems.state,
          productKind: catalogItems.kind,
          productPriceMnt: catalogItems.priceMnt,
          priceOverrideMnt: variants.priceOverrideMnt,
          onHandQuantity: stockItems.onHandQuantity,
          reservedQuantity: stockItems.reservedQuantity,
        })
        .from(variants)
        .innerJoin(catalogItems, eq(catalogItems.id, variants.productId))
        .innerJoin(stockItems, eq(stockItems.variantId, variants.id))
        .where(inArray(variants.id, variantIds)),
      db
        .select({
          id: catalogItems.id,
          state: catalogItems.state,
          kind: catalogItems.kind,
          priceMnt: catalogItems.priceMnt,
        })
        .from(catalogItems)
        .where(inArray(catalogItems.id, bundleIds)),
      db
        .select({
          bundleId: bundleComponents.bundleId,
          variantId: bundleComponents.variantId,
          quantity: bundleComponents.quantity,
          variantState: variants.state,
          productState: componentProducts.state,
          productKind: componentProducts.kind,
          onHandQuantity: stockItems.onHandQuantity,
          reservedQuantity: stockItems.reservedQuantity,
        })
        .from(bundleComponents)
        .innerJoin(variants, eq(variants.id, bundleComponents.variantId))
        .innerJoin(componentProducts, eq(componentProducts.id, variants.productId))
        .innerJoin(stockItems, eq(stockItems.variantId, variants.id))
        .where(inArray(bundleComponents.bundleId, bundleIds)),
    ] as const);
    return { variantRows, bundles, components, checkedAt: new Date().toISOString() };
  },
};
