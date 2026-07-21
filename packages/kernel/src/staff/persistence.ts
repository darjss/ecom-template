import {
  createStaffId,
  StaffMemberSchema,
  type StaffId,
  type StaffMember,
  type StaffRole,
  type StaffStatus,
} from "@ecom/contracts";
import * as v from "valibot";
import { and, asc, eq, exists, isNotNull, isNull, ne, notExists, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { staff_auth_users } from "../auth/staff.generated";
import { database } from "../db/database";
import { staffMembers } from "../db/schema";

export type StaffRecord = StaffMember & {
  readonly authUserId: string | null;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const projectStaff = (row: {
  id: string;
  normalizedEmail: string;
  authUserId: string | null;
  status: StaffStatus;
  role: StaffRole | null;
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
});

const selection = {
  id: staffMembers.id,
  normalizedEmail: staffMembers.normalizedEmail,
  authUserId: staffMembers.authUserId,
  status: staffMembers.status,
  role: staffMembers.role,
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

const findByNormalizedEmail = async (normalizedEmail: string) => {
  const rows = await database()
    .select(selection)
    .from(staffMembers)
    .where(eq(staffMembers.normalizedEmail, normalizedEmail))
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

const resolveApplicant = async (authUserId: string, email: string) => {
  const normalizedEmail = normalizeEmail(email);
  const now = new Date();
  const db = database();
  const authOwner = alias(staffMembers, "auth_owner");
  const attempt = await attemptDatabase(
    db.batch([
      db
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
        .onConflictDoNothing()
        .returning(selection),
      db
        .update(staffMembers)
        .set({ authUserId, updatedAt: now })
        .where(
          and(
            eq(staffMembers.normalizedEmail, normalizedEmail),
            or(
              eq(staffMembers.authUserId, authUserId),
              and(
                isNull(staffMembers.authUserId),
                notExists(
                  db
                    .select({ id: authOwner.id })
                    .from(authOwner)
                    .where(eq(authOwner.authUserId, authUserId)),
                ),
              ),
            ),
          ),
        )
        .returning(selection),
    ]),
  );
  if (!attempt.success) {
    return { kind: "infrastructure_unavailable" } as const;
  }
  const [inserted, linked] = attempt.value;
  const resolved = inserted.at(0) ?? linked.at(0);
  return resolved
    ? ({ kind: "resolved", member: projectStaff(resolved) } as const)
    : ({ kind: "identity_conflict" } as const);
};

export type StaffCommandContext = {
  readonly actor: { readonly staffId: StaffId; readonly role: StaffRole };
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

export const staffQueries = {
  findById,
  resolveApplicant,

  async provisionOwner(email: string) {
    const normalizedEmail = normalizeEmail(email);
    const current = await findByNormalizedEmail(normalizedEmail);
    if (current?.status === "active" && current.role === "owner") {
      return { kind: "provisioned" as const, member: current };
    }
    if (current?.authUserId) {
      return { kind: "linked_identity" as const };
    }

    const id = current?.id ?? createStaffId();
    const now = Date.now();
    const db = database();
    const provisionedRows = await db
      .insert(staffMembers)
      .values({
        id,
        normalizedEmail,
        status: "active",
        role: "owner",
        createdAt: new Date(now),
        updatedAt: new Date(now),
        approvedAt: new Date(now),
      })
      .onConflictDoUpdate({
        target: staffMembers.normalizedEmail,
        set: {
          status: "active",
          role: "owner",
          approvedAt: new Date(now),
          revokedAt: null,
          updatedAt: new Date(now),
        },
        where:
          and(
            isNull(staffMembers.authUserId),
            or(
              ne(staffMembers.status, "active"),
              ne(staffMembers.role, "owner"),
              isNull(staffMembers.approvedAt),
              isNotNull(staffMembers.revokedAt),
            ),
          ) ?? isNull(staffMembers.authUserId),
      })
      .returning(selection);
    const provisioned = provisionedRows.at(0);
    if (provisioned) {
      return { kind: "provisioned" as const, member: projectStaff(provisioned) };
    }
    const resolved = await findByNormalizedEmail(normalizedEmail);
    return resolved?.status === "active" && resolved.role === "owner"
      ? { kind: "provisioned" as const, member: resolved }
      : { kind: "linked_identity" as const };
  },

  async createActive(context: StaffCommandContext, email: string, role: StaffRole) {
    const id = createStaffId();
    const normalizedEmail = normalizeEmail(email);
    const now = Date.now();
    const db = database();
    const created = await db
      .insert(staffMembers)
      .select(
        db
          .select({
            id: sql<string>`${id}`.as("id"),
            normalizedEmail: sql<string>`${normalizedEmail}`.as("normalized_email"),
            authUserId: sql<null>`null`.as("auth_user_id"),
            status: sql<"active">`${"active"}`.as("status"),
            role: sql<StaffRole>`${role}`.as("role"),
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
      .returning(selection);
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

  async hasAnotherActiveOwner(id: StaffId) {
    const rows = await database()
      .select({ id: staffMembers.id })
      .from(staffMembers)
      .where(
        and(
          ne(staffMembers.id, id),
          eq(staffMembers.status, "active"),
          eq(staffMembers.role, "owner"),
        ),
      )
      .limit(1);
    return rows.length === 1;
  },

  async approve(context: StaffCommandContext, id: StaffId, role: StaffRole) {
    const now = Date.now();
    const predicate = and(eq(staffMembers.id, id), eq(staffMembers.status, "pending"));
    const changedRows = await database()
      .update(staffMembers)
      .set({
        status: "active",
        role,
        approvedAt: new Date(now),
        revokedAt: null,
        updatedAt: new Date(now),
      })
      .where(and(predicate, actingOwner(context.actor.staffId)))
      .returning(selection);
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
    const changedRows = await database()
      .update(staffMembers)
      .set({
        role,
        updatedAt: new Date(now),
      })
      .where(and(predicate, actingOwner(context.actor.staffId)))
      .returning(selection);
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
    const changedRows = await database()
      .update(staffMembers)
      .set({
        status: "revoked",
        revokedAt: new Date(now),
        updatedAt: new Date(now),
      })
      .where(and(predicate, actingOwner(context.actor.staffId)))
      .returning(selection);
    const changed = changedRows.at(0);
    return changed
      ? { changed: projectStaff(changed), current: undefined }
      : { changed: undefined, current: await findById(id) };
  },

  async remove(context: StaffCommandContext, id: StaffId) {
    const predicate = and(
      eq(staffMembers.id, id),
      or(ne(staffMembers.status, "active"), ne(staffMembers.role, "owner"), anotherActiveOwner(id)),
    );
    const removedRows = await database()
      .delete(staffMembers)
      .where(and(predicate, actingOwner(context.actor.staffId)))
      .returning(selection);
    const removed = removedRows.at(0);
    return removed
      ? { removed: projectStaff(removed), current: undefined }
      : { removed: undefined, current: await findById(id) };
  },
};
