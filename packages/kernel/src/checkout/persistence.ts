import {
  DiscountTargetSchema,
  LocationsDocumentSchema,
  PlaceOrderResultSchema,
  createAuditEventId,
  createFulfillmentId,
  createOrderId,
  createOrderLineId,
  createPaymentEntryId,
  createPaymentId,
  type CatalogItemId,
  type CustomerId,
  type CheckoutQuote,
  type CheckoutQuoteInput,
  type PlaceOrderInput,
  type PlaceOrderResult,
} from "@ecom/contracts";
import { and, asc, eq, exists, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import * as v from "valibot";
import { database } from "../db/database";
import type { OrderStatusAccess } from "../order";
import type { CommercialFacts } from "./commercial";
import {
  auditEvents,
  bundleComponents,
  catalogItemCategories,
  catalogItemCollections,
  catalogItems,
  categories,
  cmsDocuments,
  collections,
  commerceSettings,
  discountRules,
  fulfillments,
  optionGroups,
  orderLines,
  orders,
  paymentEntries,
  payments,
  optionValues,
  personalizationDefinitions,
  personalizationValues,
  placementIdempotency,
  skus,
  stockItems,
  variantOptionValues,
  variants,
} from "../db/schema";

export const checkoutQueries = {
  async readOptions() {
    const db = database();
    const [settingRows, locationRows] = await db.batch([
      db.select().from(commerceSettings).where(eq(commerceSettings.key, "commerce")).limit(1),
      db
        .select({ contentJson: cmsDocuments.contentJson })
        .from(cmsDocuments)
        .where(and(eq(cmsDocuments.kind, "locations"), eq(cmsDocuments.status, "published")))
        .limit(1),
    ] as const);
    const locationRow = locationRows.at(0);
    return {
      settings: settingRows.at(0),
      locations: locationRow
        ? v.parse(LocationsDocumentSchema, JSON.parse(locationRow.contentJson)).locations
        : [],
    };
  },
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
        name: sql<string>`${componentProducts.name}`.as("checkout_component_name"),
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
    const optionRowsQuery = db
      .select({
        variantId: variantOptionValues.variantId,
        groupId: optionGroups.id,
        groupKey: optionGroups.key,
        groupLabel: optionGroups.label,
        groupPosition: optionGroups.position,
        valueId: optionValues.id,
        valueKey: optionValues.key,
        valueLabel: optionValues.label,
      })
      .from(variantOptionValues)
      .innerJoin(optionValues, eq(optionValues.id, variantOptionValues.optionValueId))
      .innerJoin(optionGroups, eq(optionGroups.id, optionValues.optionGroupId))
      .where(inArray(variantOptionValues.variantId, variantIds))
      .orderBy(asc(optionGroups.position));
    const [
      variantRows,
      bundleRows,
      componentRows,
      optionRows,
      allDefinitions,
      allValues,
      ruleRows,
      categoryRows,
      collectionRows,
      categoryMemberships,
      collectionMemberships,
      settingRows,
      locationRows,
    ] = await db.batch([
      variantRowsQuery,
      bundleRowsQuery,
      componentRowsQuery,
      optionRowsQuery,
      definitionQuery,
      valueQuery,
      db
        .select()
        .from(discountRules)
        .where(eq(discountRules.state, "active"))
        .orderBy(asc(discountRules.id)),
      db.select({ id: categories.id, state: categories.state }).from(categories),
      db.select({ id: collections.id, state: collections.state }).from(collections),
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
    const TargetListSchema = v.pipe(
      v.array(DiscountTargetSchema),
      v.minLength(1),
      v.maxLength(100),
    );
    return {
      variantRows,
      bundleRows,
      componentRows,
      optionRows,
      definitions,
      values: allValues,
      rules: ruleRows.map((rule) => ({
        ...rule,
        targets: v.parse(TargetListSchema, JSON.parse(rule.targetsJson)),
      })),
      categoryRows,
      collectionRows,
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
type PlacementDestination =
  | { kind: "delivery"; address: string }
  | { kind: "pickup"; locationId: string; name: string; address: string };

export const readPlacement = async (key: string) => {
  const rows = await database()
    .select({
      intentDigest: placementIdempotency.intentDigest,
      resultJson: placementIdempotency.resultJson,
    })
    .from(placementIdempotency)
    .where(eq(placementIdempotency.key, key))
    .limit(1);
  const row = rows.at(0);
  return row
    ? {
        intentDigest: row.intentDigest,
        result: v.parse(PlaceOrderResultSchema, JSON.parse(row.resultJson)),
      }
    : undefined;
};

export const commitPlacement = async (
  input: PlaceOrderInput,
  quote: CheckoutQuote,
  commercial: CommercialFacts,
  intentDigest: string,
  destination: PlacementDestination,
  customerId: CustomerId | null,
  statusAccess: OrderStatusAccess,
): Promise<PlaceOrderResult | undefined> => {
  const db = database();
  const orderId = createOrderId();
  const lineIds = new Map(quote.lines.map((line) => [line.position, createOrderLineId()]));
  const paymentId = createPaymentId();
  const fulfillmentId = createFulfillmentId();
  const correlationId = crypto.randomUUID();
  const now = new Date();
  const zeroTotal = quote.totalMnt === 0;
  const paymentResult = zeroTotal
    ? sql`NULL`
    : sql`json_object('id', ${paymentId}, 'method', 'bank_transfer', 'state', 'awaiting_confirmation', 'expectedAmountMnt', ${quote.totalMnt})`;
  const demand = new Map<string, number>();
  for (const line of quote.lines) {
    for (const item of line.demand) {
      demand.set(item.variantId, (demand.get(item.variantId) ?? 0) + item.quantity);
    }
  }
  const stockAvailable = [...demand].map(([variantId, quantity]) =>
    exists(
      db
        .select({ id: stockItems.id })
        .from(stockItems)
        .where(
          and(
            eq(stockItems.variantId, variantId),
            sql`${stockItems.onHandQuantity} - ${stockItems.reservedQuantity} >= ${quantity}`,
          ),
        ),
    ),
  );
  const catalogCurrent = commercial.lines.flatMap((line) => {
    const sourceCurrent =
      line.source.kind === "variant"
        ? sql`EXISTS (
            SELECT 1 FROM ${variants}
            JOIN ${catalogItems} ON ${catalogItems.id} = ${variants.productId}
            JOIN ${skus} ON ${skus.variantId} = ${variants.id}
            WHERE ${variants.id} = ${line.source.id}
              AND ${catalogItems.id} = ${line.source.catalogItemId}
              AND ${variants.state} = 'active'
              AND ${catalogItems.state} = 'published'
              AND ${catalogItems.kind} = 'product'
              AND coalesce(${variants.priceOverrideMnt}, ${catalogItems.priceMnt}) = ${line.unitPriceMnt}
              AND ${skus.sku} = ${line.sku}
          )`
        : sql`EXISTS (
            SELECT 1 FROM ${catalogItems}
            JOIN ${skus} ON ${skus.bundleId} = ${catalogItems.id}
            WHERE ${catalogItems.id} = ${line.source.id}
              AND ${catalogItems.state} = 'published'
              AND ${catalogItems.kind} = 'bundle'
              AND ${catalogItems.priceMnt} = ${line.unitPriceMnt}
              AND ${skus.sku} = ${line.sku}
          )`;
    const optionsCurrent =
      line.source.kind === "variant"
        ? [
            sql`(SELECT count(*) FROM ${variantOptionValues} WHERE ${variantOptionValues.variantId} = ${line.source.id}) = ${line.options.length}`,
            ...line.options.map(
              (option) => sql`EXISTS (
            SELECT 1 FROM ${variantOptionValues}
            JOIN ${optionValues} ON ${optionValues.id} = ${variantOptionValues.optionValueId}
            JOIN ${optionGroups} ON ${optionGroups.id} = ${optionValues.optionGroupId}
            WHERE ${variantOptionValues.variantId} = ${line.source.id}
              AND ${optionGroups.id} = ${option.groupId}
              AND ${optionGroups.key} = ${option.groupKey}
              AND ${optionGroups.state} = 'active'
              AND ${optionValues.id} = ${option.valueId}
              AND ${optionValues.key} = ${option.valueKey}
              AND ${optionValues.state} = 'active'
          )`,
            ),
          ]
        : [];
    const componentsCurrent =
      line.source.kind === "bundle"
        ? [
            sql`(SELECT count(*) FROM ${bundleComponents} WHERE ${bundleComponents.bundleId} = ${line.source.id}) = ${line.bundleComponents.length}`,
            ...line.bundleComponents.map(
              (component) => sql`EXISTS (
            SELECT 1 FROM ${bundleComponents}
            JOIN ${variants} ON ${variants.id} = ${bundleComponents.variantId}
            JOIN ${catalogItems} ON ${catalogItems.id} = ${variants.productId}
            JOIN ${skus} ON ${skus.variantId} = ${variants.id}
            WHERE ${bundleComponents.bundleId} = ${line.source.id}
              AND ${bundleComponents.variantId} = ${component.variantId}
              AND ${bundleComponents.quantity} = ${component.perBundleQuantity}
              AND ${variants.state} = 'active'
              AND ${catalogItems.state} = 'published'
              AND ${skus.sku} = ${component.sku}
          )`,
            ),
          ]
        : [];
    const personalizationsCurrent = line.personalizations.map(
      (personalization) => sql`EXISTS (
      SELECT 1 FROM ${personalizationDefinitions}
      WHERE ${personalizationDefinitions.id} = ${personalization.definitionId}
        AND ${personalizationDefinitions.catalogItemId} = ${line.source.catalogItemId}
        AND ${personalizationDefinitions.key} = ${personalization.key}
        AND ${personalizationDefinitions.kind} = ${personalization.value.kind}
        AND ${personalizationDefinitions.state} = 'active'
    )`,
    );
    return [sourceCurrent, ...optionsCurrent, ...componentsCurrent, ...personalizationsCurrent];
  });
  const discountAvailable =
    commercial.discountPolicy.kind === "applied"
      ? exists(
          db
            .select({ id: discountRules.id })
            .from(discountRules)
            .where(
              and(
                eq(discountRules.id, commercial.discountPolicy.ruleId),
                eq(discountRules.state, "active"),
                eq(discountRules.mode, commercial.discountPolicy.mode),
                commercial.discountPolicy.code === null
                  ? sql`${discountRules.code} IS NULL`
                  : eq(discountRules.code, commercial.discountPolicy.code),
                eq(discountRules.calculation, commercial.discountPolicy.calculation),
                eq(discountRules.value, commercial.discountPolicy.value),
                commercial.discountPolicy.startsAt === null
                  ? sql`${discountRules.startsAt} IS NULL`
                  : sql`${discountRules.startsAt} = ${commercial.discountPolicy.startsAt}`,
                commercial.discountPolicy.endsAt === null
                  ? sql`${discountRules.endsAt} IS NULL`
                  : sql`${discountRules.endsAt} = ${commercial.discountPolicy.endsAt}`,
                eq(discountRules.minimumSubtotalMnt, commercial.discountPolicy.minimumSubtotalMnt),
                commercial.discountPolicy.globalLimit === null
                  ? sql`${discountRules.globalLimit} IS NULL`
                  : eq(discountRules.globalLimit, commercial.discountPolicy.globalLimit),
                eq(discountRules.targetsJson, commercial.discountPolicy.targetsJson),
                sql`${discountRules.globalLimit} IS NULL OR ${discountRules.redemptionCount} < ${discountRules.globalLimit}`,
              ),
            ),
        )
      : undefined;
  const discountContextCurrent = [
    sql`(SELECT count(*) FROM ${discountRules} WHERE ${discountRules.state} = 'active') = ${commercial.discountContext.activeRules.length}`,
    ...commercial.discountContext.activeRules.map(
      (rule) => sql`EXISTS (
      SELECT 1 FROM ${discountRules}
      WHERE ${discountRules.id} = ${rule.id}
        AND ${discountRules.state} = 'active'
        AND ${discountRules.mode} = ${rule.mode}
        AND ${discountRules.code} IS ${rule.code}
        AND ${discountRules.calculation} = ${rule.calculation}
        AND ${discountRules.value} = ${rule.value}
        AND ${discountRules.startsAt} IS ${rule.startsAt}
        AND ${discountRules.endsAt} IS ${rule.endsAt}
        AND ${discountRules.minimumSubtotalMnt} = ${rule.minimumSubtotalMnt}
        AND ${discountRules.globalLimit} IS ${rule.globalLimit}
        AND ${discountRules.redemptionCount} = ${rule.redemptionCount}
        AND ${discountRules.targetsJson} = ${rule.targetsJson}
        AND ${discountRules.updatedAt} = ${rule.updatedAt}
    )`,
    ),
    sql`(SELECT count(*) FROM ${categories} WHERE ${categories.state} = 'active') = ${commercial.discountContext.activeCategoryIds.length}`,
    ...commercial.discountContext.activeCategoryIds.map(
      (id) =>
        sql`EXISTS (SELECT 1 FROM ${categories} WHERE ${categories.id} = ${id} AND ${categories.state} = 'active')`,
    ),
    sql`(SELECT count(*) FROM ${collections} WHERE ${collections.state} = 'active') = ${commercial.discountContext.activeCollectionIds.length}`,
    ...commercial.discountContext.activeCollectionIds.map(
      (id) =>
        sql`EXISTS (SELECT 1 FROM ${collections} WHERE ${collections.id} = ${id} AND ${collections.state} = 'active')`,
    ),
    ...commercial.lines.flatMap((line) => {
      const categoryMemberships = commercial.discountContext.categoryMemberships.filter(
        ({ catalogItemId }) => catalogItemId === line.source.catalogItemId,
      );
      const collectionMemberships = commercial.discountContext.collectionMemberships.filter(
        ({ catalogItemId }) => catalogItemId === line.source.catalogItemId,
      );
      return [
        sql`(SELECT count(*) FROM ${catalogItemCategories} WHERE ${catalogItemCategories.catalogItemId} = ${line.source.catalogItemId}) = ${categoryMemberships.length}`,
        ...categoryMemberships.map(
          ({ categoryId }) =>
            sql`EXISTS (SELECT 1 FROM ${catalogItemCategories} WHERE ${catalogItemCategories.catalogItemId} = ${line.source.catalogItemId} AND ${catalogItemCategories.categoryId} = ${categoryId})`,
        ),
        sql`(SELECT count(*) FROM ${catalogItemCollections} WHERE ${catalogItemCollections.catalogItemId} = ${line.source.catalogItemId}) = ${collectionMemberships.length}`,
        ...collectionMemberships.map(
          ({ collectionId }) =>
            sql`EXISTS (SELECT 1 FROM ${catalogItemCollections} WHERE ${catalogItemCollections.catalogItemId} = ${line.source.catalogItemId} AND ${catalogItemCollections.collectionId} = ${collectionId})`,
        ),
      ];
    }),
  ];
  const deliveryCurrent = and(
    eq(commerceSettings.deliveryEnabled, commercial.deliveryPolicy.deliveryEnabled),
    eq(commerceSettings.pickupEnabled, commercial.deliveryPolicy.pickupEnabled),
    eq(commerceSettings.deliveryFeeMnt, commercial.deliveryPolicy.deliveryFeeMnt),
    commercial.deliveryPolicy.freeDeliveryThresholdMnt === null
      ? sql`${commerceSettings.freeDeliveryThresholdMnt} IS NULL`
      : eq(
          commerceSettings.freeDeliveryThresholdMnt,
          commercial.deliveryPolicy.freeDeliveryThresholdMnt,
        ),
    sql`${commerceSettings.updatedAt} = ${commercial.deliveryPolicy.updatedAt}`,
    commercial.fulfillment.kind === "pickup"
      ? sql`EXISTS (
          SELECT 1 FROM ${cmsDocuments}, json_each(${cmsDocuments.contentJson}, '$.locations') AS location
          WHERE ${cmsDocuments.kind} = 'locations'
            AND ${cmsDocuments.status} = 'published'
            AND json_extract(location.value, '$.id') = ${commercial.fulfillment.locationId}
            AND json_extract(location.value, '$.active') = 1
            AND json_extract(location.value, '$.pickupEnabled') = 1
        )`
      : eq(commerceSettings.deliveryEnabled, true),
  );
  const orderExists = exists(
    db.select({ id: orders.id }).from(orders).where(eq(orders.id, orderId)),
  );
  const orderStatement = db.insert(orders).select(
    db
      .select({
        id: sql<string>`${orderId}`.as("id"),
        orderNumber:
          sql<number>`coalesce((SELECT max(${orders.orderNumber}) FROM ${orders}), 0) + 1`.as(
            "order_number",
          ),
        state: sql<"placed">`'placed'`.as("state"),
        customerId: sql<string | null>`${customerId}`.as("customer_id"),
        customerLinkedAt: sql<Date | null>`${customerId === null ? null : now.getTime()}`.as(
          "customer_linked_at",
        ),
        statusTokenHash: sql<string>`${statusAccess.statusTokenHash}`.as("status_token_hash"),
        recipientName: sql<string>`${input.contact.recipientName}`.as("recipient_name"),
        recipientPhone: sql<string>`${input.contact.recipientPhone}`.as("recipient_phone"),
        currency: sql<"MNT">`'MNT'`.as("currency"),
        subtotalMnt: sql<number>`${quote.subtotalMnt}`.as("subtotal_mnt"),
        discountTotalMnt:
          sql<number>`${quote.discount.kind === "applied" ? quote.discount.amountMnt : 0}`.as(
            "discount_total_mnt",
          ),
        deliveryFeeMnt: sql<number>`${quote.deliveryFeeMnt}`.as("delivery_fee_mnt"),
        grandTotalMnt: sql<number>`${quote.totalMnt}`.as("grand_total_mnt"),
        freeDeliveryThresholdMnt: sql<
          number | null
        >`${commercial.deliveryPolicy.freeDeliveryThresholdMnt}`.as("free_delivery_threshold_mnt"),
        freeDeliveryApplied:
          sql<boolean>`${commercial.deliveryPolicy.freeDeliveryThresholdMnt !== null && quote.deliveryFeeMnt === 0 && quote.fulfillment.kind === "delivery"}`.as(
            "free_delivery_applied",
          ),
        commerceSettingsUpdatedAt: sql<Date>`${commercial.deliveryPolicy.updatedAt}`.as(
          "commerce_settings_updated_at",
        ),
        fulfillmentMode: sql<"delivery" | "pickup">`${destination.kind}`.as("fulfillment_mode"),
        deliveryAddress: sql<
          string | null
        >`${destination.kind === "delivery" ? destination.address : null}`.as("delivery_address"),
        pickupLocationId: sql<
          string | null
        >`${destination.kind === "pickup" ? destination.locationId : null}`.as(
          "pickup_location_id",
        ),
        pickupName: sql<
          string | null
        >`${destination.kind === "pickup" ? destination.name : null}`.as("pickup_name"),
        pickupAddress: sql<
          string | null
        >`${destination.kind === "pickup" ? destination.address : null}`.as("pickup_address"),
        commercialFingerprint: sql<string>`${quote.commercialFingerprint}`.as(
          "commercial_fingerprint",
        ),
        placedAt: sql<Date>`${now.getTime()}`.as("placed_at"),
        createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
      })
      .from(commerceSettings)
      .where(
        and(
          eq(commerceSettings.key, "commerce"),
          zeroTotal ? undefined : eq(commerceSettings.bankTransferEnabled, true),
          sql`NOT EXISTS (SELECT 1 FROM ${placementIdempotency} WHERE ${placementIdempotency.key} = ${input.idempotencyKey})`,
          ...stockAvailable,
          ...catalogCurrent,
          ...discountContextCurrent,
          discountAvailable,
          deliveryCurrent,
        ),
      ),
  );
  const statements = [];
  for (const line of quote.lines) {
    const lineId = lineIds.get(line.position);
    if (!lineId) {
      throw new Error("Order Line identity missing");
    }
    statements.push(
      db.insert(orderLines).select(
        db
          .select({
            id: sql<string>`${lineId}`.as("id"),
            orderId: orders.id,
            position: sql<number>`${line.position}`.as("position"),
            catalogItemId: sql<string>`${line.source.catalogItemId}`.as("catalog_item_id"),
            itemKind: sql<
              "product" | "bundle"
            >`${line.source.kind === "variant" ? "product" : "bundle"}`.as("item_kind"),
            variantId: sql<
              string | null
            >`${line.source.kind === "variant" ? line.source.id : null}`.as("variant_id"),
            itemName: sql<string>`${line.name}`.as("item_name"),
            sku: sql<string>`${line.sku}`.as("sku"),
            quantity: sql<number>`${line.quantity}`.as("quantity"),
            unitPriceMnt: sql<number>`${line.unitPriceMnt}`.as("unit_price_mnt"),
            merchandiseAmountMnt: sql<number>`${line.merchandiseAmountMnt}`.as(
              "merchandise_amount_mnt",
            ),
            discountMnt: sql<number>`${line.discountMnt}`.as("discount_mnt"),
            totalMnt: sql<number>`${line.totalMnt}`.as("total_mnt"),
            optionsJson: sql<string>`${JSON.stringify(line.options)}`.as("options_json"),
            personalizationsJson: sql<string>`${JSON.stringify(line.personalizations)}`.as(
              "personalizations_json",
            ),
            bundleComponentsJson: sql<string>`${JSON.stringify(line.bundleComponents)}`.as(
              "bundle_components_json",
            ),
          })
          .from(orders)
          .where(eq(orders.id, orderId)),
      ),
    );
  }
  if (quote.discount.kind === "applied") {
    statements.push(
      db
        .update(discountRules)
        .set({ redemptionCount: sql`${discountRules.redemptionCount} + 1` })
        .where(and(eq(discountRules.id, quote.discount.ruleId), orderExists)),
    );
  }
  for (const [variantId, quantity] of demand) {
    const stockExistsForOrder = and(eq(stockItems.variantId, variantId), orderExists);
    statements.push(
      db
        .update(stockItems)
        .set({
          onHandQuantity: zeroTotal
            ? sql`${stockItems.onHandQuantity} - ${quantity}`
            : stockItems.onHandQuantity,
          reservedQuantity: zeroTotal
            ? stockItems.reservedQuantity
            : sql`${stockItems.reservedQuantity} + ${quantity}`,
          updatedAt: now,
        })
        .where(stockExistsForOrder),
    );
  }
  if (!zeroTotal) {
    statements.push(
      db.insert(payments).select(
        db
          .select({
            id: sql<string>`${paymentId}`.as("id"),
            orderId: orders.id,
            attemptNumber: sql<number>`1`.as("attempt_number"),
            method: sql<"bank_transfer">`'bank_transfer'`.as("method"),
            automatedProvider: sql<"byl" | "direct_qpay" | null>`NULL`.as("automated_provider"),
            state: sql<"awaiting_confirmation">`'awaiting_confirmation'`.as("state"),
            expectedAmountMnt: orders.grandTotalMnt,
            confirmedAmountMnt: sql<number>`0`.as("confirmed_amount_mnt"),
            refundedAmountMnt: sql<number>`0`.as("refunded_amount_mnt"),
            providerAttemptReference: sql<string | null>`NULL`.as("provider_attempt_reference"),
            providerPaymentReference: sql<string | null>`NULL`.as("provider_payment_reference"),
            providerDeadline: sql<Date | null>`NULL`.as("provider_deadline"),
            effectiveDeadline: sql<Date | null>`NULL`.as("effective_deadline"),
            workflowInstanceId: sql<string | null>`NULL`.as("workflow_instance_id"),
            refundObligationAmountMnt: sql<number>`0`.as("refund_obligation_amount_mnt"),
            refundObligationState: sql<"none">`'none'`.as("refund_obligation_state"),
            confirmedAt: sql<Date | null>`NULL`.as("confirmed_at"),
            rejectedAt: sql<Date | null>`NULL`.as("rejected_at"),
            expiredAt: sql<Date | null>`NULL`.as("expired_at"),
            createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
            updatedAt: sql<Date>`${now.getTime()}`.as("updated_at"),
          })
          .from(orders)
          .where(eq(orders.id, orderId)),
      ),
      db.insert(paymentEntries).select(
        db
          .select({
            id: sql<string>`${createPaymentEntryId()}`.as("id"),
            paymentId: sql<string>`${paymentId}`.as("payment_id"),
            sequence: sql<number>`1`.as("sequence"),
            kind: sql<"expected">`'expected'`.as("kind"),
            expectedDeltaMnt: orders.grandTotalMnt,
            confirmedDeltaMnt: sql<number>`0`.as("confirmed_delta_mnt"),
            refundedDeltaMnt: sql<number>`0`.as("refunded_delta_mnt"),
            actorKind: sql<"system">`'system'`.as("actor_kind"),
            staffId: sql<string | null>`NULL`.as("staff_id"),
            staffRole: sql<"owner" | "manager" | "staff" | null>`NULL`.as("staff_role"),
            telegramOperatorLabel: sql<string | null>`NULL`.as("telegram_operator_label"),
            telegramUserId: sql<number | null>`NULL`.as("telegram_user_id"),
            sourceChannel: sql<"storefront">`'storefront'`.as("source_channel"),
            reason: sql<string | null>`NULL`.as("reason"),
            providerReference: sql<string | null>`NULL`.as("provider_reference"),
            observedAt: sql<Date | null>`NULL`.as("observed_at"),
            evidenceJson: sql<string | null>`NULL`.as("evidence_json"),
            commandCorrelationId: sql<string>`${correlationId}`.as("command_correlation_id"),
            createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
          })
          .from(orders)
          .where(eq(orders.id, orderId)),
      ),
    );
  }
  statements.push(
    db.insert(fulfillments).select(
      db
        .select({
          id: sql<string>`${fulfillmentId}`.as("id"),
          orderId: orders.id,
          mode: sql<"delivery" | "pickup">`${destination.kind}`.as("mode"),
          state: sql<"unfulfilled">`'unfulfilled'`.as("state"),
          createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
          updatedAt: sql<Date>`${now.getTime()}`.as("updated_at"),
        })
        .from(orders)
        .where(eq(orders.id, orderId)),
    ),
    db.insert(auditEvents).select(
      db
        .select({
          id: sql<string>`${createAuditEventId()}`.as("id"),
          actorKind: sql<"system">`'system'`.as("actor_kind"),
          actorId: sql<string | null>`NULL`.as("actor_id"),
          staffRole: sql<"owner" | "manager" | "staff" | null>`NULL`.as("staff_role"),
          telegramOperatorLabel: sql<string | null>`NULL`.as("telegram_operator_label"),
          telegramUserId: sql<number | null>`NULL`.as("telegram_user_id"),
          sourceChannel: sql<"storefront">`'storefront'`.as("source_channel"),
          action: sql<string>`'order.place'`.as("action"),
          outcome: sql<"accepted">`'accepted'`.as("outcome"),
          entityKind: sql<string>`'order'`.as("entity_kind"),
          entityId: orders.id,
          reason: sql<string | null>`NULL`.as("reason"),
          commandCorrelationId: sql<string>`${correlationId}`.as("command_correlation_id"),
          metadataJson: sql<string | null>`NULL`.as("metadata_json"),
          createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
        })
        .from(orders)
        .where(eq(orders.id, orderId)),
    ),
    db.insert(placementIdempotency).select(
      db
        .select({
          key: sql<string>`${input.idempotencyKey}`.as("key"),
          intentDigest: sql<string>`${intentDigest}`.as("intent_digest"),
          resultJson: sql<string>`json_object(
            'orderId', ${orders.id},
            'orderNumber', ${orders.orderNumber},
            'orderState', 'placed',
            'statusPath', ${statusAccess.statusPath},
            'totalMnt', ${orders.grandTotalMnt},
            'payment', ${paymentResult},
            'fulfillment', json_object('id', ${fulfillmentId}, 'mode', ${destination.kind}, 'state', 'unfulfilled')
          )`.as("result_json"),
          orderId: orders.id,
          createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
        })
        .from(orders)
        .where(eq(orders.id, orderId)),
    ),
  );
  await db.batch([orderStatement, ...statements]);
  const placement = await readPlacement(input.idempotencyKey);
  return placement?.intentDigest === intentDigest ? placement.result : undefined;
};
