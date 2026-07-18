import type { BundleId, VariantId } from "@ecom/contracts";
import { eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { database } from "../db/database";
import { bundleComponents, catalogItems, stockItems, variants } from "../db/schema";

export type AvailableVariantRow = {
  readonly id: string;
  readonly variantState: "active" | "archived";
  readonly productState: "draft" | "published" | "archived";
  readonly productKind: "product" | "bundle";
  readonly productPriceMnt: number;
  readonly priceOverrideMnt: number | null;
  readonly onHandQuantity: number;
  readonly reservedQuantity: number;
};

export type AvailableBundleRow = {
  readonly id: string;
  readonly state: "draft" | "published" | "archived";
  readonly kind: "product" | "bundle";
  readonly priceMnt: number;
};

export type AvailableBundleComponentRow = {
  readonly bundleId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly variantState: "active" | "archived";
  readonly productState: "draft" | "published" | "archived";
  readonly productKind: "product" | "bundle";
  readonly onHandQuantity: number;
  readonly reservedQuantity: number;
};

export const availabilityQueries = {
  async readVariants(ids: readonly VariantId[]): Promise<AvailableVariantRow[]> {
    if (ids.length === 0) return [];
    return database()
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
      .where(inArray(variants.id, ids));
  },

  async readBundles(ids: readonly BundleId[]) {
    if (ids.length === 0) {
      return {
        bundles: [] as AvailableBundleRow[],
        components: [] as AvailableBundleComponentRow[],
      };
    }
    const componentProducts = alias(catalogItems, "availability_component_products");
    const db = database();
    const [bundles, components] = await Promise.all([
      db
        .select({
          id: catalogItems.id,
          state: catalogItems.state,
          kind: catalogItems.kind,
          priceMnt: catalogItems.priceMnt,
        })
        .from(catalogItems)
        .where(inArray(catalogItems.id, ids)),
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
        .where(inArray(bundleComponents.bundleId, ids)),
    ]);
    return { bundles, components };
  },
};
