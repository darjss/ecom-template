import {
  createStaffId,
  StaffMemberSchema,
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
    const before = await findById(id);
    await env.DB.prepare(
      "DELETE FROM staff_members WHERE id = ? AND NOT (status = 'active' AND role = 'owner' AND (SELECT COUNT(*) FROM staff_members WHERE status = 'active' AND role = 'owner') = 1)",
    )
      .bind(id)
      .run();
    return { before, after: await findById(id) };
  },
};
