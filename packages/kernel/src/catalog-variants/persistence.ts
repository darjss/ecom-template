import {
  OptionGroupIdSchema,
  OptionValueIdSchema,
  ProductOptionConfigurationSchema,
  VariantIdSchema,
  createOptionGroupId,
  createOptionValueId,
  createStockItemId,
  createVariantId,
  type Product,
  type ProductId,
  type SaveProductOptionsInput,
  type UpdateVariantPresentationInput,
  type VariantId,
} from "@ecom/contracts";
import { and, asc, count, eq, exists, gt, inArray, ne, notExists, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { uniq } from "es-toolkit";
import * as v from "valibot";
import {
  bundleComponents,
  catalogCachePurgeDebts,
  catalogItemImages,
  catalogItems,
  optionGroups,
  optionValues,
  skus,
  stockItems,
  variantOptionValues,
  variants,
} from "../db/schema";
import { database } from "../db/database";
import { catalogSku, compactSku } from "../catalog/sku";

const combinationKey = (valueIds: readonly string[]) => [...valueIds].toSorted().join("|");

export const readProductOptionConfigurations = async (productIds: readonly ProductId[]) => {
  if (productIds.length === 0) {
    return [];
  }
  const db = database();
  const [groupRows, valueRows, variantRows, membershipRows] = await Promise.all([
    db
      .select()
      .from(optionGroups)
      .where(inArray(optionGroups.productId, productIds))
      .orderBy(asc(optionGroups.position)),
    db
      .select({
        productId: optionGroups.productId,
        id: optionValues.id,
        optionGroupId: optionValues.optionGroupId,
        key: optionValues.key,
        label: optionValues.label,
        position: optionValues.position,
        state: optionValues.state,
      })
      .from(optionValues)
      .innerJoin(optionGroups, eq(optionGroups.id, optionValues.optionGroupId))
      .where(inArray(optionGroups.productId, productIds))
      .orderBy(asc(optionValues.position)),
    db
      .select({
        productId: variants.productId,
        id: variants.id,
        sku: skus.sku,
        isDefault: variants.isDefault,
        state: variants.state,
        priceOverrideMnt: variants.priceOverrideMnt,
        imageMediaAssetId: variants.imageMediaAssetId,
        stockItemId: stockItems.id,
        onHandQuantity: stockItems.onHandQuantity,
        reservedQuantity: stockItems.reservedQuantity,
      })
      .from(variants)
      .innerJoin(skus, eq(skus.variantId, variants.id))
      .innerJoin(stockItems, eq(stockItems.variantId, variants.id))
      .where(inArray(variants.productId, productIds))
      .orderBy(asc(variants.createdAt)),
    db
      .select({
        productId: variants.productId,
        variantId: variantOptionValues.variantId,
        optionValueId: variantOptionValues.optionValueId,
      })
      .from(variantOptionValues)
      .innerJoin(variants, eq(variants.id, variantOptionValues.variantId))
      .where(inArray(variants.productId, productIds)),
  ]);
  return productIds.map((productId) => ({
    productId,
    configuration: v.parse(ProductOptionConfigurationSchema, {
      groups: groupRows
        .filter((group) => group.productId === productId)
        .map((group) => ({
          id: v.parse(OptionGroupIdSchema, group.id),
          key: group.key,
          label: group.label,
          position: group.position,
          state: group.state,
          values: valueRows
            .filter((value) => value.optionGroupId === group.id)
            .map((value) => ({
              id: v.parse(OptionValueIdSchema, value.id),
              key: value.key,
              label: value.label,
              position: value.position,
              state: value.state,
            })),
        })),
      variants: variantRows
        .filter((variant) => variant.productId === productId)
        .map(({ productId: _productId, ...variant }) => ({
          ...variant,
          id: v.parse(VariantIdSchema, variant.id),
          optionValueIds: membershipRows
            .filter((membership) => membership.variantId === variant.id)
            .map((membership) => v.parse(OptionValueIdSchema, membership.optionValueId)),
        })),
    }) satisfies Product["optionConfiguration"],
  }));
};

export const readProductOptionConfiguration = async (productId: ProductId) => {
  const configurations = await readProductOptionConfigurations([productId]);
  const configuration = configurations.at(0);
  if (!configuration) {
    throw new Error("Product option configuration is unavailable");
  }
  return configuration.configuration;
};

const temporaryPositions = (
  currentPositions: readonly number[],
  nextPositions: readonly number[],
) => {
  const used = new Set([...currentPositions, ...nextPositions]);
  return Array.from({ length: nextPositions.length }, () => {
    const position = Array.from({ length: 100 }, (_, index) => 99 - index).find(
      (candidate) => !used.has(candidate),
    );
    if (position === undefined) {
      throw new Error("Bounded option positions are unavailable");
    }
    used.add(position);
    return position;
  });
};

export const catalogVariantQueries = {
  async saveConfiguration(productId: ProductId, input: SaveProductOptionsInput) {
    const db = database();
    const [productRows, defaultVariantRows] = await Promise.all([
      db
        .select({ publishedAt: catalogItems.publishedAt, slug: catalogItems.slug })
        .from(catalogItems)
        .where(eq(catalogItems.id, productId))
        .limit(1),
      db
        .select({ id: variants.id })
        .from(variants)
        .where(and(eq(variants.productId, productId), eq(variants.isDefault, true)))
        .limit(1),
    ]);
    const product = productRows.at(0);
    if (!product) {
      return { kind: "not_found" as const };
    }

    const groups = input.groups.map((group) => ({
      ...group,
      id: group.id ?? createOptionGroupId(),
    }));
    const values = groups.flatMap((group) =>
      group.values.map((value) => ({
        ...value,
        id: value.id ?? createOptionValueId(),
        optionGroupId: group.id,
      })),
    );
    if (
      uniq(groups.map(({ id }) => id)).length !== groups.length ||
      uniq(groups.map(({ key }) => key)).length !== groups.length ||
      uniq(groups.map(({ position }) => position)).length !== groups.length ||
      uniq(values.map(({ id }) => id)).length !== values.length ||
      groups.some(
        (group) =>
          uniq(group.values.map(({ key }) => key)).length !== group.values.length ||
          uniq(group.values.map(({ position }) => position)).length !== group.values.length,
      )
    ) {
      return { kind: "invalid_combination" as const };
    }
    const valueIds = new Set(values.map(({ id }) => id));
    const defaultVariantId = defaultVariantRows.at(0)?.id;
    if (input.variants.some(({ id }) => id === defaultVariantId)) {
      return { kind: "invalid_combination" as const };
    }
    const requestedVariants = input.variants.map((variant) => {
      const id = variant.id ?? createVariantId();
      return {
        ...variant,
        id,
        combinationKey:
          variant.optionValueIds.length === 0
            ? `__incomplete__:${id}`
            : combinationKey(variant.optionValueIds),
      };
    });
    if (
      requestedVariants.some(
        (variant) =>
          uniq(variant.optionValueIds).length !== variant.optionValueIds.length ||
          variant.optionValueIds.some((id) => !valueIds.has(id)),
      )
    ) {
      return { kind: "invalid_combination" as const };
    }
    if (
      uniq(requestedVariants.map(({ combinationKey: key }) => key)).length !==
      requestedVariants.length
    ) {
      return { kind: "duplicate_combination" as const };
    }

    const [ownedGroups, ownedValues, ownedVariants] = await Promise.all([
      groups.length === 0
        ? []
        : db
            .select({ id: optionGroups.id })
            .from(optionGroups)
            .where(
              and(
                inArray(
                  optionGroups.id,
                  groups.map(({ id }) => id),
                ),
                ne(optionGroups.productId, productId),
              ),
            ),
      values.length === 0
        ? []
        : db
            .select({ id: optionValues.id })
            .from(optionValues)
            .innerJoin(optionGroups, eq(optionGroups.id, optionValues.optionGroupId))
            .where(
              and(
                inArray(
                  optionValues.id,
                  values.map(({ id }) => id),
                ),
                ne(optionGroups.productId, productId),
              ),
            ),
      requestedVariants.length === 0
        ? []
        : db
            .select({ id: variants.id })
            .from(variants)
            .where(
              and(
                inArray(
                  variants.id,
                  requestedVariants.map(({ id }) => id),
                ),
                ne(variants.productId, productId),
              ),
            ),
    ]);
    if (ownedGroups.length || ownedValues.length || ownedVariants.length) {
      return { kind: "invalid_combination" as const };
    }
    const imageIds = requestedVariants.flatMap(({ imageMediaAssetId }) =>
      imageMediaAssetId ? [imageMediaAssetId] : [],
    );
    if (imageIds.length) {
      const ownedImages = await db
        .select({ id: catalogItemImages.mediaAssetId })
        .from(catalogItemImages)
        .where(
          and(
            eq(catalogItemImages.catalogItemId, productId),
            inArray(catalogItemImages.mediaAssetId, imageIds),
          ),
        );
      if (uniq(ownedImages.map(({ id }) => id)).length !== uniq(imageIds).length) {
        return { kind: "media_not_owned" as const };
      }
    }

    const savePublishedPresentation = async () => {
      const current = await readProductOptionConfiguration(productId);
      const currentGroups = current.groups.filter(({ state }) => state === "active");
      const currentValues = currentGroups.flatMap((group) =>
        group.values
          .filter(({ state }) => state === "active")
          .map((value) => ({ ...value, optionGroupId: group.id })),
      );
      const currentVariants = current.variants.filter(({ isDefault }) => !isDefault);
      const groupsMatch =
        groups.length === currentGroups.length &&
        groups.every((group) => currentGroups.find(({ id }) => id === group.id)?.key === group.key);
      const valuesMatch =
        values.length === currentValues.length &&
        values.every((value) => {
          const existing = currentValues.find(({ id }) => id === value.id);
          return existing?.key === value.key && existing.optionGroupId === value.optionGroupId;
        });
      const variantsMatch =
        requestedVariants.length === currentVariants.length &&
        requestedVariants.every((variant) => {
          const existing = currentVariants.find(({ id }) => id === variant.id);
          return (
            existing?.state === variant.state &&
            existing.optionValueIds.toSorted().join("|") ===
              variant.optionValueIds.toSorted().join("|")
          );
        });
      if (!groupsMatch || !valuesMatch || !variantsMatch) {
        return { kind: "immutable_configuration" as const };
      }
      const now = new Date();
      const revision = crypto.randomUUID();
      const groupTemporaryPositions = temporaryPositions(
        currentGroups.map(({ position }) => position),
        groups.map(({ position }) => position),
      );
      const prepareGroups = groups.map((group, index) =>
        db
          .update(optionGroups)
          .set({ position: groupTemporaryPositions[index], updatedAt: now })
          .where(and(eq(optionGroups.id, group.id), eq(optionGroups.productId, productId))),
      );
      const prepareValues = groups.flatMap((group) => {
        const nextValues = values.filter(({ optionGroupId }) => optionGroupId === group.id);
        const existingValues = currentValues.filter(
          ({ optionGroupId }) => optionGroupId === group.id,
        );
        const positions = temporaryPositions(
          existingValues.map(({ position }) => position),
          nextValues.map(({ position }) => position),
        );
        return nextValues.map((value, index) =>
          db
            .update(optionValues)
            .set({ position: positions[index], updatedAt: now })
            .where(
              and(
                eq(optionValues.id, value.id),
                eq(optionValues.optionGroupId, value.optionGroupId),
              ),
            ),
        );
      });
      const groupUpdates = groups.map((group) =>
        db
          .update(optionGroups)
          .set({ label: group.label, position: group.position, updatedAt: now })
          .where(and(eq(optionGroups.id, group.id), eq(optionGroups.productId, productId))),
      );
      const valueUpdates = values.map((value) =>
        db
          .update(optionValues)
          .set({ label: value.label, position: value.position, updatedAt: now })
          .where(
            and(eq(optionValues.id, value.id), eq(optionValues.optionGroupId, value.optionGroupId)),
          ),
      );
      const variantUpdates = requestedVariants.map((variant) =>
        db
          .update(variants)
          .set({
            priceOverrideMnt: variant.priceOverrideMnt,
            imageMediaAssetId: variant.imageMediaAssetId,
            updatedAt: now,
          })
          .where(and(eq(variants.id, variant.id), eq(variants.productId, productId))),
      );
      const cacheDebt = db
        .insert(catalogCachePurgeDebts)
        .values({
          productId,
          revision,
          attemptCount: 0,
          requestId: null,
          commandCommittedAt: now,
          lastAttemptedAt: null,
        })
        .onConflictDoUpdate({
          target: catalogCachePurgeDebts.productId,
          set: {
            revision,
            attemptCount: 0,
            requestId: null,
            commandCommittedAt: now,
            lastAttemptedAt: null,
          },
        });
      await db.batch([
        cacheDebt,
        ...prepareGroups,
        ...prepareValues,
        ...groupUpdates,
        ...valueUpdates,
        ...variantUpdates,
      ] as const);
      return { kind: "changed" as const, purge: true as const };
    };

    const replaceDraftConfiguration = async () => {
      const [currentGroups, existingVariants] = await Promise.all([
        db
          .select({ id: optionGroups.id })
          .from(optionGroups)
          .where(eq(optionGroups.productId, productId)),
        db
          .select({ id: variants.id })
          .from(variants)
          .where(and(eq(variants.productId, productId), eq(variants.isDefault, false))),
      ]);
      const existingIds = new Set(existingVariants.map(({ id }) => id));
      const retainedVariants = requestedVariants.filter(({ id }) => existingIds.has(id));
      const newVariants = requestedVariants.filter(({ id }) => !existingIds.has(id));
      const now = new Date();
      const draftPredicate = and(eq(catalogItems.id, productId), eq(catalogItems.state, "draft"));
      const draftExists = exists(
        db.select({ id: catalogItems.id }).from(catalogItems).where(draftPredicate),
      );
      const guardDraft = db
        .update(catalogItems)
        .set({ updatedAt: now })
        .where(draftPredicate)
        .returning({ id: catalogItems.id });
      const clearMembership = db
        .delete(variantOptionValues)
        .where(
          and(
            inArray(
              variantOptionValues.variantId,
              existingVariants.length ? existingVariants.map(({ id }) => id) : ["missing"],
            ),
            draftExists,
          ),
        );
      const deleteValues = db
        .delete(optionValues)
        .where(
          and(
            inArray(
              optionValues.optionGroupId,
              currentGroups.length ? currentGroups.map(({ id }) => id) : ["missing"],
            ),
            draftExists,
          ),
        );
      const deleteGroups = db
        .delete(optionGroups)
        .where(and(eq(optionGroups.productId, productId), draftExists));
      const archiveVariants = db
        .update(variants)
        .set({ state: "archived", updatedAt: now })
        .where(and(eq(variants.productId, productId), eq(variants.isDefault, false), draftExists));
      const defaultState = groups.length === 0 ? "active" : "archived";
      const updateDefault = db
        .update(variants)
        .set({ state: defaultState, updatedAt: now })
        .where(and(eq(variants.productId, productId), eq(variants.isDefault, true), draftExists));
      const base = [
        guardDraft,
        clearMembership,
        deleteValues,
        deleteGroups,
        archiveVariants,
        updateDefault,
      ] as const;
      if (groups.length === 0) {
        const results = await db.batch(base);
        return results[0].length
          ? { kind: "changed" as const, purge: false as const }
          : { kind: "immutable_configuration" as const };
      }
      const insertGroups = groups.map((group) =>
        db.insert(optionGroups).select(
          db
            .select({
              id: sql<string>`${group.id}`.as("id"),
              productId: sql<string>`${productId}`.as("product_id"),
              key: sql<string>`${group.key}`.as("key"),
              label: sql<string>`${group.label}`.as("label"),
              position: sql<number>`${group.position}`.as("position"),
              state: sql<"active">`'active'`.as("state"),
              createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
              updatedAt: sql<Date>`${now.getTime()}`.as("updated_at"),
            })
            .from(catalogItems)
            .where(draftPredicate),
        ),
      );
      const insertValues = values.map((value) =>
        db.insert(optionValues).select(
          db
            .select({
              id: sql<string>`${value.id}`.as("id"),
              optionGroupId: sql<string>`${value.optionGroupId}`.as("option_group_id"),
              key: sql<string>`${value.key}`.as("key"),
              label: sql<string>`${value.label}`.as("label"),
              position: sql<number>`${value.position}`.as("position"),
              state: sql<"active">`'active'`.as("state"),
              createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
              updatedAt: sql<Date>`${now.getTime()}`.as("updated_at"),
            })
            .from(catalogItems)
            .where(draftPredicate),
        ),
      );
      const prepareVariants = retainedVariants.map((variant) =>
        db
          .update(variants)
          .set({ combinationKey: `editing:${variant.id}`, updatedAt: now })
          .where(and(eq(variants.id, variant.id), eq(variants.productId, productId), draftExists)),
      );
      const applyVariants = retainedVariants.map((variant) =>
        db
          .update(variants)
          .set({
            combinationKey: variant.combinationKey,
            priceOverrideMnt: variant.priceOverrideMnt,
            imageMediaAssetId: variant.imageMediaAssetId,
            state: variant.state,
            updatedAt: now,
          })
          .where(and(eq(variants.id, variant.id), eq(variants.productId, productId), draftExists)),
      );
      const insertVariants = newVariants.map((variant) =>
        db.insert(variants).select(
          db
            .select({
              id: sql<string>`${variant.id}`.as("id"),
              productId: sql<string>`${productId}`.as("product_id"),
              isDefault: sql<boolean>`0`.as("is_default"),
              combinationKey: sql<string>`${variant.combinationKey}`.as("combination_key"),
              priceOverrideMnt: sql<number | null>`${variant.priceOverrideMnt}`.as(
                "price_override_mnt",
              ),
              imageMediaAssetId: sql<string | null>`${variant.imageMediaAssetId}`.as(
                "image_media_asset_id",
              ),
              state: sql<typeof variant.state>`${variant.state}`.as("state"),
              createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
              updatedAt: sql<Date>`${now.getTime()}`.as("updated_at"),
            })
            .from(catalogItems)
            .where(draftPredicate),
        ),
      );
      const insertSkus = newVariants.map((variant) => {
        const sku = catalogSku(product.slug, variant.id);
        return db.insert(skus).select(
          db
            .select({
              sku: sql<string>`${sku}`.as("sku"),
              skuCompact: sql<string>`${compactSku(sku)}`.as("sku_compact"),
              ownerKind: sql<"variant">`'variant'`.as("owner_kind"),
              variantId: sql<string>`${variant.id}`.as("variant_id"),
              bundleId: sql<null>`NULL`.as("bundle_id"),
              lockedAt: sql<null>`NULL`.as("locked_at"),
              createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
              updatedAt: sql<Date>`${now.getTime()}`.as("updated_at"),
            })
            .from(catalogItems)
            .where(draftPredicate),
        );
      });
      const insertStocks = newVariants.map((variant) =>
        db.insert(stockItems).select(
          db
            .select({
              id: sql<string>`${createStockItemId()}`.as("id"),
              variantId: sql<string>`${variant.id}`.as("variant_id"),
              onHandQuantity: sql<number>`0`.as("on_hand_quantity"),
              reservedQuantity: sql<number>`0`.as("reserved_quantity"),
              updatedAt: sql<Date>`${now.getTime()}`.as("updated_at"),
            })
            .from(catalogItems)
            .where(draftPredicate),
        ),
      );
      const insertMembership = requestedVariants.flatMap((variant) =>
        variant.optionValueIds.map((optionValueId) =>
          db.insert(variantOptionValues).select(
            db
              .select({
                variantId: sql<string>`${variant.id}`.as("variant_id"),
                optionValueId: sql<string>`${optionValueId}`.as("option_value_id"),
              })
              .from(catalogItems)
              .where(draftPredicate),
          ),
        ),
      );
      const results = await db.batch([
        ...base,
        ...insertGroups,
        ...insertValues,
        ...prepareVariants,
        ...insertVariants,
        ...applyVariants,
        ...insertSkus,
        ...insertStocks,
        ...insertMembership,
      ] as const);
      return results[0].length
        ? { kind: "changed" as const, purge: false as const }
        : { kind: "immutable_configuration" as const };
    };

    return product.publishedAt ? savePublishedPresentation() : replaceDraftConfiguration();
  },

  async updatePresentation(
    productId: ProductId,
    variantId: VariantId,
    input: UpdateVariantPresentationInput,
  ) {
    const db = database();
    if (input.imageMediaAssetId) {
      const image = await db
        .select({ id: catalogItemImages.mediaAssetId })
        .from(catalogItemImages)
        .where(
          and(
            eq(catalogItemImages.catalogItemId, productId),
            eq(catalogItemImages.mediaAssetId, input.imageMediaAssetId),
          ),
        )
        .limit(1);
      if (!image.at(0)) {
        return { kind: "media_not_owned" as const };
      }
    }
    const now = new Date();
    const revision = crypto.randomUUID();
    const variantPredicate = and(
      eq(variants.id, variantId),
      eq(variants.productId, productId),
      eq(variants.isDefault, false),
    );
    const results = await db.batch([
      db
        .update(variants)
        .set({
          priceOverrideMnt: input.priceOverrideMnt,
          imageMediaAssetId: input.imageMediaAssetId,
          updatedAt: now,
        })
        .where(variantPredicate)
        .returning({ id: variants.id }),
      db
        .insert(catalogCachePurgeDebts)
        .select(
          db
            .select({
              productId: sql<string>`${productId}`.as("product_id"),
              revision: sql<string>`${revision}`.as("revision"),
              attemptCount: sql<number>`0`.as("attempt_count"),
              requestId: sql<null>`NULL`.as("request_id"),
              commandCommittedAt: sql<Date>`${now.getTime()}`.as("command_committed_at"),
              lastAttemptedAt: sql<null>`NULL`.as("last_attempted_at"),
            })
            .from(catalogItems)
            .where(
              and(
                eq(catalogItems.id, productId),
                ne(catalogItems.state, "draft"),
                exists(db.select({ id: variants.id }).from(variants).where(variantPredicate)),
              ),
            ),
        )
        .onConflictDoUpdate({
          target: catalogCachePurgeDebts.productId,
          set: {
            revision,
            attemptCount: 0,
            requestId: null,
            commandCommittedAt: now,
            lastAttemptedAt: null,
          },
        }),
    ] as const);
    return results[0].length ? { kind: "changed" as const } : { kind: "not_found" as const };
  },

  async transition(productId: ProductId, variantId: VariantId, state: "active" | "archived") {
    const db = database();
    const now = new Date();
    const revision = crypto.randomUUID();
    const otherVariant = alias(variants, "other_active_variant");
    const activationVariant = alias(variants, "activation_variant");
    const activationSku = alias(skus, "activation_sku");
    const activationGroup = alias(optionGroups, "activation_group");
    const activationValue = alias(optionValues, "activation_value");
    const activationMembership = alias(variantOptionValues, "activation_membership");
    const repeatedActivationValue = alias(optionValues, "repeated_activation_value");
    const repeatedActivationMembership = alias(
      variantOptionValues,
      "repeated_activation_membership",
    );
    const ownedVariant = and(
      eq(variants.id, variantId),
      eq(variants.productId, productId),
      eq(variants.isDefault, false),
    );
    const activeGroups = db
      .select({ id: activationGroup.id })
      .from(activationGroup)
      .where(and(eq(activationGroup.productId, productId), eq(activationGroup.state, "active")));
    const missingGroup = db
      .select({ id: activationGroup.id })
      .from(activationGroup)
      .where(
        and(
          eq(activationGroup.productId, productId),
          eq(activationGroup.state, "active"),
          notExists(
            db
              .select({ id: activationMembership.optionValueId })
              .from(activationMembership)
              .innerJoin(
                activationValue,
                eq(activationValue.id, activationMembership.optionValueId),
              )
              .where(
                and(
                  eq(activationMembership.variantId, variantId),
                  eq(activationValue.optionGroupId, activationGroup.id),
                  eq(activationValue.state, "active"),
                ),
              ),
          ),
        ),
      );
    const invalidMembership = db
      .select({ id: activationMembership.optionValueId })
      .from(activationMembership)
      .innerJoin(activationValue, eq(activationValue.id, activationMembership.optionValueId))
      .innerJoin(activationGroup, eq(activationGroup.id, activationValue.optionGroupId))
      .where(
        and(
          eq(activationMembership.variantId, variantId),
          or(
            ne(activationGroup.productId, productId),
            ne(activationGroup.state, "active"),
            ne(activationValue.state, "active"),
          ),
        ),
      );
    const repeatedGroup = db
      .select({ optionGroupId: repeatedActivationValue.optionGroupId })
      .from(repeatedActivationMembership)
      .innerJoin(
        repeatedActivationValue,
        eq(repeatedActivationValue.id, repeatedActivationMembership.optionValueId),
      )
      .where(eq(repeatedActivationMembership.variantId, variantId))
      .groupBy(repeatedActivationValue.optionGroupId)
      .having(gt(count(), 1));
    const validTargetVariant = db
      .select({ id: activationVariant.id })
      .from(activationVariant)
      .innerJoin(activationSku, eq(activationSku.variantId, activationVariant.id))
      .where(
        and(
          eq(activationVariant.id, variantId),
          eq(activationVariant.productId, productId),
          eq(activationVariant.isDefault, false),
          sql`coalesce(${activationVariant.priceOverrideMnt}, ${catalogItems.priceMnt}) > 0`,
          sql`length(trim(${activationSku.sku})) > 0`,
        ),
      );
    const validPublishedActivation = db
      .select({ id: catalogItems.id })
      .from(catalogItems)
      .where(
        and(
          eq(catalogItems.id, productId),
          ne(catalogItems.state, "draft"),
          exists(activeGroups),
          exists(validTargetVariant),
          notExists(missingGroup),
          notExists(invalidMembership),
          notExists(repeatedGroup),
        ),
      );
    const draftProduct = db
      .select({ id: catalogItems.id })
      .from(catalogItems)
      .where(and(eq(catalogItems.id, productId), eq(catalogItems.state, "draft")));
    const variantPredicate =
      state === "active"
        ? and(ownedVariant, or(exists(draftProduct), exists(validPublishedActivation)))
        : and(
            ownedVariant,
            or(
              exists(draftProduct),
              and(
                exists(
                  db
                    .select({ id: otherVariant.id })
                    .from(otherVariant)
                    .where(
                      and(
                        eq(otherVariant.productId, productId),
                        ne(otherVariant.id, variantId),
                        eq(otherVariant.isDefault, false),
                        eq(otherVariant.state, "active"),
                      ),
                    ),
                ),
                notExists(
                  db
                    .select({ bundleId: bundleComponents.bundleId })
                    .from(bundleComponents)
                    .innerJoin(catalogItems, eq(catalogItems.id, bundleComponents.bundleId))
                    .where(
                      and(
                        eq(bundleComponents.variantId, variantId),
                        eq(catalogItems.kind, "bundle"),
                        eq(catalogItems.state, "published"),
                      ),
                    ),
                ),
              ),
            ),
          );
    const results = await db.batch([
      db
        .update(variants)
        .set({ state, updatedAt: now })
        .where(variantPredicate)
        .returning({ id: variants.id }),
      db
        .insert(catalogCachePurgeDebts)
        .select(
          db
            .select({
              productId: sql<string>`${productId}`.as("product_id"),
              revision: sql<string>`${revision}`.as("revision"),
              attemptCount: sql<number>`0`.as("attempt_count"),
              requestId: sql<null>`NULL`.as("request_id"),
              commandCommittedAt: sql<Date>`${now.getTime()}`.as("command_committed_at"),
              lastAttemptedAt: sql<null>`NULL`.as("last_attempted_at"),
            })
            .from(catalogItems)
            .where(
              and(
                eq(catalogItems.id, productId),
                ne(catalogItems.state, "draft"),
                exists(db.select({ id: variants.id }).from(variants).where(variantPredicate)),
              ),
            ),
        )
        .onConflictDoUpdate({
          target: catalogCachePurgeDebts.productId,
          set: {
            revision,
            attemptCount: 0,
            requestId: null,
            commandCommittedAt: now,
            lastAttemptedAt: null,
          },
        }),
    ] as const);
    if (results[0].length) {
      return { kind: "changed" as const };
    }
    const existing = await db
      .select({ id: variants.id })
      .from(variants)
      .where(ownedVariant)
      .limit(1);
    if (!existing.length) {
      return { kind: "not_found" as const };
    }
    if (state === "archived") {
      const dependency = await db
        .select({ bundleId: bundleComponents.bundleId })
        .from(bundleComponents)
        .innerJoin(catalogItems, eq(catalogItems.id, bundleComponents.bundleId))
        .where(
          and(
            eq(bundleComponents.variantId, variantId),
            eq(catalogItems.kind, "bundle"),
            eq(catalogItems.state, "published"),
          ),
        )
        .limit(1);
      if (dependency.length) {
        return { kind: "published_bundle_dependency" as const };
      }
    }
    return { kind: "invalid_publication" as const };
  },
};
