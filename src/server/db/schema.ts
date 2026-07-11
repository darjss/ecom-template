import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";
import { createdAt, id, updatedAt } from "./columns";

export * from "./auth-schema";

export const project = sqliteTable(
  "project",
  {
    id: id(),
    name: text("name").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("project_owner_idx").on(table.ownerId)],
);
