import { sso } from "@better-auth/sso";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, magicLink, organization, twoFactor } from "better-auth/plugins";
import { env as cf } from "cloudflare:workers";
import { env, googleEnabled, ssoEnabled } from "@/env";
import { paymentProvider } from "@/server/billing";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { sendEmail } from "./email";

const googleId = env.GOOGLE_CLIENT_ID;
const googleSecret = env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  secondaryStorage: {
    get: (key) => cf.SESSIONS.get(key),
    set: async (key, value, ttl) => {
      await cf.SESSIONS.put(key, value, ttl ? { expirationTtl: Math.max(ttl, 60) } : undefined);
    },
    delete: async (key) => {
      await cf.SESSIONS.delete(key);
    },
  },
  session: {
    cookieCache: { enabled: true, maxAge: 300 },
    storeSessionInDatabase: true,
  },
  emailAndPassword: { enabled: true },
  socialProviders:
    googleEnabled && googleId && googleSecret
      ? { google: { clientId: googleId, clientSecret: googleSecret } }
      : {},
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({
          to: email,
          subject: "Your sign-in link",
          text: `Sign in with this link: ${url}`,
        });
      },
    }),
    twoFactor({ issuer: "saas-starter" }),
    organization(),
    admin(),
    // TODO: flip to WorkOS by swapping this plugin — see README swap points
    ...(ssoEnabled ? [sso()] : []),
    paymentProvider.authPlugin,
  ],
});
