import {
  createAuditEventId,
  createInventoryEntryId,
  createProductId,
  createStockItemId,
  createVariantId,
  InventoryBlockingReservationSchema,
  ProductIdSchema,
  ProductSchema,
  type CreateProductInput,
  type InventoryAdjustmentInput,
  type Product,
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

const ReturnedProductSchema = v.strictObject({
  id: v.string(),
  defaultVariantId: v.string(),
  stockItemId: v.string(),
  slug: v.string(),
  state: v.string(),
  name: v.string(),
  description: v.string(),
  priceMnt: v.number(),
  sku: v.string(),
  onHandQuantity: v.number(),
  reservedQuantity: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const catalogTableNames = {
  catalogItems: getTableName(catalogItems),
  variants: getTableName(variants),
  skus: getTableName(skus),
  stockItems: getTableName(stockItems),
  inventoryReservations: getTableName(inventoryReservations),
  inventoryReservationItems: getTableName(inventoryReservationItems),
  inventoryEntries: getTableName(inventoryEntries),
};
const projection = `ci.id, v.id AS defaultVariantId, si.id AS stockItemId, ci.slug, ci.state, ci.name, ci.description, ci.price_mnt AS priceMnt, s.sku, si.on_hand_quantity AS onHandQuantity, si.reserved_quantity AS reservedQuantity, ci.created_at AS createdAt, ci.updated_at AS updatedAt`;
const joins = `FROM ${catalogTableNames.catalogItems} ci JOIN ${catalogTableNames.variants} v ON v.product_id = ci.id AND v.is_default = 1 JOIN ${catalogTableNames.skus} s ON s.variant_id = v.id JOIN ${catalogTableNames.stockItems} si ON si.variant_id = v.id`;

const projectProduct = (source: unknown): Product => {
  const row = v.parse(ReturnedProductSchema, source);
  return v.parse(ProductSchema, {
    ...row,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  });
};

const compactSku = (sku: string) => sku.toUpperCase().replaceAll(/[-/\s]/g, "");
const actorBindings = (actor: StaffActor) => [actor.staffId, actor.role] as const;

const findById = async (id: ProductId) => {
  const result = await env.DB.prepare(`SELECT ${projection} ${joins} WHERE ci.id = ?`)
    .bind(id)
    .all();
  const row = result.results.at(0);
  return row ? projectProduct(row) : undefined;
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

const auditInsert = (
  actor: StaffActor,
  action: string,
  entityId: ProductId,
  correlationId: string,
  now: number,
) =>
  env.DB.prepare(
    "INSERT INTO audit_events (id, actor_kind, actor_id, staff_role, telegram_operator_label, telegram_user_id, source_channel, action, outcome, entity_kind, entity_id, reason, command_correlation_id, metadata_json, created_at) VALUES (?, 'staff', ?, ?, NULL, NULL, 'admin', ?, 'accepted', 'product', ?, NULL, ?, NULL, ?)",
  ).bind(createAuditEventId(), ...actorBindings(actor), action, entityId, correlationId, now);

const recordRejectedAttempt = async (
  actor: StaffActor,
  action: string,
  entityKind: "product" | "stock_item",
  entityId: string,
  reason: string,
) => {
  await env.DB.prepare(
    "INSERT INTO audit_events (id, actor_kind, actor_id, staff_role, telegram_operator_label, telegram_user_id, source_channel, action, outcome, entity_kind, entity_id, reason, command_correlation_id, metadata_json, created_at) VALUES (?, 'staff', ?, ?, NULL, NULL, 'admin', ?, 'rejected', ?, ?, ?, ?, NULL, ?)",
  )
    .bind(
      createAuditEventId(),
      ...actorBindings(actor),
      action,
      entityKind,
      entityId,
      reason,
      crypto.randomUUID(),
      Date.now(),
    )
    .run();
};

export const catalogQueries = {
  findById,

  async listAll() {
    const result = await env.DB.prepare(
      `SELECT ${projection} ${joins} ORDER BY ci.created_at DESC`,
    ).all();
    return result.results.map(projectProduct);
  },

  async listPublished() {
    const result = await env.DB.prepare(
      `SELECT ci.id, ci.slug, ci.name, ci.description, ci.price_mnt AS priceMnt FROM catalog_items ci JOIN variants v ON v.product_id = ci.id AND v.is_default = 1 AND v.state = 'active' WHERE ci.state = 'published' ORDER BY ci.created_at DESC`,
    ).all();
    return result.results;
  },

  async findPublishedBySlug(slug: string) {
    const result = await env.DB.prepare(
      "SELECT ci.id, ci.slug, ci.name, ci.description, ci.price_mnt AS priceMnt, v.id AS variantId FROM catalog_items ci JOIN variants v ON v.product_id = ci.id AND v.is_default = 1 AND v.state = 'active' WHERE ci.state = 'published' AND ci.slug = ? LIMIT 1",
    )
      .bind(slug)
      .all();
    return result.results.at(0);
  },

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
          ...actorBindings(actor),
          input.inventoryReason,
          correlationId,
          now,
        ),
        auditInsert(
          actor,
          "catalog.product.create",
          v.parse(ProductIdSchema, id),
          correlationId,
          now,
        ),
      ]);
      return { product: await findById(v.parse(ProductIdSchema, id)) };
    } catch {
      return { conflict: await findConflict(input.slug, input.sku) };
    }
  },

  async update(actor: StaffActor, id: ProductId, input: UpdateProductInput) {
    const current = await findById(id);
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
        auditInsert(actor, "catalog.product.update", id, correlationId, now),
      ]);
      return { kind: "changed" as const, product: await findById(id) };
    } catch {
      return { kind: (await findConflict(input.slug, input.sku, id)) ?? "infrastructure" };
    }
  },

  async transition(
    actor: StaffActor,
    id: ProductId,
    transition: "publish" | "archive" | "reactivate",
  ) {
    const current = await findById(id);
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
        ...actorBindings(actor),
        `catalog.product.${transition}`,
        correlationId,
        now,
        id,
        next,
        now,
      ),
    ]);
    if (results.at(0)?.results.length === 1) {
      return { kind: "changed" as const, product: await findById(id) };
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

  async adjust(actor: StaffActor, id: ProductId, input: InventoryAdjustmentInput) {
    const current = await findById(id);
    if (!current) {
      return { kind: "not_found" as const };
    }
    const resulting = current.onHandQuantity + input.delta;
    if (resulting < current.reservedQuantity) {
      const blockers = await this.blockers(current.stockItemId);
      await recordRejectedAttempt(
        actor,
        "inventory.adjust",
        "stock_item",
        current.stockItemId,
        "reservation_blocked",
      );
      return { kind: "reservation_blocked" as const, blockers };
    }
    const entryId = createInventoryEntryId();
    const correlationId = crypto.randomUUID();
    const now = Date.now();
    const results = await env.DB.batch([
      env.DB.prepare(
        "UPDATE stock_items SET on_hand_quantity = on_hand_quantity + ?, updated_at = ? WHERE id = ? AND on_hand_quantity + ? >= reserved_quantity AND on_hand_quantity + ? >= 0 RETURNING on_hand_quantity",
      ).bind(input.delta, now, current.stockItemId, input.delta, input.delta),
      env.DB.prepare(
        "INSERT INTO inventory_entries (id, stock_item_id, kind, on_hand_delta, resulting_on_hand_quantity, resulting_reserved_quantity, actor_kind, staff_id, staff_role, reason, command_correlation_id, created_at) SELECT ?, id, 'adjustment', ?, on_hand_quantity, reserved_quantity, 'staff', ?, ?, ?, ?, ? FROM stock_items WHERE id = ? AND updated_at = ?",
      ).bind(
        entryId,
        input.delta,
        ...actorBindings(actor),
        input.reason,
        correlationId,
        now,
        current.stockItemId,
        now,
      ),
    ]);
    if (results.at(0)?.results.length === 1 && results.at(1)?.meta.changes === 1) {
      return { kind: "changed" as const, product: await findById(id) };
    }
    const refreshed = await findById(id);
    if (refreshed && refreshed.onHandQuantity + input.delta < refreshed.reservedQuantity) {
      const blockers = await this.blockers(refreshed.stockItemId);
      await recordRejectedAttempt(
        actor,
        "inventory.adjust",
        "stock_item",
        refreshed.stockItemId,
        "reservation_blocked",
      );
      return { kind: "reservation_blocked" as const, blockers };
    }
    return { kind: "conflict" as const };
  },

  async blockers(stockItemId: string) {
    const result = await env.DB.prepare(
      "SELECT ir.id AS reservationId, ir.order_reference AS orderReference, iri.quantity FROM inventory_reservations ir JOIN inventory_reservation_items iri ON iri.reservation_id = ir.id WHERE iri.stock_item_id = ? AND ir.state = 'active' ORDER BY ir.created_at",
    )
      .bind(stockItemId)
      .all();
    return result.results.map((row) => v.parse(InventoryBlockingReservationSchema, row));
  },
};
