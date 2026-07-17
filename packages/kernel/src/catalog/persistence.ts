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
import { and, eq, exists, isNull, ne, sql } from "drizzle-orm";
import {
  auditEvents,
  catalogCachePurgeDebts,
  catalogItems,
  inventoryEntries,
  skus,
  stockItems,
  variants,
} from "../db/schema";
import { database } from "../db/database";
import type { StaffActor } from "../staff/operations";
import { recordRejectedAttempt } from "./audit";
import { findCatalogProductById } from "./product-projection";
import { catalogReaderQueries } from "./reader-persistence";
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
    const publicationVariant = db
      .select({ id: variants.id })
      .from(variants)
      .innerJoin(skus, eq(skus.variantId, variants.id))
      .where(
        and(
          eq(variants.productId, catalogItems.id),
          eq(variants.isDefault, true),
          eq(variants.state, "active"),
          sql`length(trim(${skus.sku})) > 0`,
        ),
      );
    const transitionPredicate =
      transition === "archive"
        ? and(eq(catalogItems.id, id), eq(catalogItems.state, expected))
        : and(
            eq(catalogItems.id, id),
            eq(catalogItems.state, expected),
            sql`${catalogItems.priceMnt} > 0`,
            exists(publicationVariant),
          );
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
                    eq(skus.variantId, current.defaultVariantId),
                    isNull(skus.lockedAt),
                    exists(
                      db
                        .select({ id: catalogItems.id })
                        .from(catalogItems)
                        .where(transitionPredicate),
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
