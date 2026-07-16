import type { StaffMember, StaffRole, StaffStatus } from "@ecom/contracts";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { staff_auth_users } from "../auth/staff.generated";
import { database } from "../db/database";
import { staffMembers } from "../db/schema";

export type StaffRecord = StaffMember & { readonly authUserId: string | null };

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const projectStaff = (row: {
  id: string;
  normalizedEmail: string;
  authUserId: string | null;
  status: StaffStatus;
  role: StaffRole | null;
  createdAt: Date;
  updatedAt: Date;
}): StaffRecord => ({
  id: row.id,
  email: row.normalizedEmail,
  authUserId: row.authUserId,
  status: row.status,
  role: row.role,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const selection = {
  id: staffMembers.id,
  normalizedEmail: staffMembers.normalizedEmail,
  authUserId: staffMembers.authUserId,
  status: staffMembers.status,
  role: staffMembers.role,
  createdAt: staffMembers.createdAt,
  updatedAt: staffMembers.updatedAt,
};

const findById = async (id: string) => {
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
      id: crypto.randomUUID(),
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

  async approve(id: string, role: StaffRole) {
    await env.DB.prepare(
      "UPDATE staff_members SET status = 'active', role = ?, updated_at = ? WHERE id = ? AND status IN ('pending', 'revoked')",
    )
      .bind(role, Date.now(), id)
      .run();
    return findById(id);
  },

  async changeRole(id: string, role: StaffRole) {
    await env.DB.prepare(
      "UPDATE staff_members SET role = ?, updated_at = ? WHERE id = ? AND status = 'active' AND NOT (role = 'owner' AND ? <> 'owner' AND (SELECT COUNT(*) FROM staff_members WHERE status = 'active' AND role = 'owner') = 1)",
    )
      .bind(role, Date.now(), id, role)
      .run();
    return findById(id);
  },

  async revoke(id: string) {
    await env.DB.prepare(
      "UPDATE staff_members SET status = 'revoked', updated_at = ? WHERE id = ? AND status = 'active' AND NOT (role = 'owner' AND (SELECT COUNT(*) FROM staff_members WHERE status = 'active' AND role = 'owner') = 1)",
    )
      .bind(Date.now(), id)
      .run();
    return findById(id);
  },

  async remove(id: string) {
    const before = await findById(id);
    await env.DB.prepare(
      "DELETE FROM staff_members WHERE id = ? AND NOT (status = 'active' AND role = 'owner' AND (SELECT COUNT(*) FROM staff_members WHERE status = 'active' AND role = 'owner') = 1)",
    )
      .bind(id)
      .run();
    return { before, after: await findById(id) };
  },
};
