import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
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

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    parentId: text("parent_id").references((): AnySQLiteColumn => categories.id, {
      onDelete: "restrict",
    }),
    position: integer("position").notNull(),
    state: text("state", { enum: ["draft", "active", "archived"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    activatedAt: integer("activated_at", { mode: "timestamp_ms" }),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    check(
      "categories_id_check",
      sql`length(${table.id}) = 35 AND substr(${table.id}, 1, 9) = 'category_' AND substr(${table.id}, 10, 1) GLOB '[0-7]' AND substr(${table.id}, 10) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'`,
    ),
    check("categories_slug_check", sql`length(${table.slug}) BETWEEN 1 AND 100`),
    check("categories_name_check", sql`length(trim(${table.name})) BETWEEN 1 AND 120`),
    check("categories_position_check", sql`${table.position} BETWEEN 0 AND 10000`),
    check("categories_state_check", sql`${table.state} IN ('draft', 'active', 'archived')`),
    check(
      "categories_parent_check",
      sql`${table.parentId} IS NULL OR ${table.parentId} <> ${table.id}`,
    ),
    index("categories_parent_state_position_idx").on(
      table.parentId,
      table.state,
      table.position,
      table.id,
    ),
  ],
);

export const collections = sqliteTable(
  "collections",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    state: text("state", { enum: ["draft", "active", "archived"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    activatedAt: integer("activated_at", { mode: "timestamp_ms" }),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    check(
      "collections_id_check",
      sql`length(${table.id}) = 37 AND substr(${table.id}, 1, 11) = 'collection_' AND substr(${table.id}, 12, 1) GLOB '[0-7]' AND substr(${table.id}, 12) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'`,
    ),
    check("collections_slug_check", sql`length(${table.slug}) BETWEEN 1 AND 100`),
    check("collections_name_check", sql`length(trim(${table.name})) BETWEEN 1 AND 120`),
    check("collections_description_check", sql`length(${table.description}) <= 5000`),
    check("collections_state_check", sql`${table.state} IN ('draft', 'active', 'archived')`),
    index("collections_state_name_idx").on(table.state, table.name, table.id),
  ],
);

export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    normalizedLabel: text("normalized_label").notNull().unique(),
    state: text("state", { enum: ["draft", "active", "archived"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    activatedAt: integer("activated_at", { mode: "timestamp_ms" }),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    check(
      "tags_id_check",
      sql`length(${table.id}) = 30 AND substr(${table.id}, 1, 4) = 'tag_' AND substr(${table.id}, 5, 1) GLOB '[0-7]' AND substr(${table.id}, 5) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'`,
    ),
    check("tags_label_check", sql`length(trim(${table.label})) BETWEEN 1 AND 80`),
    check(
      "tags_normalized_label_check",
      sql`${table.normalizedLabel} = trim(${table.normalizedLabel}) AND length(${table.normalizedLabel}) BETWEEN 1 AND 80`,
    ),
    check("tags_state_check", sql`${table.state} IN ('draft', 'active', 'archived')`),
    index("tags_state_label_idx").on(table.state, table.normalizedLabel, table.id),
  ],
);

export const catalogItemCategories = sqliteTable(
  "catalog_item_categories",
  {
    catalogItemId: text("catalog_item_id")
      .notNull()
      .references(() => catalogItems.id, { onDelete: "restrict" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.catalogItemId, table.categoryId] }),
    index("catalog_item_categories_category_idx").on(table.categoryId, table.catalogItemId),
  ],
);

export const catalogItemCollections = sqliteTable(
  "catalog_item_collections",
  {
    catalogItemId: text("catalog_item_id")
      .notNull()
      .references(() => catalogItems.id, { onDelete: "restrict" }),
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.catalogItemId, table.collectionId] }),
    uniqueIndex("catalog_item_collections_position_idx").on(table.collectionId, table.position),
    check("catalog_item_collections_position_check", sql`${table.position} BETWEEN 0 AND 10000`),
  ],
);

export const catalogItemTags = sqliteTable(
  "catalog_item_tags",
  {
    catalogItemId: text("catalog_item_id")
      .notNull()
      .references(() => catalogItems.id, { onDelete: "restrict" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.catalogItemId, table.tagId] }),
    index("catalog_item_tags_tag_idx").on(table.tagId, table.catalogItemId),
  ],
);

export const mediaAssets = sqliteTable(
  "media_assets",
  {
    id: text("id").primaryKey(),
    objectKey: text("object_key").notNull().unique(),
    declaredContentType: text("declared_content_type", {
      enum: ["image/jpeg", "image/png", "image/webp"],
    }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check(
      "media_assets_id_check",
      sql`length(${table.id}) = 32 AND substr(${table.id}, 1, 6) = 'media_' AND substr(${table.id}, 7, 1) GLOB '[0-7]' AND substr(${table.id}, 7) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'`,
    ),
    check(
      "media_assets_content_type_check",
      sql`${table.declaredContentType} IN ('image/jpeg', 'image/png', 'image/webp')`,
    ),
  ],
);

export const catalogItemImages = sqliteTable(
  "catalog_item_images",
  {
    catalogItemId: text("catalog_item_id")
      .notNull()
      .references(() => catalogItems.id, { onDelete: "cascade" }),
    mediaAssetId: text("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    altText: text("alt_text").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.catalogItemId, table.position] }),
    uniqueIndex("catalog_item_images_asset_idx").on(table.catalogItemId, table.mediaAssetId),
    index("catalog_item_images_media_idx").on(table.mediaAssetId),
    check("catalog_item_images_position_check", sql`${table.position} BETWEEN 0 AND 7`),
    check(
      "catalog_item_images_alt_text_check",
      sql`${table.altText} = trim(${table.altText}) AND length(${table.altText}) BETWEEN 1 AND 240`,
    ),
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

export const catalogListingCachePurgeDebt = sqliteTable(
  "catalog_listing_cache_purge_debt",
  {
    key: text("key").primaryKey(),
    revision: text("revision").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    requestId: text("request_id"),
    commandCommittedAt: integer("command_committed_at", { mode: "timestamp_ms" }).notNull(),
    lastAttemptedAt: integer("last_attempted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    check("catalog_listing_cache_purge_debt_key_check", sql`${table.key} = 'catalog'`),
    check("catalog_listing_cache_purge_debt_revision_check", sql`length(${table.revision}) = 36`),
    check(
      "catalog_listing_cache_purge_debt_attempt_check",
      sql`${table.attemptCount} BETWEEN 0 AND 1000000`,
    ),
    check(
      "catalog_listing_cache_purge_debt_request_check",
      sql`${table.requestId} IS NULL OR length(${table.requestId}) BETWEEN 1 AND 128`,
    ),
  ],
);

export const optionGroups = sqliteTable(
  "option_groups",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => catalogItems.id, { onDelete: "restrict" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    position: integer("position").notNull(),
    state: text("state", { enum: ["active", "archived"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check(
      "option_groups_id_check",
      sql`length(${table.id}) = 39 AND substr(${table.id}, 1, 13) = 'option_group_' AND substr(${table.id}, 14, 1) GLOB '[0-7]' AND substr(${table.id}, 14) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'`,
    ),
    check("option_groups_key_check", sql`length(${table.key}) BETWEEN 1 AND 48`),
    check("option_groups_label_check", sql`length(trim(${table.label})) BETWEEN 1 AND 80`),
    check("option_groups_position_check", sql`${table.position} BETWEEN 0 AND 99`),
    check("option_groups_state_check", sql`${table.state} IN ('active', 'archived')`),
    uniqueIndex("option_groups_product_key_idx")
      .on(table.productId, table.key)
      .where(sql`${table.state} = 'active'`),
    uniqueIndex("option_groups_product_position_idx")
      .on(table.productId, table.position)
      .where(sql`${table.state} = 'active'`),
  ],
);

export const optionValues = sqliteTable(
  "option_values",
  {
    id: text("id").primaryKey(),
    optionGroupId: text("option_group_id")
      .notNull()
      .references(() => optionGroups.id, { onDelete: "restrict" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    position: integer("position").notNull(),
    state: text("state", { enum: ["active", "archived"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check(
      "option_values_id_check",
      sql`length(${table.id}) = 39 AND substr(${table.id}, 1, 13) = 'option_value_' AND substr(${table.id}, 14, 1) GLOB '[0-7]' AND substr(${table.id}, 14) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'`,
    ),
    check("option_values_key_check", sql`length(${table.key}) BETWEEN 1 AND 48`),
    check("option_values_label_check", sql`length(trim(${table.label})) BETWEEN 1 AND 80`),
    check("option_values_position_check", sql`${table.position} BETWEEN 0 AND 99`),
    check("option_values_state_check", sql`${table.state} IN ('active', 'archived')`),
    uniqueIndex("option_values_group_key_idx")
      .on(table.optionGroupId, table.key)
      .where(sql`${table.state} = 'active'`),
    uniqueIndex("option_values_group_position_idx")
      .on(table.optionGroupId, table.position)
      .where(sql`${table.state} = 'active'`),
    index("option_values_group_state_idx").on(table.optionGroupId, table.state),
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
    combinationKey: text("combination_key").notNull(),
    priceOverrideMnt: integer("price_override_mnt"),
    imageMediaAssetId: text("image_media_asset_id").references(() => mediaAssets.id, {
      onDelete: "restrict",
    }),
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
    check("variants_combination_check", sql`length(${table.combinationKey}) BETWEEN 1 AND 512`),
    check(
      "variants_price_override_check",
      sql`${table.priceOverrideMnt} IS NULL OR ${table.priceOverrideMnt} > 0`,
    ),
    check("variants_state_check", sql`${table.state} IN ('active', 'archived')`),
    uniqueIndex("variants_default_product_idx")
      .on(table.productId)
      .where(sql`${table.isDefault} = 1`),
    uniqueIndex("variants_product_combination_idx").on(table.productId, table.combinationKey),
    index("variants_product_state_idx").on(table.productId, table.state),
    index("variants_image_media_idx").on(table.imageMediaAssetId),
  ],
);

export const bundleComponents = sqliteTable(
  "bundle_components",
  {
    bundleId: text("bundle_id")
      .notNull()
      .references(() => catalogItems.id, { onDelete: "cascade" }),
    variantId: text("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.bundleId, table.variantId] }),
    check("bundle_components_quantity_check", sql`${table.quantity} BETWEEN 1 AND 999`),
    index("bundle_components_variant_idx").on(table.variantId, table.bundleId),
  ],
);

export const personalizationDefinitions = sqliteTable(
  "personalization_definitions",
  {
    id: text("id").primaryKey(),
    catalogItemId: text("catalog_item_id")
      .notNull()
      .references(() => catalogItems.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["text", "single_select", "checkbox"] }).notNull(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    position: integer("position").notNull(),
    required: integer("required", { mode: "boolean" }).notNull(),
    state: text("state", { enum: ["active", "archived"] }).notNull(),
    maxLength: integer("max_length"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check(
      "personalization_definitions_id_check",
      sql`length(${table.id}) = 42 AND substr(${table.id}, 1, 16) = 'personalization_' AND substr(${table.id}, 17, 1) GLOB '[0-7]' AND substr(${table.id}, 17) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'`,
    ),
    check(
      "personalization_definitions_kind_check",
      sql`${table.kind} IN ('text', 'single_select', 'checkbox')`,
    ),
    check("personalization_definitions_key_check", sql`length(${table.key}) BETWEEN 1 AND 48`),
    check(
      "personalization_definitions_label_check",
      sql`length(trim(${table.label})) BETWEEN 1 AND 80`,
    ),
    check("personalization_definitions_position_check", sql`${table.position} BETWEEN 0 AND 11`),
    check("personalization_definitions_required_check", sql`${table.required} IN (0, 1)`),
    check("personalization_definitions_state_check", sql`${table.state} IN ('active', 'archived')`),
    check(
      "personalization_definitions_max_length_check",
      sql`(${table.kind} = 'text' AND ${table.maxLength} BETWEEN 1 AND 240) OR (${table.kind} <> 'text' AND ${table.maxLength} IS NULL)`,
    ),
    uniqueIndex("personalization_definitions_item_key_idx").on(table.catalogItemId, table.key),
    uniqueIndex("personalization_definitions_item_position_idx").on(
      table.catalogItemId,
      table.position,
    ),
  ],
);

export const personalizationValues = sqliteTable(
  "personalization_values",
  {
    id: text("id").primaryKey(),
    personalizationId: text("personalization_id")
      .notNull()
      .references(() => personalizationDefinitions.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    position: integer("position").notNull(),
    state: text("state", { enum: ["active", "archived"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check(
      "personalization_values_id_check",
      sql`length(${table.id}) = 48 AND substr(${table.id}, 1, 22) = 'personalization_value_' AND substr(${table.id}, 23, 1) GLOB '[0-7]' AND substr(${table.id}, 23) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'`,
    ),
    check("personalization_values_key_check", sql`length(${table.key}) BETWEEN 1 AND 48`),
    check("personalization_values_label_check", sql`length(trim(${table.label})) BETWEEN 1 AND 80`),
    check("personalization_values_position_check", sql`${table.position} BETWEEN 0 AND 11`),
    check("personalization_values_state_check", sql`${table.state} IN ('active', 'archived')`),
    uniqueIndex("personalization_values_definition_key_idx").on(table.personalizationId, table.key),
    uniqueIndex("personalization_values_definition_position_idx").on(
      table.personalizationId,
      table.position,
    ),
  ],
);

export const variantOptionValues = sqliteTable(
  "variant_option_values",
  {
    variantId: text("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "restrict" }),
    optionValueId: text("option_value_id")
      .notNull()
      .references(() => optionValues.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.variantId, table.optionValueId] }),
    index("variant_option_values_value_idx").on(table.optionValueId, table.variantId),
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
