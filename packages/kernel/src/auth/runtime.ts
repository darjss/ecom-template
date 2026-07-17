import { StaffRoleSchema } from "@ecom/contracts";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "cloudflare:workers";
import * as v from "valibot";
import { database } from "../db/database";
import { staffQueries } from "../staff/persistence";
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

const staffStorageKey = (key: string) => `staff:${key}`;

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
    trustedOrigins: [origin],
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
    secondaryStorage: {
      get: (key) => env.EPHEMERAL_KV.get(staffStorageKey(key)),
      set: (key, value, ttl) =>
        ttl === undefined
          ? env.EPHEMERAL_KV.put(staffStorageKey(key), value)
          : env.EPHEMERAL_KV.put(staffStorageKey(key), value, {
              expirationTtl: Math.max(60, ttl),
            }),
      delete: (key) => env.EPHEMERAL_KV.delete(staffStorageKey(key)),
    },
    socialProviders: google,
    session: {
      expiresIn: 60 * 60 * 24 * 14,
      updateAge: 60 * 60 * 24 * 7,
      cookieCache: { enabled: false },
      additionalFields: {
        role: { type: "string", required: false, input: false },
        generation: { type: "number", required: false, input: false },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const applicant = await staffQueries.resolveAuthUserApplicant(session.userId);
            if (applicant.kind === "infrastructure_unavailable") {
              throw new Error("Staff applicant persistence is unavailable");
            }
            const member = applicant.kind === "resolved" ? applicant.member : undefined;
            return {
              data: {
                ...session,
                role: member?.status === "active" ? member.role : null,
                generation: member?.sessionGeneration ?? null,
              },
            };
          },
        },
      },
    },
    advanced: {
      cookiePrefix: "urnuun_staff",
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

export const readStaffAuthSession = async (request: Request, origin: string) => {
  const auth = createStaffAuth(origin);
  if (!auth) {
    return { kind: "unavailable" as const };
  }

  const sessionAttempt = await (async () => {
    try {
      return {
        success: true as const,
        session: await auth.api.getSession({ headers: request.headers }),
      };
    } catch {
      return { success: false as const };
    }
  })();
  if (!sessionAttempt.success) {
    return { kind: "unavailable" as const };
  }
  const session = sessionAttempt.session;
  if (!session || !session.user.emailVerified) {
    return { kind: "unauthorized" as const };
  }

  const deleteSessions = async () => {
    try {
      await (await auth.$context).internalAdapter.deleteUserSessions(session.user.id);
      return true;
    } catch {
      return false;
    }
  };

  const role = v.safeParse(StaffRoleSchema, session.session.role);
  if (!role.success) {
    const applicant = await staffQueries.resolveApplicant(session.user.id, session.user.email);
    if (applicant.kind === "infrastructure_unavailable" || !(await deleteSessions())) {
      return { kind: "unavailable" as const };
    }
    return applicant.kind === "identity_conflict"
      ? { kind: "identity_conflict" as const }
      : { kind: "awaiting_approval" as const };
  }

  const generation = v.safeParse(
    v.pipe(v.number(), v.integer(), v.minValue(0)),
    session.session.generation,
  );
  if (!generation.success) {
    return (await deleteSessions())
      ? { kind: "unauthorized" as const }
      : { kind: "unavailable" as const };
  }
  const authorityAttempt = await (async () => {
    try {
      return {
        success: true as const,
        authority: await staffQueries.readCurrentSessionAuthority(
          session.user.id,
          session.user.email,
          generation.output,
        ),
      };
    } catch {
      return { success: false as const };
    }
  })();
  if (!authorityAttempt.success) {
    return { kind: "unavailable" as const };
  }
  if (authorityAttempt.authority.kind !== "current") {
    if (!(await deleteSessions())) {
      return { kind: "unavailable" as const };
    }
    return authorityAttempt.authority.kind === "identity_conflict"
      ? { kind: "identity_conflict" as const }
      : { kind: "unauthorized" as const };
  }
  return {
    kind: "active" as const,
    actor: {
      staffId: authorityAttempt.authority.staffId,
      authUserId: session.user.id,
      role: role.output,
    },
  };
};

export const revokeStaffUserSessions = async (origin: string, authUserId: string) => {
  const auth = createStaffAuth(origin);
  if (!auth) {
    return false;
  }
  await (await auth.$context).internalAdapter.deleteUserSessions(authUserId);
  return true;
};
