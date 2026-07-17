import {
  createAuditEventId,
  createInventoryEntryId,
  createProductId,
  createStockItemId,
  createVariantId,
  ProductIdSchema,
  type CreateProductInput,
  type ProductId,
  type UpdateProductInput,
} from "@ecom/contracts";
import { env } from "cloudflare:workers";
import { getTableName } from "drizzle-orm";
import { canonicalize } from "json-canonicalize";
import * as v from "valibot";
import {
  catalogCachePurgeDebts,
  catalogItems,
  idempotencyRecords,
  inventoryEntries,
  inventoryReservationItems,
  inventoryReservations,
  skus,
  stockItems,
  variants,
} from "../db/schema";
import type { StaffActor } from "../staff/operations";
import { acceptedProductAudit, catalogActorBindings, recordRejectedAttempt } from "./audit";
import { findCatalogProductById } from "./product-projection";
import { catalogReaderQueries } from "./reader-persistence";
import { compactSku } from "./sku";

export const catalogTableNames = {
  cachePurgeDebts: getTableName(catalogCachePurgeDebts),
  catalogItems: getTableName(catalogItems),
  variants: getTableName(variants),
  skus: getTableName(skus),
  stockItems: getTableName(stockItems),
  inventoryReservations: getTableName(inventoryReservations),
  inventoryReservationItems: getTableName(inventoryReservationItems),
  inventoryEntries: getTableName(inventoryEntries),
  idempotencyRecords: getTableName(idempotencyRecords),
};

const createIdempotencyScope = "catalog.product.create";
const CachePurgeDebtRevisionSchema = v.strictObject({ revision: v.string() });
const ReturnedProductStateSchema = v.strictObject({
  state: v.picklist(["draft", "published", "archived"]),
});
const ReturnedCreateIdempotencySchema = v.strictObject({
  requestHash: v.string(),
  resultId: ProductIdSchema,
});
const cachePurgeDebtUpsert = (acceptancePredicate: string) =>
  `INSERT INTO ${catalogTableNames.cachePurgeDebts} (product_id, revision, attempt_count, request_id, command_committed_at, last_attempted_at) SELECT id, ?, 0, NULL, ?, NULL FROM ${catalogTableNames.catalogItems} WHERE ${acceptancePredicate} ON CONFLICT(product_id) DO UPDATE SET revision = excluded.revision, attempt_count = 0, request_id = NULL, command_committed_at = excluded.command_committed_at, last_attempted_at = NULL RETURNING revision`;

const createRequestHash = async (actor: StaffActor, input: CreateProductInput) => {
  const bytes = new TextEncoder().encode(
    canonicalize({
      actorStaffId: actor.staffId,
      description: input.description,
      inventoryReason: input.inventoryReason,
      name: input.name,
      openingQuantity: input.openingQuantity,
      priceMnt: input.priceMnt,
      sku: input.sku,
      slug: input.slug,
    }),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const readCreateIdempotency = async (key: string) => {
  const result = await env.DB.prepare(
    `SELECT request_hash AS requestHash, result_id AS resultId FROM ${catalogTableNames.idempotencyRecords} WHERE scope = ? AND key = ? LIMIT 1`,
  )
    .bind(createIdempotencyScope, key)
    .all();
  const row = result.results.at(0);
  return row ? v.parse(ReturnedCreateIdempotencySchema, row) : undefined;
};

const existsById = async (id: ProductId) => {
  const result = await env.DB.prepare("SELECT id FROM catalog_items WHERE id = ? LIMIT 1")
    .bind(id)
    .all();
  return result.results.length === 1;
};

const findConflict = async (slug: string, sku: string, excludedId?: ProductId) => {
  const slugResult = await env.DB.prepare(
    `SELECT id FROM catalog_items WHERE slug = ?${excludedId ? " AND id <> ?" : ""}`,
  )
    .bind(...(excludedId ? [slug, excludedId] : [slug]))
    .all();
  if (slugResult.results.length > 0) {
    return "duplicate_slug" as const;
  }
  const skuResult = await env.DB.prepare(
    `SELECT s.variant_id FROM skus s JOIN variants v ON v.id = s.variant_id WHERE s.sku_compact = ?${excludedId ? " AND v.product_id <> ?" : ""}`,
  )
    .bind(...(excludedId ? [compactSku(sku), excludedId] : [compactSku(sku)]))
    .all();
  return skuResult.results.length > 0 ? ("duplicate_sku" as const) : undefined;
};

export const catalogQueries = {
  ...catalogReaderQueries,

  async create(actor: StaffActor, input: CreateProductInput) {
    const hash = await createRequestHash(actor, input);
    const replay = await readCreateIdempotency(input.idempotencyKey);
    if (replay) {
      return replay.requestHash === hash
        ? { product: await findCatalogProductById(replay.resultId) }
        : { conflict: "idempotency_conflict" as const };
    }

    const id = v.parse(ProductIdSchema, createProductId());
    const variantId = createVariantId();
    const stockItemId = createStockItemId();
    const inventoryEntryId = createInventoryEntryId();
    const correlationId = crypto.randomUUID();
    const now = Date.now();
    try {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO catalog_items (id, kind, slug, state, name, description, price_mnt, created_at, updated_at) VALUES (?, 'product', ?, 'draft', ?, ?, ?, ?, ?)",
        ).bind(id, input.slug, input.name, input.description, input.priceMnt, now, now),
        env.DB.prepare(
          "INSERT INTO variants (id, product_id, is_default, state, created_at, updated_at) VALUES (?, ?, 1, 'active', ?, ?)",
        ).bind(variantId, id, now, now),
        env.DB.prepare(
          "INSERT INTO skus (sku, sku_compact, owner_kind, variant_id, bundle_id, locked_at, created_at, updated_at) VALUES (?, ?, 'variant', ?, NULL, NULL, ?, ?)",
        ).bind(input.sku, compactSku(input.sku), variantId, now, now),
        env.DB.prepare(
          "INSERT INTO stock_items (id, variant_id, on_hand_quantity, reserved_quantity, updated_at) VALUES (?, ?, ?, 0, ?)",
        ).bind(stockItemId, variantId, input.openingQuantity, now),
        env.DB.prepare(
          "INSERT INTO inventory_entries (id, stock_item_id, kind, on_hand_delta, actor_kind, staff_id, staff_role, reason, command_correlation_id, created_at) VALUES (?, ?, 'opening', ?, 'staff', ?, ?, ?, ?, ?)",
        ).bind(
          inventoryEntryId,
          stockItemId,
          input.openingQuantity,
          ...catalogActorBindings(actor),
          input.inventoryReason,
          correlationId,
          now,
        ),
        acceptedProductAudit(actor, "catalog.product.create", id, correlationId, now),
        env.DB.prepare(
          `INSERT INTO ${catalogTableNames.idempotencyRecords} (scope, key, request_hash, result_kind, result_id, created_at) VALUES (?, ?, ?, 'catalog_product', ?, ?)`,
        ).bind(createIdempotencyScope, input.idempotencyKey, hash, id, now),
      ]);
    } catch {
      const committed = await readCreateIdempotency(input.idempotencyKey);
      if (committed) {
        return committed.requestHash === hash
          ? { product: await findCatalogProductById(committed.resultId) }
          : { conflict: "idempotency_conflict" as const };
      }
      return {
        conflict: (await findConflict(input.slug, input.sku)) ?? ("infrastructure" as const),
      };
    }
    return { product: await findCatalogProductById(id) };
  },

  async update(actor: StaffActor, id: ProductId, input: UpdateProductInput) {
    const correlationId = crypto.randomUUID();
    const debtRevision = crypto.randomUUID();
    const now = Date.now();
    const catalogAcceptance = `(catalog_items.state = 'draft' AND EXISTS (SELECT 1 FROM variants v JOIN skus s ON s.variant_id = v.id WHERE v.product_id = catalog_items.id AND v.is_default = 1 AND s.locked_at IS NULL)) OR (catalog_items.state <> 'draft' AND EXISTS (SELECT 1 FROM variants v JOIN skus s ON s.variant_id = v.id WHERE v.product_id = catalog_items.id AND v.is_default = 1 AND s.sku = ?))`;
    const publicAcceptance =
      "id = ? AND state <> 'draft' AND EXISTS (SELECT 1 FROM variants v JOIN skus s ON s.variant_id = v.id WHERE v.product_id = catalog_items.id AND v.is_default = 1 AND s.sku = ?)";
    try {
      const results = await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO audit_events (id, actor_kind, actor_id, staff_role, telegram_operator_label, telegram_user_id, source_channel, action, outcome, entity_kind, entity_id, reason, command_correlation_id, metadata_json, created_at) SELECT ?, 'staff', ?, ?, NULL, NULL, 'admin', 'catalog.product.update', 'accepted', 'product', id, NULL, ?, NULL, ? FROM catalog_items WHERE id = ? AND (${catalogAcceptance})`,
        ).bind(
          createAuditEventId(),
          ...catalogActorBindings(actor),
          correlationId,
          now,
          id,
          input.sku,
        ),
        env.DB.prepare(
          `UPDATE catalog_items SET slug = ?, name = ?, description = ?, price_mnt = ?, updated_at = ? WHERE id = ? AND (${catalogAcceptance}) RETURNING state`,
        ).bind(input.slug, input.name, input.description, input.priceMnt, now, id, input.sku),
        env.DB.prepare(
          "UPDATE skus SET sku = ?, sku_compact = ?, updated_at = ? WHERE variant_id = (SELECT id FROM variants WHERE product_id = ? AND is_default = 1) AND locked_at IS NULL AND EXISTS (SELECT 1 FROM catalog_items WHERE id = ? AND state = 'draft') RETURNING sku",
        ).bind(input.sku, compactSku(input.sku), now, id, id),
        env.DB.prepare(cachePurgeDebtUpsert(publicAcceptance)).bind(
          debtRevision,
          now,
          id,
          input.sku,
        ),
      ]);
      const stateRow = results.at(1)?.results.at(0);
      const acceptedState = stateRow
        ? v.parse(ReturnedProductStateSchema, stateRow).state
        : undefined;
      const stateEffectsMatch =
        acceptedState === "draft"
          ? results.at(2)?.results.length === 1 && results.at(3)?.results.length === 0
          : acceptedState === "published" || acceptedState === "archived"
            ? results.at(2)?.results.length === 0 && results.at(3)?.results.length === 1
            : false;
      if (results.at(0)?.meta.changes === 1 && stateEffectsMatch) {
        const product = await findCatalogProductById(id);
        if (product?.sku === input.sku) {
          return { kind: "changed" as const, product };
        }
      }
      return { kind: (await existsById(id)) ? ("sku_locked" as const) : ("not_found" as const) };
    } catch {
      return { kind: (await findConflict(input.slug, input.sku, id)) ?? "infrastructure" };
    }
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
    if (current.priceMnt <= 0 || current.sku.length === 0) {
      await recordRejectedAttempt(
        actor,
        `catalog.product.${transition}`,
        "product",
        id,
        "invalid_publication",
      );
      return { kind: "invalid_publication" as const };
    }
    const now = Date.now();
    const correlationId = crypto.randomUUID();
    const transitionPredicate =
      transition === "archive"
        ? "id = ? AND state = ?"
        : "id = ? AND state = ? AND price_mnt > 0 AND EXISTS (SELECT 1 FROM variants v JOIN skus s ON s.variant_id = v.id WHERE v.product_id = catalog_items.id AND v.is_default = 1 AND v.state = 'active' AND length(trim(s.sku)) > 0)";
    const statements = [];
    if (transition === "publish") {
      statements.push(
        env.DB.prepare(
          "UPDATE skus AS s SET locked_at = COALESCE(locked_at, ?), updated_at = ? WHERE s.variant_id = ? AND EXISTS (SELECT 1 FROM catalog_items ci JOIN variants v ON v.product_id = ci.id WHERE ci.id = ? AND ci.state = 'draft' AND ci.price_mnt > 0 AND v.id = s.variant_id AND v.is_default = 1 AND v.state = 'active' AND length(trim(s.sku)) > 0) RETURNING sku",
        ).bind(now, now, current.defaultVariantId, id),
      );
    }
    statements.push(
      env.DB.prepare(
        `INSERT INTO audit_events (id, actor_kind, actor_id, staff_role, telegram_operator_label, telegram_user_id, source_channel, action, outcome, entity_kind, entity_id, reason, command_correlation_id, metadata_json, created_at) SELECT ?, 'staff', ?, ?, NULL, NULL, 'admin', ?, 'accepted', 'product', id, NULL, ?, NULL, ? FROM catalog_items WHERE ${transitionPredicate}`,
      ).bind(
        createAuditEventId(),
        ...catalogActorBindings(actor),
        `catalog.product.${transition}`,
        correlationId,
        now,
        id,
        expected,
      ),
      env.DB.prepare(cachePurgeDebtUpsert(transitionPredicate)).bind(
        crypto.randomUUID(),
        now,
        id,
        expected,
      ),
      env.DB.prepare(
        `UPDATE catalog_items SET state = ?, updated_at = ?, published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END, archived_at = CASE WHEN ? = 'archived' THEN ? ELSE NULL END WHERE ${transitionPredicate} RETURNING id`,
      ).bind(next, now, next, now, next, now, id, expected),
    );
    const results = await env.DB.batch(statements);
    const publicationLockChanged = transition !== "publish" || results.at(0)?.results.length === 1;
    const auditIndex = transition === "publish" ? 1 : 0;
    const debtIndex = auditIndex + 1;
    const transitionIndex = debtIndex + 1;
    if (
      publicationLockChanged &&
      results.at(auditIndex)?.meta.changes === 1 &&
      results.at(transitionIndex)?.results.length === 1 &&
      results.at(debtIndex)?.results.length === 1
    ) {
      return { kind: "changed" as const, product: await findCatalogProductById(id) };
    }
    await recordRejectedAttempt(
      actor,
      `catalog.product.${transition}`,
      "product",
      id,
      "invalid_publication",
    );
    return { kind: "invalid_publication" as const };
  },

  async findCachePurgeDebt(id: ProductId) {
    const result = await env.DB.prepare(
      `SELECT revision FROM ${catalogTableNames.cachePurgeDebts} WHERE product_id = ? LIMIT 1`,
    )
      .bind(id)
      .all();
    const row = result.results.at(0);
    return row ? v.parse(CachePurgeDebtRevisionSchema, row) : undefined;
  },

  async recordCachePurgeOutcome(
    id: ProductId,
    revision: string,
    outcome: "purged" | "failed",
    requestId: string | null,
  ) {
    if (outcome === "purged") {
      const result = await env.DB.prepare(
        `DELETE FROM ${catalogTableNames.cachePurgeDebts} WHERE product_id = ? AND revision = ? RETURNING product_id`,
      )
        .bind(id, revision)
        .all();
      return result.results.length === 1;
    }
    const result = await env.DB.prepare(
      `UPDATE ${catalogTableNames.cachePurgeDebts} SET attempt_count = attempt_count + 1, request_id = ?, last_attempted_at = ? WHERE product_id = ? AND revision = ? AND attempt_count < 1000000 RETURNING product_id`,
    )
      .bind(requestId, Date.now(), id, revision)
      .all();
    return result.results.length === 1;
  },
};
