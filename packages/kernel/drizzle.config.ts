import { defineConfig } from "drizzle-kit";
import * as customerAuthSchema from "./src/auth/customer.generated";
import * as staffAuthSchema from "./src/auth/staff.generated";

const generatedAuthSchema = { ...customerAuthSchema, ...staffAuthSchema };
if (Object.keys(generatedAuthSchema).length === 0) {
  throw new Error("Generated auth schema is unavailable");
}

export default defineConfig({
  dialect: "sqlite",
  schema: "./packages/kernel/src/db/schema.ts",
  out: "./packages/kernel/migrations",
});
