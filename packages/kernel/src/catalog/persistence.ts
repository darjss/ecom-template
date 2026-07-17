import {
  createAuditEventId,
  createInventoryEntryId,
  createProductId,
  createStockItemId,
  createVariantId,
  type CreateProductInput,
  type ProductId,
  type UpdateProductInput,
} from "@ecom/contracts";
import { and, count, eq, exists, gt, isNull, ne, notExists, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import {
  auditEvents,
  catalogCachePurgeDebts,
  catalogItems,
  inventoryEntries,
  optionGroups,
  optionValues,
  skus,
  stockItems,
  variantOptionValues,
  variants,
} from "../db/schema";
import { database } from "../db/database";
import type { StaffActor } from "../staff/operations";
import { catalogReaderQueries, findCatalogProductById } from "../catalog-reader/persistence";
import { compactSku, skuFromVariantId } from "./sku";

const existsById = async (id: ProductId) => {
  const rows = await database()
    .select({ id: catalogItems.id })
    .from(catalogItems)
    .where(eq(catalogItems.id, id))
    .limit(1);
  return rows.length === 1;
};

const hasDuplicateSlug = async (slug: string, excludedId?: ProductId) => {
  const rows = await database()
    .select({ id: catalogItems.id })
    .from(catalogItems)
    .where(
      excludedId
        ? and(eq(catalogItems.slug, slug), ne(catalogItems.id, excludedId))
        : eq(catalogItems.slug, slug),
    )
    .limit(1);
  return rows.length === 1;
};

export const recordRejectedAttempt = async (
  actor: StaffActor,
  action: string,
  entityKind: "product" | "stock_item",
  entityId: string,
  reason: string,
) => {
  await database().insert(auditEvents).values({
    id: createAuditEventId(),
    actorKind: "staff",
    actorId: actor.staffId,
    staffRole: actor.role,
    sourceChannel: "admin",
    action,
    outcome: "rejected",
    entityKind,
    entityId,
    reason,
    commandCorrelationId: crypto.randomUUID(),
    createdAt: new Date(),
  });
};

const acceptedAuditSelection = (
  actor: StaffActor,
  action: string,
  id: ProductId,
  correlationId: string,
  now: Date,
) => ({
  id: sql<string>`${createAuditEventId()}`.as("id"),
  actorKind: sql<"staff">`'staff'`.as("actor_kind"),
  actorId: sql<string>`${actor.staffId}`.as("actor_id"),
  staffRole: sql<typeof actor.role>`${actor.role}`.as("staff_role"),
  telegramOperatorLabel: sql<null>`NULL`.as("telegram_operator_label"),
  telegramUserId: sql<null>`NULL`.as("telegram_user_id"),
  sourceChannel: sql<"admin">`'admin'`.as("source_channel"),
  action: sql<string>`${action}`.as("action"),
  outcome: sql<"accepted">`'accepted'`.as("outcome"),
  entityKind: sql<string>`'product'`.as("entity_kind"),
  entityId: sql<string>`${id}`.as("entity_id"),
  reason: sql<null>`NULL`.as("reason"),
  commandCorrelationId: sql<string>`${correlationId}`.as("command_correlation_id"),
  metadataJson: sql<null>`NULL`.as("metadata_json"),
  createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
});

const cacheDebtSelection = (id: ProductId, revision: string, now: Date) => ({
  productId: sql<string>`${id}`.as("product_id"),
  revision: sql<string>`${revision}`.as("revision"),
  attemptCount: sql<number>`0`.as("attempt_count"),
  requestId: sql<null>`NULL`.as("request_id"),
  commandCommittedAt: sql<Date>`${now.getTime()}`.as("command_committed_at"),
  lastAttemptedAt: sql<null>`NULL`.as("last_attempted_at"),
});

export const catalogQueries = {
  ...catalogReaderQueries,

  async create(actor: StaffActor, input: CreateProductInput) {
    const id = createProductId();
    const variantId = createVariantId();
    const sku = skuFromVariantId(variantId);
    const stockItemId = createStockItemId();
    const correlationId = crypto.randomUUID();
    const now = new Date();
    const db = database();

    try {
      await db.batch([
        db.insert(catalogItems).values({
          id,
          kind: "product",
          slug: input.slug,
          state: "draft",
          name: input.name,
          description: input.description,
          priceMnt: input.priceMnt,
          createdAt: now,
          updatedAt: now,
        }),
        db.insert(variants).values({
          id: variantId,
          productId: id,
          isDefault: true,
          combinationKey: "__default__",
          priceOverrideMnt: null,
          imageMediaAssetId: null,
          state: "active",
          createdAt: now,
          updatedAt: now,
        }),
        db.insert(skus).values({
          sku,
          skuCompact: compactSku(sku),
          ownerKind: "variant",
          variantId,
          bundleId: null,
          lockedAt: null,
          createdAt: now,
          updatedAt: now,
        }),
        db.insert(stockItems).values({
          id: stockItemId,
          variantId,
          onHandQuantity: input.openingQuantity,
          reservedQuantity: 0,
          updatedAt: now,
        }),
        db.insert(inventoryEntries).values({
          id: createInventoryEntryId(),
          stockItemId,
          kind: "opening",
          onHandDelta: input.openingQuantity,
          actorKind: "staff",
          staffId: actor.staffId,
          staffRole: actor.role,
          reason: input.inventoryReason,
          commandCorrelationId: correlationId,
          createdAt: now,
        }),
        db.insert(auditEvents).values({
          id: createAuditEventId(),
          actorKind: "staff",
          actorId: actor.staffId,
          staffRole: actor.role,
          sourceChannel: "admin",
          action: "catalog.product.create",
          outcome: "accepted",
          entityKind: "product",
          entityId: id,
          commandCorrelationId: correlationId,
          createdAt: now,
        }),
      ]);
    } catch {
      return {
        conflict: (await hasDuplicateSlug(input.slug))
          ? ("duplicate_slug" as const)
          : ("infrastructure" as const),
      };
    }

    return { product: await findCatalogProductById(id) };
  },

  async update(actor: StaffActor, id: ProductId, input: UpdateProductInput) {
    const correlationId = crypto.randomUUID();
    const debtRevision = crypto.randomUUID();
    const now = new Date();
    const db = database();
    const productPredicate = eq(catalogItems.id, id);
    const publicPredicate = and(productPredicate, ne(catalogItems.state, "draft"));

    try {
      const results = await db.batch([
        db
          .update(catalogItems)
          .set({
            slug: input.slug,
            name: input.name,
            description: input.description,
            priceMnt: input.priceMnt,
            updatedAt: now,
          })
          .where(productPredicate)
          .returning({ state: catalogItems.state }),
        db.insert(auditEvents).select(
          db
            .select(acceptedAuditSelection(actor, "catalog.product.update", id, correlationId, now))
            .from(catalogItems)
            .where(productPredicate),
        ),
        db
          .insert(catalogCachePurgeDebts)
          .select(
            db
              .select(cacheDebtSelection(id, debtRevision, now))
              .from(catalogItems)
              .where(publicPredicate),
          )
          .onConflictDoUpdate({
            target: catalogCachePurgeDebts.productId,
            set: {
              revision: debtRevision,
              attemptCount: 0,
              requestId: null,
              commandCommittedAt: now,
              lastAttemptedAt: null,
            },
          }),
      ] as const);
      const changed = results[0].at(0);
      if (changed) {
        const product = await findCatalogProductById(id);
        return product
          ? { kind: "changed" as const, product }
          : { kind: "infrastructure" as const };
      }
    } catch {
      return {
        kind: (await hasDuplicateSlug(input.slug, id))
          ? ("duplicate_slug" as const)
          : ("infrastructure" as const),
      };
    }

    return { kind: "not_found" as const };
  },

  async transition(
    actor: StaffActor,
    id: ProductId,
    transition: "publish" | "archive" | "reactivate",
  ) {
    const current = await findCatalogProductById(id);
    if (!current) {
      const kind = (await existsById(id))
        ? ("invalid_publication" as const)
        : ("not_found" as const);
      if (kind === "invalid_publication") {
        await recordRejectedAttempt(actor, `catalog.product.${transition}`, "product", id, kind);
      }
      return { kind };
    }

    const expected =
      transition === "publish" ? "draft" : transition === "archive" ? "published" : "archived";
    const next = transition === "archive" ? "archived" : "published";
    if (current.state === next) {
      return { kind: "changed" as const, product: current };
    }
    if (current.state !== expected) {
      await recordRejectedAttempt(
        actor,
        `catalog.product.${transition}`,
        "product",
        id,
        "invalid_lifecycle",
      );
      return { kind: "invalid_lifecycle" as const };
    }

    const db = database();
    const publicationVariant = alias(variants, "publication_variant");
    const publicationSku = alias(skus, "publication_sku");
    const publicationGroup = alias(optionGroups, "publication_group");
    const publicationMembership = alias(variantOptionValues, "publication_variant_option_value");
    const publicationValue = alias(optionValues, "publication_value");
    const duplicateMembership = alias(
      variantOptionValues,
      "duplicate_publication_variant_option_value",
    );
    const duplicateValue = alias(optionValues, "duplicate_publication_value");
    const duplicateVariant = alias(variants, "duplicate_publication_variant");
    const activeGroups = db
      .select({ id: publicationGroup.id })
      .from(publicationGroup)
      .where(
        and(eq(publicationGroup.productId, catalogItems.id), eq(publicationGroup.state, "active")),
      );
    const validSku = db
      .select({ sku: publicationSku.sku })
      .from(publicationSku)
      .where(
        and(
          eq(publicationSku.variantId, publicationVariant.id),
          sql`length(trim(${publicationSku.sku})) > 0`,
        ),
      );
    const missingGroup = db
      .select({ id: publicationGroup.id })
      .from(publicationGroup)
      .where(
        and(
          eq(publicationGroup.productId, catalogItems.id),
          eq(publicationGroup.state, "active"),
          notExists(
            db
              .select({ id: publicationMembership.optionValueId })
              .from(publicationMembership)
              .innerJoin(
                publicationValue,
                eq(publicationValue.id, publicationMembership.optionValueId),
              )
              .where(
                and(
                  eq(publicationMembership.variantId, publicationVariant.id),
                  eq(publicationValue.optionGroupId, publicationGroup.id),
                  eq(publicationValue.state, "active"),
                ),
              ),
          ),
        ),
      );
    const invalidMembership = db
      .select({ id: publicationMembership.optionValueId })
      .from(publicationMembership)
      .innerJoin(publicationValue, eq(publicationValue.id, publicationMembership.optionValueId))
      .innerJoin(publicationGroup, eq(publicationGroup.id, publicationValue.optionGroupId))
      .where(
        and(
          eq(publicationMembership.variantId, publicationVariant.id),
          or(
            ne(publicationGroup.productId, catalogItems.id),
            ne(publicationGroup.state, "active"),
            ne(publicationValue.state, "active"),
          ),
        ),
      );
    const repeatedGroup = db
      .select({ optionGroupId: duplicateValue.optionGroupId })
      .from(duplicateMembership)
      .innerJoin(duplicateValue, eq(duplicateValue.id, duplicateMembership.optionValueId))
      .where(eq(duplicateMembership.variantId, publicationVariant.id))
      .groupBy(duplicateValue.optionGroupId)
      .having(gt(count(), 1));
    const invalidActiveVariant = db
      .select({ id: publicationVariant.id })
      .from(publicationVariant)
      .where(
        and(
          eq(publicationVariant.productId, catalogItems.id),
          eq(publicationVariant.state, "active"),
          or(
            sql`coalesce(${publicationVariant.priceOverrideMnt}, ${catalogItems.priceMnt}) <= 0`,
            notExists(validSku),
            and(eq(publicationVariant.isDefault, true), exists(activeGroups)),
            and(eq(publicationVariant.isDefault, false), notExists(activeGroups)),
            and(
              eq(publicationVariant.isDefault, false),
              or(exists(missingGroup), exists(invalidMembership), exists(repeatedGroup)),
            ),
          ),
        ),
      );
    const activeDefaultVariant = db
      .select({ id: publicationVariant.id })
      .from(publicationVariant)
      .where(
        and(
          eq(publicationVariant.productId, catalogItems.id),
          eq(publicationVariant.isDefault, true),
          eq(publicationVariant.state, "active"),
          exists(validSku),
        ),
      );
    const activeExplicitVariant = db
      .select({ id: publicationVariant.id })
      .from(publicationVariant)
      .where(
        and(
          eq(publicationVariant.productId, catalogItems.id),
          eq(publicationVariant.isDefault, false),
          eq(publicationVariant.state, "active"),
          exists(validSku),
        ),
      );
    const duplicateCombination = db
      .select({ id: duplicateVariant.id })
      .from(duplicateVariant)
      .innerJoin(
        publicationVariant,
        and(
          eq(publicationVariant.productId, duplicateVariant.productId),
          eq(publicationVariant.combinationKey, duplicateVariant.combinationKey),
          sql`${publicationVariant.id} < ${duplicateVariant.id}`,
        ),
      )
      .where(
        and(
          eq(duplicateVariant.productId, catalogItems.id),
          eq(duplicateVariant.state, "active"),
          eq(publicationVariant.state, "active"),
        ),
      );
    const publicationIsValid = and(
      sql`${catalogItems.priceMnt} > 0`,
      notExists(invalidActiveVariant),
      notExists(duplicateCombination),
      or(
        and(notExists(activeGroups), exists(activeDefaultVariant)),
        and(exists(activeGroups), exists(activeExplicitVariant)),
      ),
    );
    const transitionPredicate =
      transition === "archive"
        ? and(eq(catalogItems.id, id), eq(catalogItems.state, expected))
        : and(eq(catalogItems.id, id), eq(catalogItems.state, expected), publicationIsValid);
    const now = new Date();
    const correlationId = crypto.randomUUID();
    const debtRevision = crypto.randomUUID();
    const action = `catalog.product.${transition}`;
    const auditStatement = db.insert(auditEvents).select(
      db
        .select(acceptedAuditSelection(actor, action, id, correlationId, now))
        .from(catalogItems)
        .where(transitionPredicate),
    );
    const debtStatement = db
      .insert(catalogCachePurgeDebts)
      .select(
        db
          .select(cacheDebtSelection(id, debtRevision, now))
          .from(catalogItems)
          .where(transitionPredicate),
      )
      .onConflictDoUpdate({
        target: catalogCachePurgeDebts.productId,
        set: {
          revision: debtRevision,
          attemptCount: 0,
          requestId: null,
          commandCommittedAt: now,
          lastAttemptedAt: null,
        },
      });
    const transitionStatement = db
      .update(catalogItems)
      .set({
        state: next,
        updatedAt: now,
        publishedAt:
          next === "published"
            ? sql`coalesce(${catalogItems.publishedAt}, ${now.getTime()})`
            : undefined,
        archivedAt: next === "archived" ? now : null,
      })
      .where(transitionPredicate)
      .returning({ id: catalogItems.id });

    const transitioned =
      transition === "publish"
        ? (
            await db.batch([
              db
                .update(skus)
                .set({ lockedAt: now, updatedAt: now })
                .where(
                  and(
                    isNull(skus.lockedAt),
                    exists(
                      db
                        .select({ id: variants.id })
                        .from(variants)
                        .innerJoin(catalogItems, eq(catalogItems.id, variants.productId))
                        .where(
                          and(
                            eq(variants.id, skus.variantId),
                            eq(variants.productId, id),
                            exists(
                              db
                                .select({ id: catalogItems.id })
                                .from(catalogItems)
                                .where(transitionPredicate),
                            ),
                          ),
                        ),
                    ),
                  ),
                )
                .returning({ sku: skus.sku }),
              auditStatement,
              debtStatement,
              transitionStatement,
            ] as const)
          )[3]
        : (await db.batch([auditStatement, debtStatement, transitionStatement] as const))[2];
    if (transitioned.length === 1) {
      return { kind: "changed" as const, product: await findCatalogProductById(id) };
    }

    const resolved = await findCatalogProductById(id);
    if (resolved?.state === next) {
      return { kind: "changed" as const, product: resolved };
    }
    const kind =
      resolved && resolved.state !== expected ? "invalid_lifecycle" : "invalid_publication";
    await recordRejectedAttempt(actor, action, "product", id, kind);
    return { kind };
  },

  async findCachePurgeDebt(id: ProductId) {
    const rows = await database()
      .select({ revision: catalogCachePurgeDebts.revision })
      .from(catalogCachePurgeDebts)
      .where(eq(catalogCachePurgeDebts.productId, id))
      .limit(1);
    return rows.at(0);
  },

  async recordCachePurgeOutcome(
    id: ProductId,
    revision: string,
    outcome: "purged" | "failed",
    requestId: string | null,
  ) {
    if (outcome === "purged") {
      const rows = await database()
        .delete(catalogCachePurgeDebts)
        .where(
          and(
            eq(catalogCachePurgeDebts.productId, id),
            eq(catalogCachePurgeDebts.revision, revision),
          ),
        )
        .returning({ productId: catalogCachePurgeDebts.productId });
      return rows.length === 1;
    }

    const rows = await database()
      .update(catalogCachePurgeDebts)
      .set({
        attemptCount: sql`${catalogCachePurgeDebts.attemptCount} + 1`,
        requestId,
        lastAttemptedAt: new Date(),
      })
      .where(
        and(
          eq(catalogCachePurgeDebts.productId, id),
          eq(catalogCachePurgeDebts.revision, revision),
          sql`${catalogCachePurgeDebts.attemptCount} < 1000000`,
        ),
      )
      .returning({ productId: catalogCachePurgeDebts.productId });
    return rows.length === 1;
  },
};
