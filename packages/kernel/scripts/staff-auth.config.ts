import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/better-sqlite3";

const database = drizzle(new Database(":memory:"));

export const auth = betterAuth({
  database: drizzleAdapter(database, { provider: "sqlite" }),
  basePath: "/api/auth/staff",
  baseURL: "http://localhost",
  user: {
    modelName: "staff_auth_users",
  },
  session: {
    modelName: "staff_auth_sessions",
    additionalFields: {
      role: {
        type: "string",
        required: false,
        input: false,
      },
      generation: {
        type: "number",
        required: false,
        input: false,
      },
    },
  },
  account: {
    modelName: "staff_auth_accounts",
  },
  verification: {
    modelName: "staff_auth_verifications",
  },
  advanced: {
    cookiePrefix: "urnuun_staff",
  },
});
