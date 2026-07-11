import { sso } from "@better-auth/sso";
import { polar, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, magicLink, organization, twoFactor } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/better-sqlite3";

const db = drizzle(new Database(":memory:"));

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: { enabled: true },
  plugins: [
    magicLink({ sendMagicLink: async () => {} }),
    twoFactor(),
    organization(),
    admin(),
    sso(),
    polar({
      client: new Polar({ accessToken: "schema-generation-only", server: "sandbox" }),
      use: [portal(), webhooks({ secret: "schema-generation-only" })],
    }),
  ],
});
