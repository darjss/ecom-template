import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "cloudflare:workers";
import * as v from "valibot";
import { database } from "../db/database";
import * as staffSchema from "./staff.generated";

const AuthEnvironmentSchema = v.strictObject({
  staffSecret: v.pipe(v.string(), v.minLength(32)),
  googleClientId: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
  googleClientSecret: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
});

const optionalCredential = (value: string | undefined) =>
  value === undefined || value.trim() === "" ? undefined : value;

const readAuthEnvironment = () =>
  v.safeParse(AuthEnvironmentSchema, {
    staffSecret: env.BETTER_AUTH_STAFF_SECRET,
    googleClientId: optionalCredential(env.GOOGLE_CLIENT_ID),
    googleClientSecret: optionalCredential(env.GOOGLE_CLIENT_SECRET),
  });

export const createStaffAuth = (origin: string) => {
  const environment = readAuthEnvironment();
  if (!environment.success) {
    return undefined;
  }

  const google =
    environment.output.googleClientId && environment.output.googleClientSecret
      ? {
          google: {
            clientId: environment.output.googleClientId,
            clientSecret: environment.output.googleClientSecret,
          },
        }
      : undefined;

  return betterAuth({
    basePath: "/api/auth/staff",
    baseURL: origin,
    secret: environment.output.staffSecret,
    database: drizzleAdapter(database(), {
      provider: "sqlite",
      schema: {
        ...staffSchema,
        user: staffSchema.staff_auth_users,
        session: staffSchema.staff_auth_sessions,
        account: staffSchema.staff_auth_accounts,
        verification: staffSchema.staff_auth_verifications,
      },
    }),
    socialProviders: google,
    advanced: { cookiePrefix: "urnuun_staff" },
  });
};
