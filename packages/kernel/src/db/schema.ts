import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
    sessionGeneration: integer("session_generation").notNull().default(0),
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

export const staffSessionCleanupDebts = sqliteTable(
  "staff_session_cleanup_debts",
  {
    authUserId: text("auth_user_id").primaryKey(),
    staffId: text("staff_id").notNull(),
    sessionGeneration: integer("session_generation").notNull(),
    operation: text("operation", {
      enum: ["approve", "role_change", "revoke", "remove", "provision"],
    }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check(
      "staff_session_cleanup_debts_staff_id_check",
      sql`length(${table.staffId}) = 32 AND substr(${table.staffId}, 1, 6) = 'staff_' AND substr(${table.staffId}, 7, 1) GLOB '[0-7]' AND substr(${table.staffId}, 7) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'`,
    ),
    check("staff_session_cleanup_debts_generation_check", sql`${table.sessionGeneration} >= 0`),
    check(
      "staff_session_cleanup_debts_operation_check",
      sql`${table.operation} IN ('approve', 'role_change', 'revoke', 'remove', 'provision')`,
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

export const systemMetadata = sqliteTable("system_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
