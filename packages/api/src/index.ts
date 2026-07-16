import {
  ApiErrorSchema,
  HealthResponseSchema,
  StoreDefinitionSchema,
  type StoreDefinition,
} from "@ecom/contracts";
import {
  createAuthRuntimes,
  createStoreBackground,
  createStorefrontReader,
  readInfrastructureHealth,
  type StoreBackground,
  type StorefrontReader,
} from "@ecom/kernel";
import { Elysia } from "elysia";
import * as v from "valibot";

const unavailableAuthResponse = () =>
  Response.json(
    v.parse(ApiErrorSchema, {
      error: { code: "unavailable", message: "Authentication is not configured" },
    }),
    { status: 503, headers: { "cache-control": "private, no-store" } },
  );

type AuthRuntimes = ReturnType<typeof createAuthRuntimes>;

const createApi = (definition: StoreDefinition, auth: AuthRuntimes) =>
  new Elysia({ aot: false, prefix: "/api" })
    .all("/auth/staff/*", ({ request }) =>
      auth ? auth.staff.handler(request) : unavailableAuthResponse(),
    )
    .all("/auth/customer/*", ({ request }) =>
      auth ? auth.customer.handler(request) : unavailableAuthResponse(),
    )
    .get("/health", async ({ set, status }) => {
      set.headers["cache-control"] = "no-store";
      const infrastructure = await readInfrastructureHealth();
      if (infrastructure.isErr()) {
        return status(
          503,
          v.parse(ApiErrorSchema, {
            error: {
              code: "unavailable",
              message: "Store infrastructure is unavailable",
            },
          }),
        );
      }
      const health = infrastructure.unwrap();
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
  readonly hasStaffSession: (request: Request) => Promise<boolean>;
};

export const createStoreBackend = (input: unknown): StoreBackend => {
  const definition = v.parse(StoreDefinitionSchema, input);
  const auth = createAuthRuntimes(definition.profile.origin);
  return {
    api: createApi(definition, auth),
    storefront: createStorefrontReader({
      storeName: definition.profile.name,
      location: definition.profile.location,
      status: "open",
    }),
    background: createStoreBackground(),
    hasStaffSession: async (request) => {
      if (!auth) {
        return false;
      }
      const session = await auth.staff.api.getSession({ headers: request.headers });
      return session !== null;
    },
  };
};
