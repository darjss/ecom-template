import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export * from "../auth/customer.generated";
export * from "../auth/staff.generated";

export const systemMetadata = sqliteTable("system_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
