import {
  createStaffId,
  StaffMemberSchema,
  StaffRoleSchema,
  StaffStatusSchema,
  type StaffId,
  type StaffMember,
  type StaffRole,
  type StaffStatus,
} from "@ecom/contracts";
import * as v from "valibot";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { staff_auth_users } from "../auth/staff.generated";
import { database } from "../db/database";
import { staffMembers } from "../db/schema";

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

const resolveApplicant = async (authUserId: string, email: string) => {
  const normalizedEmail = normalizeEmail(email);
  const now = new Date();
  await database()
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
    .onConflictDoNothing({ target: staffMembers.normalizedEmail });
  await database()
    .update(staffMembers)
    .set({ authUserId, updatedAt: now })
    .where(
      and(
        eq(staffMembers.normalizedEmail, normalizedEmail),
        or(isNull(staffMembers.authUserId), eq(staffMembers.authUserId, authUserId)),
      ),
    );
  const rows = await database()
    .select(selection)
    .from(staffMembers)
    .where(
      and(
        eq(staffMembers.normalizedEmail, normalizedEmail),
        eq(staffMembers.authUserId, authUserId),
      ),
    )
    .limit(1);
  const row = rows.at(0);
  return row ? projectStaff(row) : undefined;
};

export const staffQueries = {
  resolveApplicant,

  async createActive(email: string, role: StaffRole) {
    const now = new Date();
    const rows = await database()
      .insert(staffMembers)
      .values({
        id: createStaffId(),
        normalizedEmail: normalizeEmail(email),
        authUserId: null,
        status: "active",
        role,
        createdAt: now,
        updatedAt: now,
        approvedAt: now,
      })
      .onConflictDoNothing({ target: staffMembers.normalizedEmail })
      .returning(selection);
    const row = rows.at(0);
    return row ? projectStaff(row) : undefined;
  },

  async resolveAuthUserApplicant(authUserId: string) {
    const users = await database()
      .select({ email: staff_auth_users.email, emailVerified: staff_auth_users.emailVerified })
      .from(staff_auth_users)
      .where(eq(staff_auth_users.id, authUserId))
      .limit(1);
    const user = users.at(0);
    return user?.emailVerified ? resolveApplicant(authUserId, user.email) : undefined;
  },

  async list() {
    const rows = await database()
      .select(selection)
      .from(staffMembers)
      .orderBy(asc(staffMembers.createdAt));
    return rows.map(projectStaff);
  },

  async hasCurrentSessionGeneration(authUserId: string, generation: number) {
    const rows = await database()
      .select({ sessionGeneration: staffMembers.sessionGeneration })
      .from(staffMembers)
      .where(eq(staffMembers.authUserId, authUserId))
      .limit(1);
    return rows.at(0)?.sessionGeneration === generation;
  },

  async approve(id: StaffId, role: StaffRole) {
    const now = Date.now();
    await env.DB.prepare(
      "UPDATE staff_members SET status = 'active', role = ?, session_generation = session_generation + 1, approved_at = ?, revoked_at = NULL, updated_at = ? WHERE id = ? AND status IN ('pending', 'revoked')",
    )
      .bind(role, now, now, id)
      .run();
    return findById(id);
  },

  async changeRole(id: StaffId, role: StaffRole) {
    await env.DB.prepare(
      "UPDATE staff_members SET role = ?, session_generation = session_generation + 1, updated_at = ? WHERE id = ? AND status = 'active' AND NOT (role = 'owner' AND ? <> 'owner' AND (SELECT COUNT(*) FROM staff_members WHERE status = 'active' AND role = 'owner') = 1)",
    )
      .bind(role, Date.now(), id, role)
      .run();
    return findById(id);
  },

  async revoke(id: StaffId) {
    const now = Date.now();
    await env.DB.prepare(
      "UPDATE staff_members SET status = 'revoked', session_generation = session_generation + 1, revoked_at = ?, updated_at = ? WHERE id = ? AND status = 'active' AND NOT (role = 'owner' AND (SELECT COUNT(*) FROM staff_members WHERE status = 'active' AND role = 'owner') = 1)",
    )
      .bind(now, now, id)
      .run();
    return findById(id);
  },

  async remove(id: StaffId) {
    const result = await env.DB.prepare(
      "DELETE FROM staff_members WHERE id = ? AND NOT (status = 'active' AND role = 'owner' AND (SELECT COUNT(*) FROM staff_members WHERE status = 'active' AND role = 'owner') = 1) RETURNING id, normalized_email AS normalizedEmail, auth_user_id AS authUserId, status, role, session_generation AS sessionGeneration, created_at AS createdAt, updated_at AS updatedAt, approved_at AS approvedAt, revoked_at AS revokedAt",
    )
      .bind(id)
      .all();
    const removed = result.results.at(0);
    return removed
      ? { removed: projectReturnedStaff(removed), current: undefined }
      : { removed: undefined, current: await findById(id) };
  },
};
