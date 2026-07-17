import {
  createAuditEventId,
  createStaffId,
  StaffIdSchema,
  StaffMemberSchema,
  StaffRoleSchema,
  StaffStatusSchema,
  type StaffId,
  type StaffMember,
  type StaffRole,
  type StaffStatus,
} from "@ecom/contracts";
import * as v from "valibot";
import { and, asc, count, eq, getTableName, isNull, or } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { staff_auth_users } from "../auth/staff.generated";
import { database } from "../db/database";
import { auditEvents, staffMembers, staffSessionCleanupDebts } from "../db/schema";

export type StaffRecord = StaffMember & {
  readonly authUserId: string | null;
  readonly sessionGeneration: number;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const projectStaff = (row: {
  id: string;
  normalizedEmail: string;
  authUserId: string | null;
  status: StaffStatus;
  role: StaffRole | null;
  sessionGeneration: number;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  revokedAt: Date | null;
}): StaffRecord => ({
  ...v.parse(StaffMemberSchema, {
    id: row.id,
    email: row.normalizedEmail,
    status: row.status,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  }),
  authUserId: row.authUserId,
  sessionGeneration: row.sessionGeneration,
});

const ReturnedStaffRowSchema = v.strictObject({
  id: v.string(),
  normalizedEmail: v.string(),
  authUserId: v.nullable(v.string()),
  status: StaffStatusSchema,
  role: v.nullable(StaffRoleSchema),
  sessionGeneration: v.pipe(v.number(), v.integer(), v.minValue(0)),
  createdAt: v.number(),
  updatedAt: v.number(),
  approvedAt: v.nullable(v.number()),
  revokedAt: v.nullable(v.number()),
});

const projectReturnedStaff = (source: unknown) => {
  const row = v.parse(ReturnedStaffRowSchema, source);
  return projectStaff({
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    approvedAt: row.approvedAt === null ? null : new Date(row.approvedAt),
    revokedAt: row.revokedAt === null ? null : new Date(row.revokedAt),
  });
};

const selection = {
  id: staffMembers.id,
  normalizedEmail: staffMembers.normalizedEmail,
  authUserId: staffMembers.authUserId,
  status: staffMembers.status,
  role: staffMembers.role,
  sessionGeneration: staffMembers.sessionGeneration,
  createdAt: staffMembers.createdAt,
  updatedAt: staffMembers.updatedAt,
  approvedAt: staffMembers.approvedAt,
  revokedAt: staffMembers.revokedAt,
};

const findById = async (id: StaffId) => {
  const rows = await database()
    .select(selection)
    .from(staffMembers)
    .where(eq(staffMembers.id, id))
    .limit(1);
  const row = rows.at(0);
  return row ? projectStaff(row) : undefined;
};

const attemptDatabase = async <T>(query: PromiseLike<T>) => {
  try {
    return { success: true as const, value: await query };
  } catch {
    return { success: false as const };
  }
};

const findByAuthUserId = async (authUserId: string) => {
  const attempt = await attemptDatabase(
    database()
      .select(selection)
      .from(staffMembers)
      .where(eq(staffMembers.authUserId, authUserId))
      .limit(1),
  );
  if (!attempt.success) {
    return attempt;
  }
  const row = attempt.value.at(0);
  return { success: true as const, value: row ? projectStaff(row) : undefined };
};

const findByNormalizedEmail = async (normalizedEmail: string) => {
  const attempt = await attemptDatabase(
    database()
      .select(selection)
      .from(staffMembers)
      .where(eq(staffMembers.normalizedEmail, normalizedEmail))
      .limit(1),
  );
  if (!attempt.success) {
    return attempt;
  }
  const row = attempt.value.at(0);
  return { success: true as const, value: row ? projectStaff(row) : undefined };
};

const resolveApplicant = async (authUserId: string, email: string) => {
  const normalizedEmail = normalizeEmail(email);
  const linkedAttempt = await findByAuthUserId(authUserId);
  if (!linkedAttempt.success) {
    return { kind: "infrastructure_unavailable" } as const;
  }
  const linked = linkedAttempt.value;
  if (linked) {
    return linked.email === normalizedEmail
      ? ({ kind: "resolved", member: linked } as const)
      : ({ kind: "identity_conflict" } as const);
  }

  const now = new Date();
  const insertAttempt = await attemptDatabase(
    database()
      .insert(staffMembers)
      .values({
        id: createStaffId(),
        normalizedEmail,
        authUserId,
        status: "pending",
        role: null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing(),
  );
  if (!insertAttempt.success) {
    return { kind: "infrastructure_unavailable" } as const;
  }
  const updateAttempt = await attemptDatabase(
    database()
      .update(staffMembers)
      .set({ authUserId, updatedAt: now })
      .where(
        and(
          eq(staffMembers.normalizedEmail, normalizedEmail),
          or(isNull(staffMembers.authUserId), eq(staffMembers.authUserId, authUserId)),
        ),
      ),
  );
  if (!updateAttempt.success) {
    return { kind: "infrastructure_unavailable" } as const;
  }

  const resolvedAttempt = await findByAuthUserId(authUserId);
  if (!resolvedAttempt.success) {
    return { kind: "infrastructure_unavailable" } as const;
  }
  const resolved = resolvedAttempt.value;
  if (resolved) {
    return resolved.email === normalizedEmail
      ? ({ kind: "resolved", member: resolved } as const)
      : ({ kind: "identity_conflict" } as const);
  }
  const emailOwnerAttempt = await findByNormalizedEmail(normalizedEmail);
  if (!emailOwnerAttempt.success) {
    return { kind: "infrastructure_unavailable" } as const;
  }
  if (emailOwnerAttempt.value) {
    return { kind: "identity_conflict" } as const;
  }
  throw new Error("Applicant resolution did not produce a Staff record");
};

export type StaffCommandContext = {
  readonly actor: { readonly staffId: StaffId; readonly role: StaffRole };
  readonly correlationId: string;
};

export type StaffCleanupDebt = {
  readonly authUserId: string;
  readonly staffId: StaffId;
  readonly sessionGeneration: number;
};

const returnedSelectionSql =
  "id, normalized_email AS normalizedEmail, auth_user_id AS authUserId, status, role, session_generation AS sessionGeneration, created_at AS createdAt, updated_at AS updatedAt, approved_at AS approvedAt, revoked_at AS revokedAt";

const auditEventsTableName = getTableName(auditEvents);
const actingOwnerPredicate =
  "EXISTS (SELECT 1 FROM staff_members AS acting_staff WHERE acting_staff.id = ? AND acting_staff.status = 'active' AND acting_staff.role = 'owner')";

const auditSelect = (
  context: StaffCommandContext,
  action: string,
  id: StaffId,
  now: number,
  metadataSql: string,
  metadataBindings: readonly (string | number)[],
  predicateSql: string,
  predicateBindings: readonly (string | number)[],
) =>
  env.DB.prepare(
    `INSERT INTO ${auditEventsTableName} (id, actor_kind, actor_id, staff_role, source_channel, action, outcome, entity_kind, entity_id, reason, command_correlation_id, metadata_json, created_at) SELECT ?, 'staff', ?, ?, 'admin', ?, 'accepted', 'staff_member', ?, NULL, ?, ${metadataSql}, ? FROM staff_members WHERE (${predicateSql}) AND ${actingOwnerPredicate}`,
  ).bind(
    createAuditEventId(),
    context.actor.staffId,
    context.actor.role,
    action,
    id,
    context.correlationId,
    ...metadataBindings,
    now,
    ...predicateBindings,
    context.actor.staffId,
  );

const cleanupDebtSelect = (
  context: StaffCommandContext,
  operation: "approve" | "role_change" | "revoke" | "remove",
  now: number,
  predicateSql: string,
  predicateBindings: readonly (string | number)[],
) =>
  env.DB.prepare(
    `INSERT INTO staff_session_cleanup_debts (auth_user_id, staff_id, session_generation, operation, created_at, updated_at) SELECT auth_user_id, id, session_generation + 1, ?, ?, ? FROM staff_members WHERE auth_user_id IS NOT NULL AND (${predicateSql}) AND ${actingOwnerPredicate} ON CONFLICT(auth_user_id) DO UPDATE SET staff_id = excluded.staff_id, session_generation = excluded.session_generation, operation = excluded.operation, updated_at = excluded.updated_at`,
  ).bind(operation, now, now, ...predicateBindings, context.actor.staffId);

const staffIdPredicate = "id = ?";
const pendingPredicate = `${staffIdPredicate} AND status = 'pending'`;
const activeRoleChangePredicate = `${staffIdPredicate} AND status = 'active' AND role <> ? AND NOT (role = 'owner' AND ? <> 'owner' AND (SELECT COUNT(*) FROM staff_members WHERE status = 'active' AND role = 'owner') = 1)`;
const activeRevokePredicate = `${staffIdPredicate} AND status = 'active' AND NOT (role = 'owner' AND (SELECT COUNT(*) FROM staff_members WHERE status = 'active' AND role = 'owner') = 1)`;
const removablePredicate = `${staffIdPredicate} AND NOT (status = 'active' AND role = 'owner' AND (SELECT COUNT(*) FROM staff_members WHERE status = 'active' AND role = 'owner') = 1)`;

export const staffQueries = {
  findById,
  resolveApplicant,

  async createActive(context: StaffCommandContext, email: string, role: StaffRole) {
    const id = createStaffId();
    const normalizedEmail = normalizeEmail(email);
    const now = Date.now();
    const results = await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO staff_members (id, normalized_email, auth_user_id, status, role, session_generation, created_at, updated_at, approved_at, revoked_at) SELECT ?, ?, NULL, 'active', ?, 0, ?, ?, ?, NULL WHERE ${actingOwnerPredicate} ON CONFLICT(normalized_email) DO NOTHING RETURNING ${returnedSelectionSql}`,
      ).bind(id, normalizedEmail, role, now, now, now, context.actor.staffId),
      auditSelect(
        context,
        "staff.create",
        id,
        now,
        `json_object('before', NULL, 'after', json_object('status', status, 'role', role))`,
        [],
        staffIdPredicate,
        [id],
      ),
    ]);
    const row = results.at(0)?.results.at(0);
    return row ? projectReturnedStaff(row) : undefined;
  },

  async resolveAuthUserApplicant(authUserId: string) {
    const attempt = await attemptDatabase(
      database()
        .select({ email: staff_auth_users.email, emailVerified: staff_auth_users.emailVerified })
        .from(staff_auth_users)
        .where(eq(staff_auth_users.id, authUserId))
        .limit(1),
    );
    if (!attempt.success) {
      return { kind: "infrastructure_unavailable" } as const;
    }
    const user = attempt.value.at(0);
    return user?.emailVerified
      ? resolveApplicant(authUserId, user.email)
      : ({ kind: "unverified" } as const);
  },

  async list() {
    const rows = await database()
      .select(selection)
      .from(staffMembers)
      .orderBy(asc(staffMembers.createdAt));
    return rows.map(projectStaff);
  },

  async countCleanupDebts() {
    const rows = await database().select({ value: count() }).from(staffSessionCleanupDebts);
    return rows.at(0)?.value ?? 0;
  },

  async listCleanupDebts(limit: number): Promise<readonly StaffCleanupDebt[]> {
    const rows = await database()
      .select({
        authUserId: staffSessionCleanupDebts.authUserId,
        staffId: staffSessionCleanupDebts.staffId,
        sessionGeneration: staffSessionCleanupDebts.sessionGeneration,
      })
      .from(staffSessionCleanupDebts)
      .orderBy(asc(staffSessionCleanupDebts.createdAt))
      .limit(limit);
    return rows.map((row) => ({
      authUserId: row.authUserId,
      staffId: v.parse(StaffIdSchema, row.staffId),
      sessionGeneration: row.sessionGeneration,
    }));
  },

  async clearCleanupDebt(authUserId: string, sessionGeneration: number) {
    const result = await env.DB.prepare(
      "DELETE FROM staff_session_cleanup_debts WHERE auth_user_id = ? AND session_generation = ? RETURNING auth_user_id",
    )
      .bind(authUserId, sessionGeneration)
      .all();
    if (result.results.length === 1) {
      return true;
    }
    const current = await database()
      .select({ sessionGeneration: staffSessionCleanupDebts.sessionGeneration })
      .from(staffSessionCleanupDebts)
      .where(eq(staffSessionCleanupDebts.authUserId, authUserId))
      .limit(1);
    return current.length === 0;
  },

  async readCurrentSessionAuthority(authUserId: string, email: string, generation: number) {
    const rows = await database()
      .select({
        id: staffMembers.id,
        normalizedEmail: staffMembers.normalizedEmail,
        sessionGeneration: staffMembers.sessionGeneration,
      })
      .from(staffMembers)
      .where(eq(staffMembers.authUserId, authUserId))
      .limit(1);
    const member = rows.at(0);
    if (member && member.normalizedEmail !== normalizeEmail(email)) {
      return { kind: "identity_conflict" } as const;
    }
    return member?.sessionGeneration === generation
      ? { kind: "current" as const, staffId: v.parse(StaffIdSchema, member.id) }
      : { kind: "stale" as const };
  },

  async approve(context: StaffCommandContext, id: StaffId, role: StaffRole) {
    const now = Date.now();
    const predicateBindings = [id] as const;
    const results = await env.DB.batch([
      auditSelect(
        context,
        "staff.approve",
        id,
        now,
        `json_object('before', json_object('status', status, 'role', role), 'after', json_object('status', 'active', 'role', ?))`,
        [role],
        pendingPredicate,
        predicateBindings,
      ),
      cleanupDebtSelect(context, "approve", now, pendingPredicate, predicateBindings),
      env.DB.prepare(
        `UPDATE staff_members SET status = 'active', role = ?, session_generation = session_generation + 1, approved_at = ?, revoked_at = NULL, updated_at = ? WHERE (${pendingPredicate}) AND ${actingOwnerPredicate} RETURNING ${returnedSelectionSql}`,
      ).bind(role, now, now, ...predicateBindings, context.actor.staffId),
    ]);
    const changed = results.at(2)?.results.at(0);
    return changed
      ? { changed: projectReturnedStaff(changed), current: undefined }
      : { changed: undefined, current: await findById(id) };
  },

  async changeRole(context: StaffCommandContext, id: StaffId, role: StaffRole) {
    const now = Date.now();
    const predicateBindings = [id, role, role] as const;
    const results = await env.DB.batch([
      auditSelect(
        context,
        "staff.role_change",
        id,
        now,
        `json_object('before', json_object('status', status, 'role', role), 'after', json_object('status', status, 'role', ?))`,
        [role],
        activeRoleChangePredicate,
        predicateBindings,
      ),
      cleanupDebtSelect(context, "role_change", now, activeRoleChangePredicate, predicateBindings),
      env.DB.prepare(
        `UPDATE staff_members SET role = ?, session_generation = session_generation + 1, updated_at = ? WHERE (${activeRoleChangePredicate}) AND ${actingOwnerPredicate} RETURNING ${returnedSelectionSql}`,
      ).bind(role, now, ...predicateBindings, context.actor.staffId),
    ]);
    const changed = results.at(2)?.results.at(0);
    return changed
      ? { changed: projectReturnedStaff(changed), current: undefined }
      : { changed: undefined, current: await findById(id) };
  },

  async revoke(context: StaffCommandContext, id: StaffId) {
    const now = Date.now();
    const predicateBindings = [id] as const;
    const results = await env.DB.batch([
      auditSelect(
        context,
        "staff.revoke",
        id,
        now,
        `json_object('before', json_object('status', status, 'role', role), 'after', json_object('status', 'revoked', 'role', role))`,
        [],
        activeRevokePredicate,
        predicateBindings,
      ),
      cleanupDebtSelect(context, "revoke", now, activeRevokePredicate, predicateBindings),
      env.DB.prepare(
        `UPDATE staff_members SET status = 'revoked', session_generation = session_generation + 1, revoked_at = ?, updated_at = ? WHERE (${activeRevokePredicate}) AND ${actingOwnerPredicate} RETURNING ${returnedSelectionSql}`,
      ).bind(now, now, ...predicateBindings, context.actor.staffId),
    ]);
    const changed = results.at(2)?.results.at(0);
    return changed
      ? { changed: projectReturnedStaff(changed), current: undefined }
      : { changed: undefined, current: await findById(id) };
  },

  async remove(context: StaffCommandContext, id: StaffId) {
    const now = Date.now();
    const predicateBindings = [id] as const;
    const results = await env.DB.batch([
      auditSelect(
        context,
        "staff.remove",
        id,
        now,
        `json_object('before', json_object('status', status, 'role', role), 'after', NULL)`,
        [],
        removablePredicate,
        predicateBindings,
      ),
      cleanupDebtSelect(context, "remove", now, removablePredicate, predicateBindings),
      env.DB.prepare(
        `DELETE FROM staff_members WHERE (${removablePredicate}) AND ${actingOwnerPredicate} RETURNING ${returnedSelectionSql}`,
      ).bind(...predicateBindings, context.actor.staffId),
    ]);
    const removed = results.at(2)?.results.at(0);
    const projected = removed ? projectReturnedStaff(removed) : undefined;
    return projected
      ? {
          removed: projected,
          cleanupGeneration: projected.sessionGeneration + 1,
          current: undefined,
        }
      : { removed: undefined, cleanupGeneration: undefined, current: await findById(id) };
  },
};
