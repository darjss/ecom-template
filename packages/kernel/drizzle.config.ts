import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./packages/kernel/src/db/schema.ts",
  out: "./apps/urnuun-48/migrations",
});
