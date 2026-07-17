import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "cloudflare:workers";
import * as v from "valibot";
import { database } from "../db/database";
import * as customerSchema from "./customer.generated";

const CustomerAuthEnvironmentSchema = v.strictObject({
  customerSecret: v.pipe(v.string(), v.minLength(32)),
});

const readEnvironment = () =>
  v.safeParse(CustomerAuthEnvironmentSchema, {
    customerSecret: env.BETTER_AUTH_CUSTOMER_SECRET,
  });

const storageKey = (key: string) => `customer:session:${key}`;

export const createCustomerAuth = (origin: string) => {
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
    emailAndPassword: { enabled: true, disableSignUp: true },
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

const hex = (value: ArrayBuffer) =>
  [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const deriveCredential = async (phone: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(phone)));
};

export const ensureCustomerAuthUser = async (origin: string, phone: string) => {
  const environment = readEnvironment();
  const auth = createCustomerAuth(origin);
  if (!environment.success || !auth) {
    return { kind: "unavailable" as const };
  }
  try {
    const credential = await deriveCredential(phone, environment.output.customerSecret);
    const email = `${credential}@customer.invalid`;
    const context = await auth.$context;
    const current = await context.internalAdapter.findUserByEmail(email, {
      includeAccounts: true,
    });
    const user =
      current?.user ??
      (await context.internalAdapter.createUser({
        email,
        emailVerified: true,
        name: phone,
      }));
    const accounts = current?.accounts ?? (await context.internalAdapter.findAccounts(user.id));
    if (!accounts.some((account) => account.providerId === "credential")) {
      await context.internalAdapter.linkAccount({
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: await context.password.hash(credential),
      });
    }
    return { kind: "ready" as const, authUserId: user.id, email, credential };
  } catch {
    return { kind: "unavailable" as const };
  }
};

export const createCustomerSessionResponse = async (
  request: Request,
  origin: string,
  email: string,
  credential: string,
) => {
  const auth = createCustomerAuth(origin);
  if (!auth) {
    return undefined;
  }
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.set("content-type", "application/json");
  headers.set("origin", origin);
  const response = await auth.handler(
    new Request(`${origin}/api/auth/customer/sign-in/email`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password: credential, rememberMe: true }),
    }),
  );
  return response.ok ? response : undefined;
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
