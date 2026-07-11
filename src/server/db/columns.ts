import { createId } from "@paralleldrive/cuid2";
import { integer, text } from "drizzle-orm/sqlite-core";

export const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => createId());

export const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

export const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());
