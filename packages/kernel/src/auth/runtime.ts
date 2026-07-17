import { StaffIdSchema, StaffRoleSchema } from "@ecom/contracts";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "cloudflare:workers";
import * as v from "valibot";
import { database } from "../db/database";
import { staffQueries } from "../staff/persistence";
import * as staffSchema from "./staff.generated";

const StaffAuthEnvironmentSchema = v.strictObject({
  staffSecret: v.pipe(v.string(), v.minLength(32)),
  googleClientId: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
  googleClientSecret: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
});

const optionalCredential = (value: string | undefined) =>
  value === undefined || value.trim() === "" ? undefined : value;

const readStaffAuthEnvironment = () =>
  v.safeParse(StaffAuthEnvironmentSchema, {
    staffSecret: env.BETTER_AUTH_STAFF_SECRET,
    googleClientId: optionalCredential(env.GOOGLE_CLIENT_ID),
    googleClientSecret: optionalCredential(env.GOOGLE_CLIENT_SECRET),
  });

const staffStorageKey = (key: string) => `staff:${key}`;

export const createStaffAuth = (origin: string) => {
  const environment = readStaffAuthEnvironment();
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
        staffId: { type: "string", required: false, input: false },
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
                staffId: member?.id ?? null,
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

  const deleteSession = async () => {
    try {
      await (await auth.$context).internalAdapter.deleteSession(session.session.token);
      return true;
    } catch {
      return false;
    }
  };

  const role = v.safeParse(StaffRoleSchema, session.session.role);
  const staffId = v.safeParse(StaffIdSchema, session.session.staffId);
  if (!role.success || !staffId.success) {
    if (!(await deleteSession())) {
      return { kind: "unavailable" as const };
    }
    return staffId.success
      ? { kind: "awaiting_approval" as const }
      : { kind: "identity_conflict" as const };
  }

  const authority = await (async () => {
    try {
      return {
        success: true as const,
        role: await staffQueries.readCurrentSessionAuthority(session.user.id, staffId.output),
      };
    } catch {
      return { success: false as const };
    }
  })();
  if (!authority.success) {
    return { kind: "unavailable" as const };
  }
  if (authority.role !== role.output) {
    if (!(await deleteSession())) {
      return { kind: "unavailable" as const };
    }
    return { kind: "unauthorized" as const };
  }

  return {
    kind: "active" as const,
    actor: {
      staffId: staffId.output,
      authUserId: session.user.id,
      role: role.output,
    },
  };
};

export const deleteStaffUserSessions = async (origin: string, authUserId: string) => {
  const auth = createStaffAuth(origin);
  if (!auth) {
    return false;
  }
  const adapter = (await auth.$context).internalAdapter;
  const sessions = await adapter.listSessions(authUserId, { onlyActiveSessions: true });
  for (const session of sessions) {
    await adapter.deleteSession(session.token);
  }
  return (await adapter.listSessions(authUserId, { onlyActiveSessions: true })).length === 0;
};
