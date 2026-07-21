import { createStaffId, StaffIdSchema, type StaffId } from "@ecom/contracts";
import { and, eq, isNotNull, isNull, ne, or } from "drizzle-orm";
import * as v from "valibot";
import { staff_auth_users } from "../auth/staff.generated";
import { database } from "../db/database";
import { staffMembers } from "../db/schema";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const findByEmail = async (normalizedEmail: string) => {
  const rows = await database()
    .select({
      id: staffMembers.id,
      authUserId: staffMembers.authUserId,
      status: staffMembers.status,
      role: staffMembers.role,
    })
    .from(staffMembers)
    .where(eq(staffMembers.normalizedEmail, normalizedEmail))
    .limit(1);
  return rows.at(0);
};

const findByAuthUserId = async (authUserId: string) => {
  const rows = await database()
    .select({
      id: staffMembers.id,
      status: staffMembers.status,
      role: staffMembers.role,
    })
    .from(staffMembers)
    .where(eq(staffMembers.authUserId, authUserId))
    .limit(1);
  return rows.at(0);
};

export const staffQueries = {
  async hasAccess(authUserId: string, staffId: StaffId) {
    const member = await findByAuthUserId(authUserId);
    return member?.id === staffId && member.status === "active" && member.role === "owner";
  },

  async provision(email: string) {
    const normalizedEmail = normalizeEmail(email);
    const now = new Date();
    await database()
      .insert(staffMembers)
      .values({
        id: createStaffId(),
        normalizedEmail,
        status: "active",
        role: "owner",
        createdAt: now,
        updatedAt: now,
        approvedAt: now,
      })
      .onConflictDoUpdate({
        target: staffMembers.normalizedEmail,
        set: {
          status: "active",
          role: "owner",
          updatedAt: now,
          approvedAt: now,
          revokedAt: null,
        },
        where: or(
          ne(staffMembers.status, "active"),
          ne(staffMembers.role, "owner"),
          isNull(staffMembers.approvedAt),
          isNotNull(staffMembers.revokedAt),
        ),
      });
  },

  async resolveAuthUser(authUserId: string) {
    const authUsers = await database()
      .select({ email: staff_auth_users.email, emailVerified: staff_auth_users.emailVerified })
      .from(staff_auth_users)
      .where(eq(staff_auth_users.id, authUserId))
      .limit(1);
    const authUser = authUsers.at(0);
    if (!authUser?.emailVerified) {
      return undefined;
    }

    const member = await findByEmail(normalizeEmail(authUser.email));
    if (!member || member.status !== "active" || member.role !== "owner") {
      return undefined;
    }
    const linkedMember = await findByAuthUserId(authUserId);
    if (linkedMember && linkedMember.id !== member.id) {
      return undefined;
    }
    if (member.authUserId === authUserId) {
      return v.parse(StaffIdSchema, member.id);
    }

    const linked = await database()
      .update(staffMembers)
      .set({ authUserId, updatedAt: new Date() })
      .where(
        and(
          eq(staffMembers.id, member.id),
          eq(staffMembers.status, "active"),
          eq(staffMembers.role, "owner"),
          or(isNull(staffMembers.authUserId), eq(staffMembers.authUserId, authUserId)),
        ),
      )
      .returning({ id: staffMembers.id });
    const linkedId = linked.at(0)?.id;
    return linkedId ? v.parse(StaffIdSchema, linkedId) : undefined;
  },
};
