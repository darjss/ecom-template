import type { CustomerId, MongolianPhone } from "@ecom/contracts";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "cloudflare:workers";
import * as v from "valibot";
import { database } from "../db/database";
import * as customerSchema from "./customer.generated";
import { customerSessionPlugin } from "./customer-session-plugin";

const CustomerAuthEnvironmentSchema = v.strictObject({
  customerSecret: v.pipe(v.string(), v.minLength(32)),
});

const readEnvironment = () =>
  v.safeParse(CustomerAuthEnvironmentSchema, {
    customerSecret: env.BETTER_AUTH_CUSTOMER_SECRET,
  });

const storageKey = (key: string) => `customer:session:${key}`;

const createCustomerAuth = (origin: string) => {
  const environment = readEnvironment();
  if (!environment.success) {
    return undefined;
  }

  return betterAuth({
    basePath: "/api/auth/customer",
    baseURL: origin,
    trustedOrigins: [origin],
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
    secondaryStorage: {
      get: (key) => env.EPHEMERAL_KV.get(storageKey(key)),
      set: (key, value, ttl) =>
        ttl === undefined
          ? env.EPHEMERAL_KV.put(storageKey(key), value)
          : env.EPHEMERAL_KV.put(storageKey(key), value, {
              expirationTtl: Math.max(60, ttl),
            }),
      delete: (key) => env.EPHEMERAL_KV.delete(storageKey(key)),
    },
    plugins: [customerSessionPlugin()],
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24 * 15,
      storeSessionInDatabase: true,
      cookieCache: { enabled: false },
    },
    advanced: {
      cookiePrefix: "urnuun_customer",
      useSecureCookies: true,
      defaultCookieAttributes: {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
      },
    },
  });
};

export const establishCustomerAuthSession = async (
  request: Request,
  origin: string,
  customerId: CustomerId,
  phone: MongolianPhone,
) => {
  const auth = createCustomerAuth(origin);
  if (!auth) {
    return undefined;
  }
  try {
    const result = await auth.api.establishCustomerSession({
      body: { customerId, phone },
      headers: request.headers,
      returnHeaders: true,
    });
    return { headers: result.headers };
  } catch {
    return undefined;
  }
};

export const readCustomerAuthSession = async (request: Request, origin: string) => {
  const auth = createCustomerAuth(origin);
  if (!auth) {
    return { kind: "unavailable" as const };
  }
  try {
    const result = await auth.api.getSession({ headers: request.headers, returnHeaders: true });
    const session = result.response;
    return session?.user.emailVerified
      ? {
          kind: "active" as const,
          authUserId: session.user.id,
          responseHeaders: result.headers,
        }
      : { kind: "anonymous" as const, responseHeaders: result.headers };
  } catch {
    return { kind: "unavailable" as const };
  }
};

export const signOutCustomer = async (request: Request, origin: string) => {
  const auth = createCustomerAuth(origin);
  if (!auth) {
    return undefined;
  }
  try {
    return await auth.handler(
      new Request(`${origin}/api/auth/customer/sign-out`, {
        method: "POST",
        headers: request.headers,
      }),
    );
  } catch {
    return undefined;
  }
};
