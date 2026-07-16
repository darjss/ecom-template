import {
  ApiErrorSchema,
  HealthApiErrorSchema,
  HealthResponseSchema,
  StoreDefinitionSchema,
  type StoreDefinition,
} from "@ecom/contracts";
import {
  createStaffAuth,
  createStoreBackground,
  createStorefrontReader,
  readDatabaseHealth,
  staffQueries,
  type StoreBackground,
  type StorefrontReader,
} from "@ecom/kernel";
import { Elysia } from "elysia";
import * as v from "valibot";
import { resolveStoreRequestOrigin } from "./request-origin";

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

const createApi = (definition: StoreDefinition) =>
  new Elysia({ aot: false, prefix: "/api" })
    .all("/auth/staff/*", async ({ request }) => {
      const origin = resolveStoreRequestOrigin(request, definition.profile.slug);
      if (!origin) {
        return rejectedHostResponse();
      }
      const auth = createStaffAuth(origin);
      return auth ? privateResponse(await auth.handler(request)) : unavailableAuthResponse();
    })
    .get("/health", async ({ set, status }) => {
      set.headers["cache-control"] = "private, no-store";
      const databaseHealth = await readDatabaseHealth();
      if (databaseHealth.isErr()) {
        return status(
          503,
          v.parse(HealthApiErrorSchema, {
            error: {
              code: "unavailable",
              message: "Store infrastructure is unavailable",
            },
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

export const authorizeStaffRequest = async (request: Request, input: unknown) => {
  const definition = v.parse(StoreDefinitionSchema, input);
  const origin = resolveStoreRequestOrigin(request, definition.profile.slug);
  if (!origin) {
    return false;
  }
  const auth = createStaffAuth(origin);
  if (!auth) {
    return false;
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !session.user.emailVerified) {
    return false;
  }
  return staffQueries.hasActiveAuthority(session.user.id, session.user.email.trim().toLowerCase());
};

export { resolveStoreRequestOrigin } from "./request-origin";

export const createStoreBackend = (input: unknown): StoreBackend => {
  const definition = v.parse(StoreDefinitionSchema, input);
  return {
    api: createApi(definition),
    storefront: createStorefrontReader({
      storeName: definition.profile.name,
      location: definition.profile.location,
      status: "open",
    }),
    background: createStoreBackground(),
  };
};
