import {
  OptionGroupIdSchema,
  OptionValueIdSchema,
  ProductOptionConfigurationSchema,
  VariantIdSchema,
  createOptionGroupId,
  createOptionValueId,
  createStockItemId,
  createVariantId,
  type ProductId,
  type SaveProductOptionsInput,
  type UpdateVariantPresentationInput,
  type VariantId,
} from "@ecom/contracts";
import { and, asc, eq, exists, inArray, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import * as v from "valibot";
import {
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
import { compactSku, skuFromVariantId } from "../catalog/sku";

const combinationKey = (valueIds: readonly string[]) => [...valueIds].toSorted().join("|");

export const readProductOptionConfiguration = async (productId: ProductId) => {
  const db = database();
  const [groupRows, valueRows, variantRows, membershipRows] = await Promise.all([
    db
      .select()
      .from(optionGroups)
      .where(eq(optionGroups.productId, productId))
      .orderBy(asc(optionGroups.position)),
    db
      .select({
        id: optionValues.id,
        optionGroupId: optionValues.optionGroupId,
        key: optionValues.key,
        label: optionValues.label,
        position: optionValues.position,
        state: optionValues.state,
      })
      .from(optionValues)
      .innerJoin(optionGroups, eq(optionGroups.id, optionValues.optionGroupId))
      .where(eq(optionGroups.productId, productId))
      .orderBy(asc(optionValues.position)),
    db
      .select({
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
      .where(eq(variants.productId, productId))
      .orderBy(asc(variants.createdAt)),
    db
      .select({
        variantId: variantOptionValues.variantId,
        optionValueId: variantOptionValues.optionValueId,
      })
      .from(variantOptionValues)
      .innerJoin(variants, eq(variants.id, variantOptionValues.variantId))
      .where(eq(variants.productId, productId)),
  ]);
  return v.parse(ProductOptionConfigurationSchema, {
    groups: groupRows.map((group) => ({
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
    variants: variantRows.map((variant) => ({
      ...variant,
      id: v.parse(VariantIdSchema, variant.id),
      optionValueIds: membershipRows
        .filter((membership) => membership.variantId === variant.id)
        .map((membership) => v.parse(OptionValueIdSchema, membership.optionValueId)),
    })),
  });
};

const distinct = (values: readonly string[]) => new Set(values).size === values.length;

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
  async validatePublication(productId: ProductId) {
    const configuration = await readProductOptionConfiguration(productId);
    const groups = configuration.groups.filter(({ state }) => state === "active");
    const activeValuesByGroup = groups.map(
      (group) =>
        new Set(group.values.filter(({ state }) => state === "active").map(({ id }) => id)),
    );
    const activeVariants = configuration.variants.filter(({ state }) => state === "active");
    if (groups.length === 0) {
      return activeVariants.some(
        ({ isDefault, priceOverrideMnt }) =>
          isDefault && (priceOverrideMnt === null || priceOverrideMnt > 0),
      );
    }
    const explicit = activeVariants.filter(({ isDefault }) => !isDefault);
    if (
      explicit.length === 0 ||
      groups.some((group) => group.values.every(({ state }) => state !== "active"))
    ) {
      return false;
    }
    const combinations = explicit.map(({ optionValueIds }) => combinationKey(optionValueIds));
    return (
      distinct(combinations) &&
      explicit.every(
        (variant) => variant.priceOverrideMnt === null || variant.priceOverrideMnt > 0,
      ) &&
      explicit.every(
        (variant) =>
          variant.optionValueIds.length === groups.length &&
          activeValuesByGroup.every(
            (valueIds) => variant.optionValueIds.filter((id) => valueIds.has(id)).length === 1,
          ),
      )
    );
  },

  async saveConfiguration(productId: ProductId, input: SaveProductOptionsInput) {
    const db = database();
    const productRows = await db
      .select({ publishedAt: catalogItems.publishedAt })
      .from(catalogItems)
      .where(eq(catalogItems.id, productId))
      .limit(1);
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
      !distinct(groups.map(({ id }) => id)) ||
      !distinct(groups.map(({ key }) => key)) ||
      !distinct(groups.map(({ position }) => String(position))) ||
      !distinct(values.map(({ id }) => id)) ||
      groups.some(
        (group) =>
          !distinct(group.values.map(({ key }) => key)) ||
          !distinct(group.values.map(({ position }) => String(position))),
      )
    ) {
      return { kind: "invalid_combination" as const };
    }
    const valueIds = new Set(values.map(({ id }) => id));
    const requestedVariants = input.variants.map((variant) => ({
      ...variant,
      id: variant.id ?? createVariantId(),
      combinationKey: combinationKey(variant.optionValueIds),
    }));
    if (
      requestedVariants.some(
        (variant) =>
          !distinct(variant.optionValueIds) ||
          variant.optionValueIds.some((id) => !valueIds.has(id)),
      )
    ) {
      return { kind: "invalid_combination" as const };
    }
    if (!distinct(requestedVariants.map(({ combinationKey: key }) => key))) {
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
      if (new Set(ownedImages.map(({ id }) => id)).size !== new Set(imageIds).size) {
        return { kind: "media_not_owned" as const };
      }
    }

    if (product.publishedAt) {
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
    }

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
    const newVariants = requestedVariants.filter(({ id }) => !existingIds.has(id));
    const now = new Date();
    const archiveGroups = db
      .update(optionGroups)
      .set({ state: "archived", updatedAt: now })
      .where(eq(optionGroups.productId, productId));
    const archiveValues = db
      .update(optionValues)
      .set({ state: "archived", updatedAt: now })
      .where(
        inArray(
          optionValues.optionGroupId,
          currentGroups.length ? currentGroups.map(({ id }) => id) : ["missing"],
        ),
      );
    const archiveVariants = db
      .update(variants)
      .set({ state: "archived", updatedAt: now })
      .where(and(eq(variants.productId, productId), eq(variants.isDefault, false)));
    const defaultState = groups.length === 0 ? "active" : "archived";
    const updateDefault = db
      .update(variants)
      .set({ state: defaultState, updatedAt: now })
      .where(and(eq(variants.productId, productId), eq(variants.isDefault, true)));
    const clearMembership = db
      .delete(variantOptionValues)
      .where(
        inArray(
          variantOptionValues.variantId,
          existingVariants.length ? existingVariants.map(({ id }) => id) : ["missing"],
        ),
      );

    const base = [
      archiveGroups,
      archiveValues,
      archiveVariants,
      updateDefault,
      clearMembership,
    ] as const;
    if (groups.length === 0) {
      await db.batch(base);
      return { kind: "changed" as const, purge: false as const };
    }
    const upsertGroups = db
      .insert(optionGroups)
      .values(
        groups.map((group) => ({
          id: group.id,
          productId,
          key: group.key,
          label: group.label,
          position: group.position,
          state: "active" as const,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoUpdate({ target: optionGroups.id, set: { state: "active", updatedAt: now } });
    const upsertValues = db
      .insert(optionValues)
      .values(
        values.map((value) => ({
          id: value.id,
          optionGroupId: value.optionGroupId,
          key: value.key,
          label: value.label,
          position: value.position,
          state: "active" as const,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoUpdate({ target: optionValues.id, set: { state: "active", updatedAt: now } });
    const applyGroups = groups.map((group) =>
      db
        .update(optionGroups)
        .set({
          key: group.key,
          label: group.label,
          position: group.position,
          state: "active",
          updatedAt: now,
        })
        .where(and(eq(optionGroups.id, group.id), eq(optionGroups.productId, productId))),
    );
    const applyValues = values.map((value) =>
      db
        .update(optionValues)
        .set({
          key: value.key,
          label: value.label,
          position: value.position,
          state: "active",
          updatedAt: now,
        })
        .where(
          and(eq(optionValues.id, value.id), eq(optionValues.optionGroupId, value.optionGroupId)),
        ),
    );
    if (requestedVariants.length === 0) {
      await db.batch([
        ...base,
        upsertGroups,
        upsertValues,
        ...applyGroups,
        ...applyValues,
      ] as const);
      return { kind: "changed" as const, purge: false as const };
    }
    const retainedVariants = requestedVariants.filter(({ id }) => existingIds.has(id));
    const prepareVariants = retainedVariants.map((variant) =>
      db
        .update(variants)
        .set({ combinationKey: `editing:${variant.id}`, updatedAt: now })
        .where(and(eq(variants.id, variant.id), eq(variants.productId, productId))),
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
        .where(and(eq(variants.id, variant.id), eq(variants.productId, productId))),
    );
    const membership = requestedVariants.flatMap((variant) =>
      variant.optionValueIds.map((optionValueId) => ({ variantId: variant.id, optionValueId })),
    );
    const insertMembership = db.insert(variantOptionValues).values(membership);
    if (newVariants.length === 0) {
      await db.batch([
        ...base,
        upsertGroups,
        upsertValues,
        ...applyGroups,
        ...applyValues,
        ...prepareVariants,
        ...applyVariants,
        insertMembership,
      ] as const);
    } else {
      const insertVariants = db.insert(variants).values(
        newVariants.map((variant) => ({
          id: variant.id,
          productId,
          isDefault: false,
          combinationKey: variant.combinationKey,
          priceOverrideMnt: variant.priceOverrideMnt,
          imageMediaAssetId: variant.imageMediaAssetId,
          state: variant.state,
          createdAt: now,
          updatedAt: now,
        })),
      );
      const insertSkus = db.insert(skus).values(
        newVariants.map((variant) => {
          const sku = skuFromVariantId(variant.id);
          return {
            sku,
            skuCompact: compactSku(sku),
            ownerKind: "variant" as const,
            variantId: variant.id,
            bundleId: null,
            lockedAt: null,
            createdAt: now,
            updatedAt: now,
          };
        }),
      );
      const insertStocks = db.insert(stockItems).values(
        newVariants.map((variant) => ({
          id: createStockItemId(),
          variantId: variant.id,
          onHandQuantity: 0,
          reservedQuantity: 0,
          updatedAt: now,
        })),
      );
      await db.batch([
        ...base,
        upsertGroups,
        upsertValues,
        ...applyGroups,
        ...applyValues,
        ...prepareVariants,
        insertVariants,
        ...applyVariants,
        insertSkus,
        insertStocks,
        insertMembership,
      ] as const);
    }
    return { kind: "changed" as const, purge: false as const };
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
    const ownedVariant = and(
      eq(variants.id, variantId),
      eq(variants.productId, productId),
      eq(variants.isDefault, false),
    );
    const variantPredicate =
      state === "active"
        ? ownedVariant
        : and(
            ownedVariant,
            or(
              exists(
                db
                  .select({ id: catalogItems.id })
                  .from(catalogItems)
                  .where(and(eq(catalogItems.id, productId), eq(catalogItems.state, "draft"))),
              ),
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
    return existing.length
      ? { kind: "invalid_publication" as const }
      : { kind: "not_found" as const };
  },
};
