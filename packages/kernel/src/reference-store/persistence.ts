import { compactSku } from "@ecom/contracts";
import { eq, inArray, sql } from "drizzle-orm";
import * as v from "valibot";
import { encodeCmsDocument } from "../cms/codec";
import { database } from "../db/database";
import {
  bundleComponents,
  catalogCachePurgeDebts,
  catalogItemCategories,
  catalogItemCollections,
  catalogItemImages,
  catalogItemTags,
  catalogItems,
  catalogListingCachePurgeDebt,
  categories,
  cmsCachePurgeDebt,
  cmsDocuments,
  collections,
  commerceSettings,
  discountRules,
  inventoryEntries,
  mediaAssets,
  optionGroups,
  optionValues,
  personalizationDefinitions,
  personalizationValues,
  skus,
  stockItems,
  systemMetadata,
  tags,
  variantOptionValues,
  variants,
} from "../db/schema";
import type { ReferenceStoreFixture } from "./schema";

const fixtureMetadataKey = "reference_store_fixture";
const fixtureVersion = "wf29-urnuun48:v3";
const objectPrefix = "reference/wf29";
const openingCorrelationId = "wf29.reference.seed.opening.v1";

const ProofSchema = v.strictObject({
  products: v.number(),
  bundles: v.number(),
  variants: v.number(),
  defaultVariants: v.number(),
  media: v.number(),
  catalogMedia: v.number(),
  brandText: v.number(),
  categories: v.number(),
  collections: v.number(),
  tags: v.number(),
  discounts: v.number(),
  commerceSettings: v.number(),
  cmsDocuments: v.number(),
  cachePurgeDebt: v.number(),
  catalogCachePurgeDebt: v.number(),
  catalogListingCachePurgeDebt: v.number(),
  openingEntries: v.number(),
  openingQuantity: v.number(),
  onHandQuantity: v.number(),
  ledgerQuantity: v.number(),
  searchCanonical: v.number(),
  searchProjection: v.number(),
  searchMissing: v.number(),
  searchOrphan: v.number(),
  searchDuplicate: v.number(),
  searchMismatched: v.number(),
});

const OperationalCountsSchema = v.strictObject({
  orders: v.number(),
  orderLines: v.number(),
  payments: v.number(),
  paymentEntries: v.number(),
  fulfillments: v.number(),
  reservations: v.number(),
  discountRedemptions: v.number(),
  customers: v.number(),
  customerOtpChallenges: v.number(),
  customerSessions: v.number(),
  staffSessions: v.number(),
});

const readProof = async () => {
  const db = database();
  const proof = await db.get(sql`SELECT
    (SELECT count(*) FROM catalog_items WHERE kind = 'product' AND state = 'published') AS products,
    (SELECT count(*) FROM catalog_items WHERE kind = 'bundle' AND state = 'published') AS bundles,
    (SELECT count(*) FROM variants) AS variants,
    (SELECT count(*) FROM variants WHERE is_default = 1) AS defaultVariants,
    (SELECT count(*) FROM media_assets WHERE object_key LIKE ${`${objectPrefix}/%`}) AS media,
    (SELECT count(*) FROM catalog_item_images) AS catalogMedia,
    (SELECT count(*) FROM catalog_items WHERE brand_text IS NOT NULL) AS brandText,
    (SELECT count(*) FROM categories WHERE state = 'active') AS categories,
    (SELECT count(*) FROM collections WHERE state = 'active') AS collections,
    (SELECT count(*) FROM tags WHERE state = 'active') AS tags,
    (SELECT count(*) FROM discount_rules WHERE state = 'active') AS discounts,
    (SELECT count(*) FROM commerce_settings WHERE key = 'commerce') AS commerceSettings,
    (SELECT count(*) FROM cms_documents WHERE status = 'published') AS cmsDocuments,
    (SELECT count(*) FROM cms_cache_purge_debt WHERE key = 'storefront') AS cachePurgeDebt,
    (SELECT count(*) FROM catalog_cache_purge_debts) AS catalogCachePurgeDebt,
    (SELECT count(*) FROM catalog_listing_cache_purge_debt WHERE key = 'catalog') AS catalogListingCachePurgeDebt,
    (SELECT count(*) FROM inventory_entries WHERE command_correlation_id = ${openingCorrelationId}) AS openingEntries,
    (SELECT coalesce(sum(on_hand_delta), 0) FROM inventory_entries WHERE command_correlation_id = ${openingCorrelationId}) AS openingQuantity,
    (SELECT coalesce(sum(on_hand_quantity), 0) FROM stock_items) AS onHandQuantity,
    (SELECT coalesce(sum(on_hand_delta), 0) FROM inventory_entries) AS ledgerQuantity,
    (SELECT canonical_count FROM catalog_search_diagnostics) AS searchCanonical,
    (SELECT projection_count FROM catalog_search_diagnostics) AS searchProjection,
    (SELECT missing_count FROM catalog_search_diagnostics) AS searchMissing,
    (SELECT orphan_count FROM catalog_search_diagnostics) AS searchOrphan,
    (SELECT duplicate_count FROM catalog_search_diagnostics) AS searchDuplicate,
    (SELECT mismatched_count FROM catalog_search_diagnostics) AS searchMismatched`);
  return v.parse(ProofSchema, proof);
};

const readOperationalCounts = async () => {
  const row = await database().get(sql`SELECT
    (SELECT count(*) FROM orders) AS orders,
    (SELECT count(*) FROM order_lines) AS orderLines,
    (SELECT count(*) FROM payments) AS payments,
    (SELECT count(*) FROM payment_entries) AS paymentEntries,
    (SELECT count(*) FROM fulfillments) AS fulfillments,
    (SELECT count(*) FROM inventory_reservations) AS reservations,
    (SELECT count(*) FROM discount_redemption_entries) AS discountRedemptions,
    (SELECT count(*) FROM customers) AS customers,
    (SELECT count(*) FROM customer_otp_challenges) AS customerOtpChallenges,
    (SELECT count(*) FROM customer_auth_sessions) AS customerSessions,
    (SELECT count(*) FROM staff_auth_sessions) AS staffSessions`);
  return v.parse(OperationalCountsSchema, row);
};

const assertProof = (fixture: ReferenceStoreFixture, proof: v.InferOutput<typeof ProofSchema>) => {
  const expectedCatalogItems = fixture.products.length + fixture.bundles.length;
  const expectedVariants = fixture.products.flatMap(
    ({ variants: productVariants }) => productVariants,
  ).length;
  const expectedDefaultVariants = fixture.products
    .flatMap(({ variants: productVariants }) => productVariants)
    .filter(({ isDefault }) => isDefault).length;
  const expectedCatalogMedia = fixture.media.filter(({ usage }) => usage === "catalog").length;
  const expectedOpeningQuantity = fixture.products
    .flatMap(({ variants: productVariants }) => productVariants)
    .reduce((total, { openingQuantity }) => total + openingQuantity, 0);
  const failed = Object.entries({
    products: proof.products === fixture.products.length,
    bundles: proof.bundles === fixture.bundles.length,
    variants: proof.variants === expectedVariants,
    defaultVariants: proof.defaultVariants === expectedDefaultVariants,
    media: proof.media === fixture.media.length,
    catalogMedia: proof.catalogMedia === expectedCatalogMedia,
    brandText: proof.brandText === expectedCatalogItems,
    categories: proof.categories === fixture.categories.length,
    collections: proof.collections === fixture.collections.length,
    tags: proof.tags === fixture.tags.length,
    discounts: proof.discounts === fixture.discounts.length,
    commerceSettings: proof.commerceSettings === 1,
    cmsDocuments: proof.cmsDocuments === fixture.cmsDocuments.length,
    cacheInvalidation:
      proof.cachePurgeDebt === 0 &&
      proof.catalogCachePurgeDebt === 0 &&
      proof.catalogListingCachePurgeDebt === 0,
    openingEntries: proof.openingEntries === expectedVariants,
    openingQuantity: proof.openingQuantity === expectedOpeningQuantity,
    inventoryLedger: proof.onHandQuantity === proof.ledgerQuantity,
    searchProjection:
      proof.searchCanonical === expectedCatalogItems &&
      proof.searchProjection === expectedCatalogItems &&
      proof.searchMissing === 0 &&
      proof.searchOrphan === 0 &&
      proof.searchDuplicate === 0 &&
      proof.searchMismatched === 0,
  })
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  if (failed.length > 0) {
    throw new Error(`Reference Store proof failed: ${failed.join(", ")}`);
  }
};

export const installReferenceStoreFixtureRows = async (
  fixture: ReferenceStoreFixture,
  cacheInvalidationRequired: boolean,
) => {
  const db = database();
  const existingMarker = await db
    .select({ value: systemMetadata.value })
    .from(systemMetadata)
    .where(eq(systemMetadata.key, fixtureMetadataKey))
    .get();
  if (existingMarker?.value !== fixtureVersion) {
    const seededAt = new Date(fixture.seededAt);
    const catalogRows = [
      ...fixture.products.map((item) => ({ ...item, kind: "product" as const })),
      ...fixture.bundles.map((item) => ({ ...item, kind: "bundle" as const })),
    ];
    const variantRows = fixture.products.flatMap((product) =>
      product.variants.map((variant) => ({ ...variant, productId: product.id })),
    );
    const optionGroupRows = fixture.products.flatMap((product) =>
      product.optionGroups.map((group) => ({ ...group, productId: product.id })),
    );
    const optionValueRows = optionGroupRows.flatMap((group) =>
      group.values.map((value) => ({ ...value, optionGroupId: group.id })),
    );
    const catalogItemIds = catalogRows.map(({ id }) => id);
    const variantIds = variantRows.map(({ id }) => id);
    const personalizationIds = fixture.personalizations.map(({ id }) => id);
    const revision = crypto.randomUUID();
    await db.batch([
      db
        .insert(mediaAssets)
        .values(
          fixture.media.map((media) => ({
            id: media.id,
            objectKey: `${objectPrefix}/${media.fileName}`,
            declaredContentType: "image/webp" as const,
            createdAt: seededAt,
          })),
        )
        .onConflictDoUpdate({
          target: mediaAssets.id,
          set: {
            objectKey: sql`excluded.object_key`,
            declaredContentType: "image/webp",
          },
        }),
      ...catalogRows.map((item) =>
        db
          .insert(catalogItems)
          .values({
            id: item.id,
            kind: item.kind,
            slug: item.slug,
            state: "published",
            name: item.name,
            description: item.description,
            brandText: item.brandText,
            priceMnt: item.priceMnt,
            createdAt: seededAt,
            updatedAt: seededAt,
            publishedAt: seededAt,
            archivedAt: null,
          })
          .onConflictDoUpdate({
            target: catalogItems.id,
            set: {
              kind: item.kind,
              slug: item.slug,
              state: "published",
              name: item.name,
              description: item.description,
              brandText: item.brandText,
              priceMnt: item.priceMnt,
              updatedAt: seededAt,
              publishedAt: seededAt,
              archivedAt: null,
            },
          }),
      ),
      db
        .insert(optionGroups)
        .values(
          optionGroupRows.map((group) => ({
            id: group.id,
            productId: group.productId,
            key: group.key,
            label: group.label,
            position: group.position,
            state: "active" as const,
            createdAt: seededAt,
            updatedAt: seededAt,
          })),
        )
        .onConflictDoUpdate({
          target: optionGroups.id,
          set: {
            productId: sql`excluded.product_id`,
            key: sql`excluded.key`,
            label: sql`excluded.label`,
            position: sql`excluded.position`,
            state: "active",
            updatedAt: seededAt,
          },
        }),
      db
        .insert(optionValues)
        .values(
          optionValueRows.map((value) => ({
            id: value.id,
            optionGroupId: value.optionGroupId,
            key: value.key,
            label: value.label,
            position: value.position,
            state: "active" as const,
            createdAt: seededAt,
            updatedAt: seededAt,
          })),
        )
        .onConflictDoUpdate({
          target: optionValues.id,
          set: {
            optionGroupId: sql`excluded.option_group_id`,
            key: sql`excluded.key`,
            label: sql`excluded.label`,
            position: sql`excluded.position`,
            state: "active",
            updatedAt: seededAt,
          },
        }),
      ...variantRows.map((variant) =>
        db
          .insert(variants)
          .values({
            id: variant.id,
            productId: variant.productId,
            isDefault: variant.isDefault,
            combinationKey: variant.combinationKey,
            priceOverrideMnt: variant.priceOverrideMnt,
            imageMediaAssetId: variant.imageMediaAssetId,
            state: variant.state,
            createdAt: seededAt,
            updatedAt: seededAt,
          })
          .onConflictDoUpdate({
            target: variants.id,
            set: {
              productId: variant.productId,
              isDefault: variant.isDefault,
              combinationKey: variant.combinationKey,
              priceOverrideMnt: variant.priceOverrideMnt,
              imageMediaAssetId: variant.imageMediaAssetId,
              state: variant.state,
              updatedAt: seededAt,
            },
          }),
      ),
      db.delete(skus).where(inArray(skus.variantId, variantIds)),
      db.delete(skus).where(
        inArray(
          skus.bundleId,
          fixture.bundles.map(({ id }) => id),
        ),
      ),
      ...[
        ...variantRows.map((variant) => ({
          sku: variant.sku,
          skuCompact: compactSku(variant.sku),
          ownerKind: "variant" as const,
          variantId: variant.id,
          bundleId: null,
          lockedAt: seededAt,
          createdAt: seededAt,
          updatedAt: seededAt,
        })),
        ...fixture.bundles.map((bundle) => ({
          sku: bundle.sku,
          skuCompact: compactSku(bundle.sku),
          ownerKind: "bundle" as const,
          variantId: null,
          bundleId: bundle.id,
          lockedAt: seededAt,
          createdAt: seededAt,
          updatedAt: seededAt,
        })),
      ].map((sku) => db.insert(skus).values(sku)),
      db
        .insert(stockItems)
        .values(
          variantRows.map((variant) => ({
            id: variant.stockItemId,
            variantId: variant.id,
            onHandQuantity: variant.openingQuantity,
            reservedQuantity: 0,
            updatedAt: seededAt,
          })),
        )
        .onConflictDoNothing(),
      ...variantRows.map((variant) =>
        db
          .insert(inventoryEntries)
          .values({
            id: variant.inventoryEntryId,
            stockItemId: variant.stockItemId,
            reservationId: null,
            orderId: null,
            kind: "opening",
            onHandDelta: variant.openingQuantity,
            reservedDelta: 0,
            actorKind: "system",
            staffId: null,
            staffRole: null,
            reason: "WF29 жишиг анхны үлдэгдэл",
            commandCorrelationId: openingCorrelationId,
            createdAt: seededAt,
          })
          .onConflictDoNothing(),
      ),
      db.delete(variantOptionValues).where(inArray(variantOptionValues.variantId, variantIds)),
      db
        .insert(variantOptionValues)
        .values(
          variantRows.flatMap((variant) =>
            variant.optionValueIds.map((optionValueId) => ({
              variantId: variant.id,
              optionValueId,
            })),
          ),
        )
        .onConflictDoNothing(),
      db.delete(bundleComponents).where(
        inArray(
          bundleComponents.bundleId,
          fixture.bundles.map(({ id }) => id),
        ),
      ),
      db
        .insert(bundleComponents)
        .values(
          fixture.bundles.flatMap((bundle) =>
            bundle.components.map((component) => ({
              bundleId: bundle.id,
              variantId: component.variantId,
              quantity: component.quantity,
            })),
          ),
        )
        .onConflictDoNothing(),
      db
        .delete(personalizationValues)
        .where(inArray(personalizationValues.personalizationId, personalizationIds)),
      db
        .insert(personalizationDefinitions)
        .values(
          fixture.personalizations.map((definition) => ({
            id: definition.id,
            catalogItemId: definition.catalogItemId,
            kind: definition.kind,
            key: definition.key,
            label: definition.label,
            position: definition.position,
            required: definition.required,
            state: "active" as const,
            maxLength: definition.maxLength,
            createdAt: seededAt,
            updatedAt: seededAt,
          })),
        )
        .onConflictDoUpdate({
          target: personalizationDefinitions.id,
          set: {
            catalogItemId: sql`excluded.catalog_item_id`,
            kind: sql`excluded.kind`,
            key: sql`excluded.key`,
            label: sql`excluded.label`,
            position: sql`excluded.position`,
            required: sql`excluded.required`,
            state: "active",
            maxLength: sql`excluded.max_length`,
            updatedAt: seededAt,
          },
        }),
      db
        .insert(personalizationValues)
        .values(
          fixture.personalizations.flatMap((definition) =>
            definition.values.map((value) => ({
              id: value.id,
              personalizationId: definition.id,
              key: value.key,
              label: value.label,
              position: value.position,
              state: "active" as const,
              createdAt: seededAt,
              updatedAt: seededAt,
            })),
          ),
        )
        .onConflictDoUpdate({
          target: personalizationValues.id,
          set: {
            personalizationId: sql`excluded.personalization_id`,
            key: sql`excluded.key`,
            label: sql`excluded.label`,
            position: sql`excluded.position`,
            state: "active",
            updatedAt: seededAt,
          },
        }),
      db
        .insert(categories)
        .values(
          fixture.categories.map((category) => ({
            id: category.id,
            slug: category.slug,
            name: category.name,
            parentId: category.parentId,
            position: category.position,
            state: "active" as const,
            createdAt: seededAt,
            updatedAt: seededAt,
            activatedAt: seededAt,
            archivedAt: null,
          })),
        )
        .onConflictDoUpdate({
          target: categories.id,
          set: {
            slug: sql`excluded.slug`,
            name: sql`excluded.name`,
            parentId: sql`excluded.parent_id`,
            position: sql`excluded.position`,
            state: "active",
            updatedAt: seededAt,
            activatedAt: seededAt,
            archivedAt: null,
          },
        }),
      db
        .insert(collections)
        .values(
          fixture.collections.map((collection) => ({
            id: collection.id,
            slug: collection.slug,
            name: collection.name,
            description: collection.description,
            state: "active" as const,
            createdAt: seededAt,
            updatedAt: seededAt,
            activatedAt: seededAt,
            archivedAt: null,
          })),
        )
        .onConflictDoUpdate({
          target: collections.id,
          set: {
            slug: sql`excluded.slug`,
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            state: "active",
            updatedAt: seededAt,
            activatedAt: seededAt,
            archivedAt: null,
          },
        }),
      db
        .insert(tags)
        .values(
          fixture.tags.map((tag) => ({
            id: tag.id,
            label: tag.label,
            normalizedLabel: tag.label.toLocaleLowerCase("mn-MN"),
            state: "active" as const,
            createdAt: seededAt,
            updatedAt: seededAt,
            activatedAt: seededAt,
            archivedAt: null,
          })),
        )
        .onConflictDoUpdate({
          target: tags.id,
          set: {
            label: sql`excluded.label`,
            normalizedLabel: sql`excluded.normalized_label`,
            state: "active",
            updatedAt: seededAt,
            activatedAt: seededAt,
            archivedAt: null,
          },
        }),
      db
        .delete(catalogItemCategories)
        .where(inArray(catalogItemCategories.catalogItemId, catalogItemIds)),
      db
        .insert(catalogItemCategories)
        .values(
          fixture.categories.flatMap((category) =>
            category.catalogItemIds.map((catalogItemId) => ({
              catalogItemId,
              categoryId: category.id,
            })),
          ),
        )
        .onConflictDoNothing(),
      db
        .delete(catalogItemCollections)
        .where(inArray(catalogItemCollections.catalogItemId, catalogItemIds)),
      db
        .insert(catalogItemCollections)
        .values(
          fixture.collections.flatMap((collection) =>
            collection.catalogItemIds.map((catalogItemId, position) => ({
              catalogItemId,
              collectionId: collection.id,
              position,
            })),
          ),
        )
        .onConflictDoNothing(),
      db.delete(catalogItemTags).where(inArray(catalogItemTags.catalogItemId, catalogItemIds)),
      db
        .insert(catalogItemTags)
        .values(
          fixture.tags.flatMap((tag) =>
            tag.catalogItemIds.map((catalogItemId) => ({ catalogItemId, tagId: tag.id })),
          ),
        )
        .onConflictDoNothing(),
      db.delete(catalogItemImages).where(inArray(catalogItemImages.catalogItemId, catalogItemIds)),
      db
        .insert(catalogItemImages)
        .values(
          fixture.media
            .filter((media) => media.usage === "catalog")
            .map((media) => ({
              catalogItemId: media.catalogItemId,
              mediaAssetId: media.id,
              position: media.position,
              altText: media.altText,
            })),
        )
        .onConflictDoNothing(),
      db
        .insert(discountRules)
        .values(
          fixture.discounts.map((discount) => ({
            id: discount.id,
            name: discount.name,
            mode: discount.mode,
            code: discount.code,
            calculation: discount.calculation,
            value: discount.value,
            state: "active" as const,
            startsAt: null,
            endsAt: null,
            minimumSubtotalMnt: discount.minimumSubtotalMnt,
            globalLimit: discount.globalLimit,
            targetsJson: JSON.stringify(discount.targets),
            revision: 1,
            createdAt: seededAt,
            updatedAt: seededAt,
          })),
        )
        .onConflictDoUpdate({
          target: discountRules.id,
          set: {
            name: sql`excluded.name`,
            mode: sql`excluded.mode`,
            code: sql`excluded.code`,
            calculation: sql`excluded.calculation`,
            value: sql`excluded.value`,
            state: "active",
            startsAt: null,
            endsAt: null,
            minimumSubtotalMnt: sql`excluded.minimum_subtotal_mnt`,
            globalLimit: sql`excluded.global_limit`,
            targetsJson: sql`excluded.targets_json`,
            revision: 1,
            updatedAt: seededAt,
          },
        }),
      db
        .insert(commerceSettings)
        .values({ key: "commerce", ...fixture.commerceSettings, updatedAt: seededAt })
        .onConflictDoUpdate({
          target: commerceSettings.key,
          set: { ...fixture.commerceSettings, updatedAt: seededAt },
        }),
      db
        .insert(cmsDocuments)
        .values(
          fixture.cmsDocuments.map((document) => ({
            kind: document.kind,
            status: "published" as const,
            schemaVersion: 1,
            contentJson: encodeCmsDocument(document),
            createdAt: seededAt,
            updatedAt: seededAt,
            publishedAt: seededAt,
          })),
        )
        .onConflictDoUpdate({
          target: [cmsDocuments.kind, cmsDocuments.status],
          set: {
            schemaVersion: 1,
            contentJson: sql`excluded.content_json`,
            updatedAt: seededAt,
            publishedAt: seededAt,
          },
        }),
      ...(cacheInvalidationRequired
        ? [
            db
              .insert(catalogCachePurgeDebts)
              .values(
                catalogItemIds.map((productId) => ({
                  productId,
                  revision,
                  attemptCount: 0,
                  requestId: null,
                  commandCommittedAt: seededAt,
                  lastAttemptedAt: null,
                })),
              )
              .onConflictDoUpdate({
                target: catalogCachePurgeDebts.productId,
                set: {
                  revision,
                  attemptCount: 0,
                  requestId: null,
                  commandCommittedAt: seededAt,
                  lastAttemptedAt: null,
                },
              }),
            db
              .insert(catalogListingCachePurgeDebt)
              .values({
                key: "catalog",
                revision,
                attemptCount: 0,
                requestId: null,
                commandCommittedAt: seededAt,
                lastAttemptedAt: null,
              })
              .onConflictDoUpdate({
                target: catalogListingCachePurgeDebt.key,
                set: {
                  revision,
                  attemptCount: 0,
                  requestId: null,
                  commandCommittedAt: seededAt,
                  lastAttemptedAt: null,
                },
              }),
            db
              .insert(cmsCachePurgeDebt)
              .values({
                key: "storefront",
                revision,
                attemptCount: 0,
                requestId: null,
                commandCommittedAt: seededAt,
                lastAttemptedAt: null,
              })
              .onConflictDoUpdate({
                target: cmsCachePurgeDebt.key,
                set: {
                  revision,
                  attemptCount: 0,
                  requestId: null,
                  commandCommittedAt: seededAt,
                  lastAttemptedAt: null,
                },
              }),
          ]
        : []),
      db
        .insert(systemMetadata)
        .values({ key: fixtureMetadataKey, value: fixtureVersion, updatedAt: seededAt })
        .onConflictDoUpdate({
          target: systemMetadata.key,
          set: { value: fixtureVersion, updatedAt: seededAt },
        }),
    ]);
  }
  return {
    installed: existingMarker?.value !== fixtureVersion,
    proof: await readProof(),
    operationalRows: await readOperationalCounts(),
  };
};

export const proveReferenceStoreFixtureRows = async (fixture: ReferenceStoreFixture) => {
  const proof = await readProof();
  assertProof(fixture, proof);
  return { proof, operationalRows: await readOperationalCounts() };
};
