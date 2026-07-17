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
import * as v from "valibot";
import {
  catalogItems,
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

export const catalogTableNames = {
  catalogItems: getTableName(catalogItems),
  variants: getTableName(variants),
  skus: getTableName(skus),
  stockItems: getTableName(stockItems),
  inventoryReservations: getTableName(inventoryReservations),
  inventoryReservationItems: getTableName(inventoryReservationItems),
  inventoryEntries: getTableName(inventoryEntries),
};

const compactSku = (sku: string) => sku.toUpperCase().replaceAll(/[-/\s]/g, "");

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
    const id = createProductId();
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
          "INSERT INTO inventory_entries (id, stock_item_id, kind, on_hand_delta, resulting_on_hand_quantity, resulting_reserved_quantity, actor_kind, staff_id, staff_role, reason, command_correlation_id, created_at) VALUES (?, ?, 'opening', ?, ?, 0, 'staff', ?, ?, ?, ?, ?)",
        ).bind(
          inventoryEntryId,
          stockItemId,
          input.openingQuantity,
          input.openingQuantity,
          ...catalogActorBindings(actor),
          input.inventoryReason,
          correlationId,
          now,
        ),
        acceptedProductAudit(
          actor,
          "catalog.product.create",
          v.parse(ProductIdSchema, id),
          correlationId,
          now,
        ),
      ]);
      return { product: await findCatalogProductById(v.parse(ProductIdSchema, id)) };
    } catch {
      return { conflict: await findConflict(input.slug, input.sku) };
    }
  },

  async update(actor: StaffActor, id: ProductId, input: UpdateProductInput) {
    const current = await findCatalogProductById(id);
    if (!current) {
      return { kind: "not_found" as const };
    }
    const conflict = await findConflict(input.slug, input.sku, id);
    if (conflict) {
      return { kind: conflict };
    }
    if (current.sku !== input.sku && current.state !== "draft") {
      return { kind: "sku_locked" as const };
    }
    const correlationId = crypto.randomUUID();
    const now = Date.now();
    try {
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE catalog_items SET slug = ?, name = ?, description = ?, price_mnt = ?, updated_at = ? WHERE id = ?",
        ).bind(input.slug, input.name, input.description, input.priceMnt, now, id),
        env.DB.prepare(
          "UPDATE skus SET sku = ?, sku_compact = ?, updated_at = ? WHERE variant_id = ? AND locked_at IS NULL",
        ).bind(input.sku, compactSku(input.sku), now, current.defaultVariantId),
        acceptedProductAudit(actor, "catalog.product.update", id, correlationId, now),
      ]);
      return { kind: "changed" as const, product: await findCatalogProductById(id) };
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
    const results = await env.DB.batch([
      env.DB.prepare(
        "UPDATE catalog_items SET state = ?, updated_at = ?, published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END, archived_at = CASE WHEN ? = 'archived' THEN ? ELSE NULL END WHERE id = ? AND state = ? AND price_mnt > 0 AND EXISTS (SELECT 1 FROM variants v JOIN skus s ON s.variant_id = v.id WHERE v.product_id = catalog_items.id AND v.is_default = 1 AND v.state = 'active' AND length(trim(s.sku)) > 0) RETURNING id",
      ).bind(next, now, next, now, next, now, id, expected),
      env.DB.prepare(
        "UPDATE skus SET locked_at = COALESCE(locked_at, ?), updated_at = ? WHERE variant_id = ? AND ? = 'published'",
      ).bind(now, now, current.defaultVariantId, next),
      env.DB.prepare(
        "INSERT INTO audit_events (id, actor_kind, actor_id, staff_role, telegram_operator_label, telegram_user_id, source_channel, action, outcome, entity_kind, entity_id, reason, command_correlation_id, metadata_json, created_at) SELECT ?, 'staff', ?, ?, NULL, NULL, 'admin', ?, 'accepted', 'product', id, NULL, ?, NULL, ? FROM catalog_items WHERE id = ? AND state = ? AND updated_at = ?",
      ).bind(
        createAuditEventId(),
        ...catalogActorBindings(actor),
        `catalog.product.${transition}`,
        correlationId,
        now,
        id,
        next,
        now,
      ),
    ]);
    if (results.at(0)?.results.length === 1) {
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
};
