import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/better-sqlite3";

const database = drizzle(new Database(":memory:"));

export const auth = betterAuth({
  database: drizzleAdapter(database, { provider: "sqlite" }),
  basePath: "/api/auth/customer",
  user: {
    modelName: "customer_auth_user",
  },
  session: {
    modelName: "customer_auth_session",
  },
  account: {
    modelName: "customer_auth_account",
  },
  verification: {
    modelName: "customer_auth_verification",
  },
  advanced: {
    cookiePrefix: "urnuun_customer",
  },
});
