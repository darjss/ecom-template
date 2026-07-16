import { and, eq, isNotNull, isNull, or } from "drizzle-orm";
import { database } from "../db/database";
import { staffMembers } from "../db/schema";

export const staffQueries = {
  async hasActiveAuthority(authUserId: string, normalizedEmail: string) {
    const rows = await database()
      .select({ id: staffMembers.id })
      .from(staffMembers)
      .where(
        and(
          or(
            eq(staffMembers.authUserId, authUserId),
            and(isNull(staffMembers.authUserId), eq(staffMembers.normalizedEmail, normalizedEmail)),
          ),
          eq(staffMembers.status, "active"),
          isNotNull(staffMembers.role),
        ),
      )
      .limit(1);
    return rows.length === 1;
  },
};
