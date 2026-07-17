import {
  ApiErrorSchema,
  HealthApiErrorSchema,
  HealthResponseSchema,
  StaffCleanupResponseSchema,
  StaffCreateInputSchema,
  StaffIdSchema,
  StaffLifecycleApiErrorSchema,
  StaffListResponseSchema,
  StaffMutationInputSchema,
  StaffMutationResponseSchema,
  StaffRoleSchema,
  StoreDefinitionSchema,
  type StoreDefinition,
} from "@ecom/contracts";
import {
  approveStaff,
  changeStaffRole,
  createStaff,
  createStaffAuth,
  createStoreBackground,
  createStorefrontReader,
  listStaff,
  readDatabaseHealth,
  readStaffAuthSession,
  removeStaff,
  retryStaffSessionCleanup,
  revokeStaff,
  type CustomerSmsDelivery,
  type StaffOperationFailure,
  type StoreBackground,
  type StorefrontReader,
} from "@ecom/kernel";
import { Elysia } from "elysia";
import * as v from "valibot";
import { createCustomerAuthRoutes } from "./customer-routes";
import { resolveStoreRequestOrigin } from "./request-origin";

export const staffPresentationRoleHeader = "x-ecom-authorized-staff-role";

export const readStaffPresentationRole = (headers: Headers) =>
  v.parse(StaffRoleSchema, headers.get(staffPresentationRoleHeader));

const privateResponse = (response: Response) => {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "private, no-store");
  headers.delete("cloudflare-cdn-cache-control");
  headers.delete("cache-tag");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const apiError = (
  code: "unauthorized" | "forbidden" | "not_found" | "validation" | "conflict" | "unavailable",
  message: string,
  reason?: "final_owner" | "invalid_transition" | "session_revocation_failed",
) =>
  v.parse(StaffLifecycleApiErrorSchema, {
    error: { code, message, ...(reason ? { reason } : {}) },
  });

const unavailableAuthResponse = () =>
  Response.json(
    v.parse(ApiErrorSchema, {
      error: { code: "unavailable", message: "Authentication is not configured" },
    }),
    { status: 503, headers: { "cache-control": "private, no-store" } },
  );

const rejectedHostResponse = () =>
  Response.json(
    v.parse(ApiErrorSchema, {
      error: { code: "validation", message: "Request host is not accepted" },
    }),
    { status: 421, headers: { "cache-control": "private, no-store" } },
  );

const readActor = async (request: Request, definition: StoreDefinition) => {
  const origin = resolveStoreRequestOrigin(request, definition.profile.slug);
  if (!origin) {
    return { kind: "rejected_host" as const };
  }
  const session = await readStaffAuthSession(request, origin);
  return session.kind === "active"
    ? { kind: "active" as const, origin, actor: session.actor }
    : session;
};

const mapFailure = (
  failure: StaffOperationFailure,
  status: (code: number, body: unknown) => unknown,
) => {
  if (failure.code === "forbidden") {
    return status(403, apiError("forbidden", "Owner authority is required"));
  }
  if (failure.code === "not_found") {
    return status(404, apiError("not_found", "Staff member was not found"));
  }
  if (failure.code === "final_owner") {
    return status(409, apiError("conflict", "The final active Owner is protected", "final_owner"));
  }
  if (failure.code === "invalid_transition") {
    return status(
      409,
      apiError("conflict", "The Staff lifecycle transition is not valid", "invalid_transition"),
    );
  }
  if (failure.code === "session_revocation_failed") {
    return status(
      503,
      apiError(
        "unavailable",
        "Staff authority changed, but disposable session cleanup is incomplete",
        "session_revocation_failed",
      ),
    );
  }
  return status(503, apiError("unavailable", "Staff authority is unavailable"));
};

const authorizeRoute = async (
  request: Request,
  definition: StoreDefinition,
  status: (code: number, body: unknown) => unknown,
) => {
  const state = await readActor(request, definition);
  if (state.kind === "active") {
    return { authorized: true as const, actor: state.actor, origin: state.origin };
  }
  if (state.kind === "awaiting_approval") {
    return {
      authorized: false as const,
      response: status(403, apiError("forbidden", "Staff approval is pending")),
    };
  }
  if (state.kind === "rejected_host") {
    return {
      authorized: false as const,
      response: status(421, apiError("validation", "Request host is not accepted")),
    };
  }
  if (state.kind === "unavailable") {
    return {
      authorized: false as const,
      response: status(503, apiError("unavailable", "Authentication is not configured")),
    };
  }
  return {
    authorized: false as const,
    response: status(401, apiError("unauthorized", "Staff authentication is required")),
  };
};

const createApi = (definition: StoreDefinition, smsGateway: CustomerSmsDelivery) =>
  new Elysia({ aot: false, prefix: "/api" })
    .onAfterHandle(({ responseValue, set }) => {
      set.headers["cache-control"] = "private, no-store";
      return responseValue;
    })
    .use(createCustomerAuthRoutes(definition, smsGateway))
    .all("/auth/staff/*", async ({ body, request }) => {
      const origin = resolveStoreRequestOrigin(request, definition.profile.slug);
      if (!origin) {
        return rejectedHostResponse();
      }
      const auth = createStaffAuth(origin);
      if (!auth) {
        return unavailableAuthResponse();
      }
      const authRequest =
        request.bodyUsed && body !== undefined
          ? new Request(request.url, {
              method: request.method,
              headers: request.headers,
              body: JSON.stringify(body),
            })
          : request;
      return privateResponse(await auth.handler(authRequest));
    })
    .get("/staff", async ({ request, status }) => {
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await listStaff(authorization.actor);
      return result.isErr()
        ? mapFailure(result.error, status)
        : v.parse(StaffListResponseSchema, { data: result.value });
    })
    .post("/staff", async ({ body, request, status }) => {
      const input = v.safeParse(StaffCreateInputSchema, body);
      if (!input.success) {
        return status(422, apiError("validation", "A valid Staff email and role are required"));
      }
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await createStaff(authorization.actor, input.output.email, input.output.role);
      return result.isErr()
        ? mapFailure(result.error, status)
        : v.parse(StaffMutationResponseSchema, { data: result.value });
    })
    .post("/staff/session-cleanup/retry", async ({ request, status }) => {
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await retryStaffSessionCleanup(authorization.actor, authorization.origin);
      return result.isErr()
        ? mapFailure(result.error, status)
        : v.parse(StaffCleanupResponseSchema, { data: result.value });
    })
    .post("/staff/:id/approve", async ({ body, params, request, status }) => {
      const input = v.safeParse(StaffMutationInputSchema, body);
      const id = v.safeParse(StaffIdSchema, params.id);
      if (!input.success || !id.success) {
        return status(422, apiError("validation", "A valid Staff ID and role are required"));
      }
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await approveStaff(
        authorization.actor,
        authorization.origin,
        id.output,
        input.output.role,
      );
      return result.isErr()
        ? mapFailure(result.error, status)
        : v.parse(StaffMutationResponseSchema, { data: result.value });
    })
    .patch("/staff/:id/role", async ({ body, params, request, status }) => {
      const input = v.safeParse(StaffMutationInputSchema, body);
      const id = v.safeParse(StaffIdSchema, params.id);
      if (!input.success || !id.success) {
        return status(422, apiError("validation", "A valid Staff ID and role are required"));
      }
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await changeStaffRole(
        authorization.actor,
        authorization.origin,
        id.output,
        input.output.role,
      );
      return result.isErr()
        ? mapFailure(result.error, status)
        : v.parse(StaffMutationResponseSchema, { data: result.value });
    })
    .post("/staff/:id/revoke", async ({ params, request, status }) => {
      const id = v.safeParse(StaffIdSchema, params.id);
      if (!id.success) {
        return status(422, apiError("validation", "A valid Staff ID is required"));
      }
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await revokeStaff(authorization.actor, authorization.origin, id.output);
      return result.isErr()
        ? mapFailure(result.error, status)
        : v.parse(StaffMutationResponseSchema, { data: result.value });
    })
    .delete("/staff/:id", async ({ params, request, status }) => {
      const id = v.safeParse(StaffIdSchema, params.id);
      if (!id.success) {
        return status(422, apiError("validation", "A valid Staff ID is required"));
      }
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await removeStaff(authorization.actor, authorization.origin, id.output);
      return result.isErr()
        ? mapFailure(result.error, status)
        : v.parse(StaffMutationResponseSchema, { data: result.value });
    })
    .get("/health", async ({ status }) => {
      const databaseHealth = await readDatabaseHealth();
      if (databaseHealth.isErr()) {
        return status(
          503,
          v.parse(HealthApiErrorSchema, {
            error: { code: "unavailable", message: "Store infrastructure is unavailable" },
          }),
        );
      }
      const health = databaseHealth.unwrap();
      return v.parse(HealthResponseSchema, {
        data: {
          status: "ok",
          ...health,
          store: definition.profile.name,
          checkedAt: new Date().toISOString(),
        },
      });
    });

export type StoreElysiaApp = ReturnType<typeof createApi>;

export type StoreBackend = {
  readonly api: StoreElysiaApp;
  readonly storefront: StorefrontReader;
  readonly background: StoreBackground;
};

export const resolveStaffRequest = async (request: Request, input: unknown) => {
  const definition = v.parse(StoreDefinitionSchema, input);
  const origin = resolveStoreRequestOrigin(request, definition.profile.slug);
  return origin ? readStaffAuthSession(request, origin) : { kind: "unauthorized" as const };
};

export { resolveStoreRequestOrigin } from "./request-origin";

export type StoreBackendInput = {
  readonly profile: unknown;
  readonly providers: unknown;
  readonly smsGateway: CustomerSmsDelivery;
};

export const createStoreBackend = (input: StoreBackendInput): StoreBackend => {
  const definition = v.parse(StoreDefinitionSchema, {
    profile: input.profile,
    providers: input.providers,
  });
  return {
    api: createApi(definition, input.smsGateway),
    storefront: createStorefrontReader({
      storeName: definition.profile.name,
      location: definition.profile.location,
      status: "open",
    }),
    background: createStoreBackground(),
  };
};
