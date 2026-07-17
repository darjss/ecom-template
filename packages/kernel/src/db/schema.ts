import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export * from "../auth/customer.generated";
export * from "../auth/staff.generated";

export const customers = sqliteTable(
  "customers",
  {
    id: text("id").primaryKey(),
    normalizedPhone: text("normalized_phone").notNull().unique(),
    authUserId: text("auth_user_id").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check(
      "customers_phone_check",
      sql`${table.normalizedPhone} GLOB '+976[5-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'`,
    ),
    check(
      "customers_id_check",
      sql`length(${table.id}) = 35 AND substr(${table.id}, 1, 9) = 'customer_' AND substr(${table.id}, 10, 1) GLOB '[0-7]' AND substr(${table.id}, 10) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'`,
    ),
    check("customers_auth_identity_check", sql`${table.authUserId} = ${table.id}`),
  ],
);

export const customerOtpRateCounters = sqliteTable(
  "customer_otp_rate_counters",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check("customer_otp_rate_counters_count_check", sql`${table.count} > 0`),
    index("customer_otp_rate_counters_expiry_idx").on(table.expiresAt),
  ],
);

export const customerOtpRateAdmissions = sqliteTable(
  "customer_otp_rate_admissions",
  {
    requestId: text("request_id").primaryKey(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check("customer_otp_rate_admissions_request_id_check", sql`length(${table.requestId}) = 36`),
    index("customer_otp_rate_admissions_created_idx").on(table.createdAt),
  ],
);

export const customerOtpChallenges = sqliteTable(
  "customer_otp_challenges",
  {
    normalizedPhone: text("normalized_phone").primaryKey(),
    digest: text("digest").notNull(),
    requestId: text("request_id").notNull().unique(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check("customer_otp_challenges_attempts_check", sql`${table.attempts} BETWEEN 0 AND 4`),
    check("customer_otp_challenges_digest_check", sql`length(${table.digest}) = 64`),
    check("customer_otp_challenges_request_id_check", sql`length(${table.requestId}) = 36`),
    check("customer_otp_challenges_expiry_check", sql`${table.createdAt} < ${table.expiresAt}`),
  ],
);

export const staffMembers = sqliteTable(
  "staff_members",
  {
    id: text("id").primaryKey(),
    normalizedEmail: text("normalized_email").notNull().unique(),
    authUserId: text("auth_user_id").unique(),
    status: text("status", { enum: ["pending", "active", "revoked"] }).notNull(),
    role: text("role", { enum: ["owner", "manager", "staff"] }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    check("staff_members_status_check", sql`${table.status} IN ('pending', 'active', 'revoked')`),
    check(
      "staff_members_role_check",
      sql`${table.role} IS NULL OR ${table.role} IN ('owner', 'manager', 'staff')`,
    ),
    check(
      "staff_members_id_check",
      sql`length(${table.id}) = 32 AND substr(${table.id}, 1, 6) = 'staff_' AND substr(${table.id}, 7, 1) GLOB '[0-7]' AND substr(${table.id}, 7) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'`,
    ),
    check(
      "staff_members_lifecycle_check",
      sql`(${table.status} = 'pending' AND ${table.approvedAt} IS NULL AND ${table.revokedAt} IS NULL) OR (${table.status} = 'active' AND ${table.role} IS NOT NULL AND ${table.approvedAt} IS NOT NULL AND ${table.revokedAt} IS NULL) OR (${table.status} = 'revoked' AND ${table.approvedAt} IS NOT NULL AND ${table.revokedAt} IS NOT NULL)`,
    ),
    check(
      "staff_members_lifecycle_order_check",
      sql`${table.createdAt} <= ${table.updatedAt} AND (${table.approvedAt} IS NULL OR (${table.createdAt} <= ${table.approvedAt} AND ${table.approvedAt} <= ${table.updatedAt})) AND (${table.revokedAt} IS NULL OR (${table.approvedAt} <= ${table.revokedAt} AND ${table.revokedAt} <= ${table.updatedAt}))`,
    ),
  ],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    actorKind: text("actor_kind", {
      enum: ["system", "staff", "customer", "provider", "telegram_operator"],
    }).notNull(),
    actorId: text("actor_id"),
    staffRole: text("staff_role", { enum: ["owner", "manager", "staff"] }),
    telegramOperatorLabel: text("telegram_operator_label"),
    telegramUserId: integer("telegram_user_id"),
    sourceChannel: text("source_channel", {
      enum: ["admin", "storefront", "provider_callback", "workflow", "telegram", "provisioning"],
    }).notNull(),
    action: text("action").notNull(),
    outcome: text("outcome", { enum: ["accepted", "rejected"] }).notNull(),
    entityKind: text("entity_kind").notNull(),
    entityId: text("entity_id").notNull(),
    reason: text("reason"),
    commandCorrelationId: text("command_correlation_id").notNull(),
    metadataJson: text("metadata_json"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check(
      "audit_events_id_check",
      sql`length(${table.id}) = 32 AND substr(${table.id}, 1, 6) = 'audit_' AND substr(${table.id}, 7, 1) GLOB '[0-7]' AND substr(${table.id}, 7) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'`,
    ),
    check(
      "audit_events_actor_check",
      sql`(${table.actorKind} = 'staff' AND ${table.actorId} IS NOT NULL AND ${table.staffRole} IS NOT NULL AND ${table.telegramOperatorLabel} IS NULL AND ${table.telegramUserId} IS NULL) OR (${table.actorKind} = 'telegram_operator' AND ${table.actorId} IS NULL AND ${table.staffRole} IS NULL AND ${table.telegramOperatorLabel} IS NOT NULL AND ${table.telegramUserId} IS NOT NULL) OR (${table.actorKind} NOT IN ('staff', 'telegram_operator') AND ${table.staffRole} IS NULL AND ${table.telegramOperatorLabel} IS NULL AND ${table.telegramUserId} IS NULL)`,
    ),
    check(
      "audit_events_actor_kind_check",
      sql`${table.actorKind} IN ('system', 'staff', 'customer', 'provider', 'telegram_operator')`,
    ),
    check(
      "audit_events_staff_actor_id_check",
      sql`${table.actorKind} <> 'staff' OR (length(${table.actorId}) = 32 AND substr(${table.actorId}, 1, 6) = 'staff_' AND substr(${table.actorId}, 7, 1) GLOB '[0-7]' AND substr(${table.actorId}, 7) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*')`,
    ),
    check(
      "audit_events_staff_role_check",
      sql`${table.staffRole} IS NULL OR ${table.staffRole} IN ('owner', 'manager', 'staff')`,
    ),
    check(
      "audit_events_telegram_operator_check",
      sql`${table.actorKind} <> 'telegram_operator' OR (${table.telegramOperatorLabel} = trim(${table.telegramOperatorLabel}) AND length(${table.telegramOperatorLabel}) BETWEEN 1 AND 64 AND ${table.telegramUserId} > 0 AND ${table.telegramUserId} <= 9007199254740991)`,
    ),
    check(
      "audit_events_source_channel_check",
      sql`${table.sourceChannel} IN ('admin', 'storefront', 'provider_callback', 'workflow', 'telegram', 'provisioning')`,
    ),
    check("audit_events_outcome_check", sql`${table.outcome} IN ('accepted', 'rejected')`),
    check(
      "audit_events_correlation_length_check",
      sql`length(${table.commandCorrelationId}) BETWEEN 1 AND 64`,
    ),
    check(
      "audit_events_metadata_check",
      sql`${table.metadataJson} IS NULL OR (json_valid(${table.metadataJson}) AND length(${table.metadataJson}) <= 2048)`,
    ),
    check(
      "audit_events_fact_length_check",
      sql`length(${table.action}) BETWEEN 1 AND 64 AND length(${table.entityKind}) BETWEEN 1 AND 64 AND length(${table.entityId}) BETWEEN 1 AND 128`,
    ),
    index("audit_events_entity_timeline_idx").on(table.entityKind, table.entityId, table.createdAt),
    index("audit_events_actor_timeline_idx").on(table.actorKind, table.actorId, table.createdAt),
  ],
);

export const catalogItems = sqliteTable(
  "catalog_items",
  {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: ["product", "bundle"] }).notNull(),
    slug: text("slug").notNull().unique(),
    state: text("state", { enum: ["draft", "published", "archived"] }).notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    priceMnt: integer("price_mnt").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    check("catalog_items_kind_check", sql`${table.kind} IN ('product', 'bundle')`),
    check("catalog_items_state_check", sql`${table.state} IN ('draft', 'published', 'archived')`),
    check("catalog_items_price_check", sql`${table.priceMnt} > 0`),
    check("catalog_items_name_check", sql`length(trim(${table.name})) BETWEEN 1 AND 120`),
    check("catalog_items_slug_check", sql`length(${table.slug}) BETWEEN 1 AND 100`),
    check(
      "catalog_items_id_kind_check",
      sql`(${table.kind} = 'product' AND length(${table.id}) = 34 AND substr(${table.id}, 1, 8) = 'product_' AND substr(${table.id}, 9, 1) GLOB '[0-7]' AND substr(${table.id}, 9) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*') OR (${table.kind} = 'bundle' AND length(${table.id}) = 33 AND substr(${table.id}, 1, 7) = 'bundle_' AND substr(${table.id}, 8, 1) GLOB '[0-7]' AND substr(${table.id}, 8) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*')`,
    ),
    index("catalog_items_public_idx").on(table.state, table.kind, table.id),
  ],
);

export const catalogCachePurgeDebts = sqliteTable(
  "catalog_cache_purge_debts",
  {
    productId: text("product_id")
      .primaryKey()
      .references(() => catalogItems.id, { onDelete: "restrict" }),
    revision: text("revision").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    requestId: text("request_id"),
    commandCommittedAt: integer("command_committed_at", { mode: "timestamp_ms" }).notNull(),
    lastAttemptedAt: integer("last_attempted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    check("catalog_cache_purge_debts_revision_check", sql`length(${table.revision}) = 36`),
    check(
      "catalog_cache_purge_debts_attempt_check",
      sql`${table.attemptCount} BETWEEN 0 AND 1000000`,
    ),
    check(
      "catalog_cache_purge_debts_request_check",
      sql`${table.requestId} IS NULL OR length(${table.requestId}) BETWEEN 1 AND 128`,
    ),
  ],
);

export const variants = sqliteTable(
  "variants",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => catalogItems.id, { onDelete: "restrict" }),
    isDefault: integer("is_default", { mode: "boolean" }).notNull(),
    state: text("state", { enum: ["active", "archived"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check(
      "variants_id_check",
      sql`length(${table.id}) = 34 AND substr(${table.id}, 1, 8) = 'variant_' AND substr(${table.id}, 9, 1) GLOB '[0-7]' AND substr(${table.id}, 9) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'`,
    ),
    check("variants_default_check", sql`${table.isDefault} IN (0, 1)`),
    check("variants_state_check", sql`${table.state} IN ('active', 'archived')`),
    uniqueIndex("variants_default_product_idx")
      .on(table.productId)
      .where(sql`${table.isDefault} = 1`),
    index("variants_product_state_idx").on(table.productId, table.state),
  ],
);

export const skus = sqliteTable(
  "skus",
  {
    sku: text("sku").notNull().unique(),
    skuCompact: text("sku_compact").primaryKey(),
    ownerKind: text("owner_kind", { enum: ["variant", "bundle"] }).notNull(),
    variantId: text("variant_id")
      .unique()
      .references(() => variants.id, { onDelete: "restrict" }),
    bundleId: text("bundle_id")
      .unique()
      .references(() => catalogItems.id, { onDelete: "restrict" }),
    lockedAt: integer("locked_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check(
      "skus_owner_check",
      sql`(${table.ownerKind} = 'variant' AND ${table.variantId} IS NOT NULL AND ${table.bundleId} IS NULL) OR (${table.ownerKind} = 'bundle' AND ${table.variantId} IS NULL AND ${table.bundleId} IS NOT NULL)`,
    ),
    check("skus_value_check", sql`length(trim(${table.sku})) BETWEEN 1 AND 64`),
    check("skus_compact_check", sql`length(${table.skuCompact}) BETWEEN 1 AND 256`),
  ],
);

export const stockItems = sqliteTable(
  "stock_items",
  {
    id: text("id").primaryKey(),
    variantId: text("variant_id")
      .notNull()
      .unique()
      .references(() => variants.id, { onDelete: "restrict" }),
    onHandQuantity: integer("on_hand_quantity").notNull(),
    reservedQuantity: integer("reserved_quantity").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check(
      "stock_items_id_check",
      sql`length(${table.id}) = 37 AND substr(${table.id}, 1, 11) = 'stock_item_' AND substr(${table.id}, 12, 1) GLOB '[0-7]' AND substr(${table.id}, 12) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'`,
    ),
    check(
      "stock_items_balance_check",
      sql`${table.onHandQuantity} BETWEEN 0 AND 1000000 AND ${table.reservedQuantity} >= 0 AND ${table.reservedQuantity} <= ${table.onHandQuantity}`,
    ),
  ],
);

export const inventoryReservations = sqliteTable(
  "inventory_reservations",
  {
    id: text("id").primaryKey(),
    orderReference: text("order_reference").notNull().unique(),
    state: text("state", { enum: ["active", "consumed", "released", "expired"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    transitionedAt: integer("transitioned_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    check(
      "inventory_reservations_id_check",
      sql`length(${table.id}) = 38 AND substr(${table.id}, 1, 12) = 'reservation_' AND substr(${table.id}, 13, 1) GLOB '[0-7]' AND substr(${table.id}, 13) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'`,
    ),
    check(
      "inventory_reservations_state_check",
      sql`${table.state} IN ('active', 'consumed', 'released', 'expired')`,
    ),
    index("inventory_reservations_state_idx").on(table.state, table.createdAt),
  ],
);

export const inventoryReservationItems = sqliteTable(
  "inventory_reservation_items",
  {
    reservationId: text("reservation_id")
      .notNull()
      .references(() => inventoryReservations.id, { onDelete: "restrict" }),
    stockItemId: text("stock_item_id")
      .notNull()
      .references(() => stockItems.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.reservationId, table.stockItemId] }),
    check("inventory_reservation_items_quantity_check", sql`${table.quantity} > 0`),
    index("inventory_reservation_items_stock_idx").on(table.stockItemId),
  ],
);

export const inventoryEntries = sqliteTable(
  "inventory_entries",
  {
    id: text("id").primaryKey(),
    stockItemId: text("stock_item_id")
      .notNull()
      .references(() => stockItems.id, { onDelete: "restrict" }),
    kind: text("kind", { enum: ["opening", "adjustment"] }).notNull(),
    onHandDelta: integer("on_hand_delta").notNull(),
    actorKind: text("actor_kind", { enum: ["staff"] }).notNull(),
    staffId: text("staff_id").notNull(),
    staffRole: text("staff_role", { enum: ["owner", "manager", "staff"] }).notNull(),
    reason: text("reason").notNull(),
    commandCorrelationId: text("command_correlation_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check(
      "inventory_entries_id_check",
      sql`length(${table.id}) = 42 AND substr(${table.id}, 1, 16) = 'inventory_entry_' AND substr(${table.id}, 17, 1) GLOB '[0-7]' AND substr(${table.id}, 17) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'`,
    ),
    check("inventory_entries_kind_check", sql`${table.kind} IN ('opening', 'adjustment')`),
    check(
      "inventory_entries_actor_check",
      sql`${table.actorKind} = 'staff' AND ${table.staffRole} IN ('owner', 'manager', 'staff')`,
    ),
    check("inventory_entries_reason_check", sql`length(trim(${table.reason})) BETWEEN 1 AND 240`),
    uniqueIndex("inventory_entries_correlation_stock_idx").on(
      table.commandCorrelationId,
      table.stockItemId,
    ),
    index("inventory_entries_stock_timeline_idx").on(table.stockItemId, table.createdAt, table.id),
  ],
);

export const systemMetadata = sqliteTable("system_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
