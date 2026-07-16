import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as v from "valibot";
import { database } from "../db/database";
import * as customerSchema from "./customer.generated";
import * as staffSchema from "./staff.generated";

const AuthEnvironmentSchema = v.strictObject({
  staffSecret: v.pipe(v.string(), v.minLength(32)),
  customerSecret: v.pipe(v.string(), v.minLength(32)),
  googleClientId: v.optional(v.pipe(v.string(), v.minLength(1))),
  googleClientSecret: v.optional(v.pipe(v.string(), v.minLength(1))),
});

const readAuthEnvironment = () =>
  v.safeParse(AuthEnvironmentSchema, {
    staffSecret: process.env.BETTER_AUTH_STAFF_SECRET,
    customerSecret: process.env.BETTER_AUTH_CUSTOMER_SECRET,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  });

export const createAuthRuntimes = (origin: string) => {
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

  const staff = betterAuth({
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

  const customer = betterAuth({
    basePath: "/api/auth/customer",
    baseURL: origin,
    secret: environment.output.customerSecret,
    database: drizzleAdapter(database(), {
      provider: "sqlite",
      schema: {
        ...customerSchema,
        user: customerSchema.customer_auth_users,
        session: customerSchema.customer_auth_sessions,
        account: customerSchema.customer_auth_accounts,
        verification: customerSchema.customer_auth_verifications,
      },
    }),
    advanced: { cookiePrefix: "urnuun_customer" },
  });

  return { staff, customer };
};
