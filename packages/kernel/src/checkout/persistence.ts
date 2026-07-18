import {
  LocationsDocumentSchema,
  type CatalogItemId,
  type CheckoutQuoteInput,
} from "@ecom/contracts";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import * as v from "valibot";
import { database } from "../db/database";
import {
  bundleComponents,
  catalogItemCategories,
  catalogItemCollections,
  catalogItems,
  categories,
  cmsDocuments,
  collections,
  commerceSettings,
  discountRules,
  discountTargets,
  personalizationDefinitions,
  personalizationValues,
  skus,
  stockItems,
  variants,
} from "../db/schema";

export const checkoutQueries = {
  async readQuoteSnapshot(input: CheckoutQuoteInput) {
    const variantIds = input.lines.flatMap((line) =>
      line.kind === "variant" ? [line.variantId] : [],
    );
    const bundleIds = input.lines.flatMap((line) =>
      line.kind === "bundle" ? [line.bundleId] : [],
    );
    const db = database();
    const componentProducts = alias(catalogItems, "checkout_component_products");
    const variantRowsQuery = db
      .select({
        id: sql<string>`${variants.id}`.as("checkout_variant_id"),
        catalogItemId: sql<string>`${variants.productId}`.as("checkout_variant_product_id"),
        variantState: sql<typeof variants.$inferSelect.state>`${variants.state}`.as(
          "checkout_variant_state",
        ),
        productState: sql<typeof catalogItems.$inferSelect.state>`${catalogItems.state}`.as(
          "checkout_variant_product_state",
        ),
        productKind: sql<typeof catalogItems.$inferSelect.kind>`${catalogItems.kind}`.as(
          "checkout_variant_product_kind",
        ),
        name: sql<string>`${catalogItems.name}`.as("checkout_variant_product_name"),
        unitPriceMnt: sql<number | null>`${variants.priceOverrideMnt}`.as("checkout_variant_price"),
        productPriceMnt: sql<number>`${catalogItems.priceMnt}`.as("checkout_variant_product_price"),
        sku: sql<string>`${skus.sku}`.as("checkout_variant_sku"),
        onHandQuantity: sql<number>`${stockItems.onHandQuantity}`.as("checkout_variant_on_hand"),
        reservedQuantity: sql<number>`${stockItems.reservedQuantity}`.as(
          "checkout_variant_reserved",
        ),
      })
      .from(variants)
      .innerJoin(catalogItems, eq(catalogItems.id, variants.productId))
      .innerJoin(skus, eq(skus.variantId, variants.id))
      .innerJoin(stockItems, eq(stockItems.variantId, variants.id))
      .where(inArray(variants.id, variantIds));
    const bundleRowsQuery = db
      .select({
        id: sql<string>`${catalogItems.id}`.as("checkout_bundle_id"),
        catalogItemId: sql<string>`${catalogItems.id}`.as("checkout_bundle_catalog_id"),
        state: sql<typeof catalogItems.$inferSelect.state>`${catalogItems.state}`.as(
          "checkout_bundle_state",
        ),
        kind: sql<typeof catalogItems.$inferSelect.kind>`${catalogItems.kind}`.as(
          "checkout_bundle_kind",
        ),
        name: sql<string>`${catalogItems.name}`.as("checkout_bundle_name"),
        unitPriceMnt: sql<number>`${catalogItems.priceMnt}`.as("checkout_bundle_price"),
        sku: sql<string>`${skus.sku}`.as("checkout_bundle_sku"),
      })
      .from(catalogItems)
      .innerJoin(skus, eq(skus.bundleId, catalogItems.id))
      .where(inArray(catalogItems.id, bundleIds));
    const componentRowsQuery = db
      .select({
        bundleId: sql<string>`${bundleComponents.bundleId}`.as("checkout_component_bundle_id"),
        variantId: sql<string>`${bundleComponents.variantId}`.as("checkout_component_variant_id"),
        quantity: sql<number>`${bundleComponents.quantity}`.as("checkout_component_quantity"),
        variantState: sql<typeof variants.$inferSelect.state>`${variants.state}`.as(
          "checkout_component_variant_state",
        ),
        productState: sql<typeof catalogItems.$inferSelect.state>`${componentProducts.state}`.as(
          "checkout_component_product_state",
        ),
        productKind: sql<typeof catalogItems.$inferSelect.kind>`${componentProducts.kind}`.as(
          "checkout_component_product_kind",
        ),
        sku: sql<string>`${skus.sku}`.as("checkout_component_sku"),
        onHandQuantity: sql<number>`${stockItems.onHandQuantity}`.as("checkout_component_on_hand"),
        reservedQuantity: sql<number>`${stockItems.reservedQuantity}`.as(
          "checkout_component_reserved",
        ),
      })
      .from(bundleComponents)
      .innerJoin(variants, eq(variants.id, bundleComponents.variantId))
      .innerJoin(componentProducts, eq(componentProducts.id, variants.productId))
      .innerJoin(skus, eq(skus.variantId, variants.id))
      .innerJoin(stockItems, eq(stockItems.variantId, variants.id))
      .where(inArray(bundleComponents.bundleId, bundleIds));
    const productIds = db
      .select({ id: variants.productId })
      .from(variants)
      .where(inArray(variants.id, variantIds));
    const personalizationItemPredicate = or(
      inArray(personalizationDefinitions.catalogItemId, bundleIds),
      inArray(personalizationDefinitions.catalogItemId, productIds),
    );
    const definitionQuery = db
      .select()
      .from(personalizationDefinitions)
      .where(personalizationItemPredicate)
      .orderBy(asc(personalizationDefinitions.position));
    const valueQuery = db
      .select()
      .from(personalizationValues)
      .where(
        inArray(
          personalizationValues.personalizationId,
          db
            .select({ id: personalizationDefinitions.id })
            .from(personalizationDefinitions)
            .where(personalizationItemPredicate),
        ),
      )
      .orderBy(asc(personalizationValues.position));
    const [
      variantRows,
      bundleRows,
      componentRows,
      allDefinitions,
      allValues,
      ruleRows,
      targetRows,
      categoryMemberships,
      collectionMemberships,
      settingRows,
      locationRows,
    ] = await db.batch([
      variantRowsQuery,
      bundleRowsQuery,
      componentRowsQuery,
      definitionQuery,
      valueQuery,
      db
        .select()
        .from(discountRules)
        .where(eq(discountRules.state, "active"))
        .orderBy(asc(discountRules.id)),
      db
        .select({
          discountRuleId: sql<string>`${discountTargets.discountRuleId}`.as(
            "checkout_target_rule_id",
          ),
          position: sql<number>`${discountTargets.position}`.as("checkout_target_position"),
          kind: sql<typeof discountTargets.$inferSelect.kind>`${discountTargets.kind}`.as(
            "checkout_target_kind",
          ),
          productId: sql<string | null>`${discountTargets.productId}`.as(
            "checkout_target_product_id",
          ),
          variantId: sql<string | null>`${discountTargets.variantId}`.as(
            "checkout_target_variant_id",
          ),
          categoryId: sql<string | null>`${discountTargets.categoryId}`.as(
            "checkout_target_category_id",
          ),
          collectionId: sql<string | null>`${discountTargets.collectionId}`.as(
            "checkout_target_collection_id",
          ),
          categoryState: sql<typeof categories.$inferSelect.state | null>`${categories.state}`.as(
            "checkout_target_category_state",
          ),
          collectionState: sql<
            typeof collections.$inferSelect.state | null
          >`${collections.state}`.as("checkout_target_collection_state"),
        })
        .from(discountTargets)
        .leftJoin(categories, eq(categories.id, discountTargets.categoryId))
        .leftJoin(collections, eq(collections.id, discountTargets.collectionId))
        .orderBy(asc(discountTargets.position)),
      db.select().from(catalogItemCategories),
      db.select().from(catalogItemCollections),
      db.select().from(commerceSettings).where(eq(commerceSettings.key, "commerce")).limit(1),
      db
        .select({ contentJson: cmsDocuments.contentJson })
        .from(cmsDocuments)
        .where(and(eq(cmsDocuments.kind, "locations"), eq(cmsDocuments.status, "published")))
        .limit(1),
    ] as const);
    const resolvedItemIds = new Set<CatalogItemId>([
      ...variantRows.map(({ catalogItemId }) => catalogItemId as CatalogItemId),
      ...bundleRows.map(({ catalogItemId }) => catalogItemId as CatalogItemId),
    ]);
    const definitions = allDefinitions.filter(({ catalogItemId }) =>
      resolvedItemIds.has(catalogItemId as CatalogItemId),
    );
    const locationRow = locationRows.at(0);
    return {
      variantRows,
      bundleRows,
      componentRows,
      definitions,
      values: allValues,
      rules: ruleRows,
      targets: targetRows,
      categoryMemberships,
      collectionMemberships,
      settings: settingRows.at(0),
      locations: locationRow
        ? v.parse(LocationsDocumentSchema, JSON.parse(locationRow.contentJson)).locations
        : [],
      quotedAt: new Date().toISOString(),
    };
  },
};
