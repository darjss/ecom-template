import {
  createAuditEventId,
  createStaffId,
  StaffIdSchema,
  StaffMemberSchema,
  type StaffId,
  type StaffMember,
  type StaffRole,
  type StaffStatus,
} from "@ecom/contracts";
import * as v from "valibot";
import { and, asc, count, eq, exists, isNotNull, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
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

const StaffCleanupOperationSchema = v.picklist([
  "approve",
  "role_change",
  "revoke",
  "remove",
  "provision",
]);

export type StaffCleanupOperation = v.InferOutput<typeof StaffCleanupOperationSchema>;

export type StaffCleanupDebt = {
  readonly authUserId: string;
  readonly staffId: StaffId;
  readonly sessionGeneration: number;
  readonly operation: StaffCleanupOperation;
};

const actingStaff = alias(staffMembers, "acting_staff");
const otherOwner = alias(staffMembers, "other_owner");

const actingOwner = (staffId: StaffId) =>
  exists(
    database()
      .select({ id: actingStaff.id })
      .from(actingStaff)
      .where(
        and(
          eq(actingStaff.id, staffId),
          eq(actingStaff.status, "active"),
          eq(actingStaff.role, "owner"),
        ),
      ),
  );

const anotherActiveOwner = (staffId: StaffId) =>
  exists(
    database()
      .select({ id: otherOwner.id })
      .from(otherOwner)
      .where(
        and(
          ne(otherOwner.id, staffId),
          eq(otherOwner.status, "active"),
          eq(otherOwner.role, "owner"),
        ),
      ),
  );

const insertAudit = (
  context: StaffCommandContext,
  action: string,
  id: StaffId,
  now: number,
  metadataJson: SQL<string>,
  predicate: SQL | undefined,
) =>
  database()
    .insert(auditEvents)
    .select(
      database()
        .select({
          id: sql<string>`${createAuditEventId()}`.as("id"),
          actorKind: sql<"staff">`${"staff"}`.as("actor_kind"),
          actorId: sql<string>`${context.actor.staffId}`.as("actor_id"),
          staffRole: sql<StaffRole>`${context.actor.role}`.as("staff_role"),
          telegramOperatorLabel: sql<null>`null`.as("telegram_operator_label"),
          telegramUserId: sql<null>`null`.as("telegram_user_id"),
          sourceChannel: sql<"admin">`${"admin"}`.as("source_channel"),
          action: sql<string>`${action}`.as("action"),
          outcome: sql<"accepted">`${"accepted"}`.as("outcome"),
          entityKind: sql<string>`${"staff_member"}`.as("entity_kind"),
          entityId: sql<string>`${id}`.as("entity_id"),
          reason: sql<null>`null`.as("reason"),
          commandCorrelationId: sql<string>`${context.correlationId}`.as("command_correlation_id"),
          metadataJson: metadataJson.as("metadata_json"),
          createdAt: sql<Date>`${now}`.as("created_at"),
        })
        .from(staffMembers)
        .where(and(predicate, actingOwner(context.actor.staffId))),
    );

const insertCleanupDebt = (
  context: StaffCommandContext,
  operation: "approve" | "role_change" | "revoke" | "remove",
  now: number,
  predicate: SQL | undefined,
) =>
  database()
    .insert(staffSessionCleanupDebts)
    .select(
      database()
        .select({
          authUserId: staffMembers.authUserId,
          staffId: staffMembers.id,
          sessionGeneration: sql<number>`${staffMembers.sessionGeneration} + 1`.as(
            "session_generation",
          ),
          operation: sql<typeof operation>`${operation}`.as("operation"),
          createdAt: sql<Date>`${now}`.as("created_at"),
          updatedAt: sql<Date>`${now}`.as("updated_at"),
        })
        .from(staffMembers)
        .where(
          and(isNotNull(staffMembers.authUserId), predicate, actingOwner(context.actor.staffId)),
        ),
    )
    .onConflictDoUpdate({
      target: staffSessionCleanupDebts.authUserId,
      set: {
        staffId: sql`excluded.staff_id`,
        sessionGeneration: sql`excluded.session_generation`,
        operation: sql`excluded.operation`,
        updatedAt: new Date(now),
      },
    });

export const staffQueries = {
  findById,
  resolveApplicant,

  async createActive(context: StaffCommandContext, email: string, role: StaffRole) {
    const id = createStaffId();
    const normalizedEmail = normalizeEmail(email);
    const now = Date.now();
    const db = database();
    const [created] = await db.batch([
      db
        .insert(staffMembers)
        .select(
          db
            .select({
              id: sql<string>`${id}`.as("id"),
              normalizedEmail: sql<string>`${normalizedEmail}`.as("normalized_email"),
              authUserId: sql<null>`null`.as("auth_user_id"),
              status: sql<"active">`${"active"}`.as("status"),
              role: sql<StaffRole>`${role}`.as("role"),
              sessionGeneration: sql<number>`0`.as("session_generation"),
              createdAt: sql<Date>`${now}`.as("created_at"),
              updatedAt: sql<Date>`${now}`.as("updated_at"),
              approvedAt: sql<Date>`${now}`.as("approved_at"),
              revokedAt: sql<null>`null`.as("revoked_at"),
            })
            .from(actingStaff)
            .where(
              and(
                eq(actingStaff.id, context.actor.staffId),
                eq(actingStaff.status, "active"),
                eq(actingStaff.role, "owner"),
              ),
            ),
        )
        .onConflictDoNothing({ target: staffMembers.normalizedEmail })
        .returning(selection),
      insertAudit(
        context,
        "staff.create",
        id,
        now,
        sql<string>`json_object('before', null, 'after', json_object('status', ${staffMembers.status}, 'role', ${staffMembers.role}))`,
        eq(staffMembers.id, id),
      ),
    ]);
    const row = created.at(0);
    return row ? projectStaff(row) : undefined;
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
        operation: staffSessionCleanupDebts.operation,
      })
      .from(staffSessionCleanupDebts)
      .orderBy(asc(staffSessionCleanupDebts.createdAt))
      .limit(limit);
    return rows.map((row) => ({
      authUserId: row.authUserId,
      staffId: v.parse(StaffIdSchema, row.staffId),
      sessionGeneration: v.parse(
        v.pipe(v.number(), v.integer(), v.minValue(0)),
        row.sessionGeneration,
      ),
      operation: v.parse(StaffCleanupOperationSchema, row.operation),
    }));
  },

  async clearCleanupDebt(authUserId: string, sessionGeneration: number) {
    const deleted = await database()
      .delete(staffSessionCleanupDebts)
      .where(
        and(
          eq(staffSessionCleanupDebts.authUserId, authUserId),
          eq(staffSessionCleanupDebts.sessionGeneration, sessionGeneration),
        ),
      )
      .returning({ authUserId: staffSessionCleanupDebts.authUserId });
    if (deleted.length === 1) {
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
    const predicate = and(eq(staffMembers.id, id), eq(staffMembers.status, "pending"));
    const db = database();
    const [, , changedRows] = await db.batch([
      insertAudit(
        context,
        "staff.approve",
        id,
        now,
        sql<string>`json_object('before', json_object('status', ${staffMembers.status}, 'role', ${staffMembers.role}), 'after', json_object('status', ${"active"}, 'role', ${role}))`,
        predicate,
      ),
      insertCleanupDebt(context, "approve", now, predicate),
      db
        .update(staffMembers)
        .set({
          status: "active",
          role,
          sessionGeneration: sql`${staffMembers.sessionGeneration} + 1`,
          approvedAt: new Date(now),
          revokedAt: null,
          updatedAt: new Date(now),
        })
        .where(and(predicate, actingOwner(context.actor.staffId)))
        .returning(selection),
    ]);
    const changed = changedRows.at(0);
    return changed
      ? { changed: projectStaff(changed), current: undefined }
      : { changed: undefined, current: await findById(id) };
  },

  async changeRole(context: StaffCommandContext, id: StaffId, role: StaffRole) {
    const now = Date.now();
    const predicate = and(
      eq(staffMembers.id, id),
      eq(staffMembers.status, "active"),
      ne(staffMembers.role, role),
      role === "owner" ? undefined : or(ne(staffMembers.role, "owner"), anotherActiveOwner(id)),
    );
    const db = database();
    const [, , changedRows] = await db.batch([
      insertAudit(
        context,
        "staff.role_change",
        id,
        now,
        sql<string>`json_object('before', json_object('status', ${staffMembers.status}, 'role', ${staffMembers.role}), 'after', json_object('status', ${staffMembers.status}, 'role', ${role}))`,
        predicate,
      ),
      insertCleanupDebt(context, "role_change", now, predicate),
      db
        .update(staffMembers)
        .set({
          role,
          sessionGeneration: sql`${staffMembers.sessionGeneration} + 1`,
          updatedAt: new Date(now),
        })
        .where(and(predicate, actingOwner(context.actor.staffId)))
        .returning(selection),
    ]);
    const changed = changedRows.at(0);
    return changed
      ? { changed: projectStaff(changed), current: undefined }
      : { changed: undefined, current: await findById(id) };
  },

  async revoke(context: StaffCommandContext, id: StaffId) {
    const now = Date.now();
    const predicate = and(
      eq(staffMembers.id, id),
      eq(staffMembers.status, "active"),
      or(ne(staffMembers.role, "owner"), anotherActiveOwner(id)),
    );
    const db = database();
    const [, , changedRows] = await db.batch([
      insertAudit(
        context,
        "staff.revoke",
        id,
        now,
        sql<string>`json_object('before', json_object('status', ${staffMembers.status}, 'role', ${staffMembers.role}), 'after', json_object('status', ${"revoked"}, 'role', ${staffMembers.role}))`,
        predicate,
      ),
      insertCleanupDebt(context, "revoke", now, predicate),
      db
        .update(staffMembers)
        .set({
          status: "revoked",
          sessionGeneration: sql`${staffMembers.sessionGeneration} + 1`,
          revokedAt: new Date(now),
          updatedAt: new Date(now),
        })
        .where(and(predicate, actingOwner(context.actor.staffId)))
        .returning(selection),
    ]);
    const changed = changedRows.at(0);
    return changed
      ? { changed: projectStaff(changed), current: undefined }
      : { changed: undefined, current: await findById(id) };
  },

  async remove(context: StaffCommandContext, id: StaffId) {
    const now = Date.now();
    const predicate = and(
      eq(staffMembers.id, id),
      or(ne(staffMembers.status, "active"), ne(staffMembers.role, "owner"), anotherActiveOwner(id)),
    );
    const db = database();
    const [, , removedRows] = await db.batch([
      insertAudit(
        context,
        "staff.remove",
        id,
        now,
        sql<string>`json_object('before', json_object('status', ${staffMembers.status}, 'role', ${staffMembers.role}), 'after', null)`,
        predicate,
      ),
      insertCleanupDebt(context, "remove", now, predicate),
      db
        .delete(staffMembers)
        .where(and(predicate, actingOwner(context.actor.staffId)))
        .returning(selection),
    ]);
    const removed = removedRows.at(0);
    const projected = removed ? projectStaff(removed) : undefined;
    return projected
      ? {
          removed: projected,
          cleanupGeneration: projected.sessionGeneration + 1,
          current: undefined,
        }
      : { removed: undefined, cleanupGeneration: undefined, current: await findById(id) };
  },
};
