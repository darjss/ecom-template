import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/better-sqlite3";

const database = drizzle(new Database(":memory:"));

export const auth = betterAuth({
  database: drizzleAdapter(database, { provider: "sqlite" }),
  basePath: "/api/auth/staff",
  user: {
    modelName: "staff_auth_user",
  },
  session: {
    modelName: "staff_auth_session",
  },
  account: {
    modelName: "staff_auth_account",
  },
  verification: {
    modelName: "staff_auth_verification",
  },
  advanced: {
    cookiePrefix: "urnuun_staff",
  },
});
