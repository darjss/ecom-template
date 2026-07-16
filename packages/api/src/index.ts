import { ApiErrorSchema, HealthResponseSchema } from "@ecom/contracts";
import {
  createStoreBackground,
  createStorefrontReader,
  readInfrastructureHealth,
  type StoreBackground,
  type StorefrontReader,
} from "@ecom/kernel";
import { Elysia } from "elysia";
import * as v from "valibot";

export type StoreBackendDefinition = {
  readonly storeName: string;
};

const createApi = (definition: StoreBackendDefinition) =>
  new Elysia({ aot: false, prefix: "/api" }).get("/health", async ({ set }) => {
    set.headers["cache-control"] = "no-store";
    try {
      const infrastructure = await readInfrastructureHealth();
      return v.parse(HealthResponseSchema, {
        data: {
          status: "ok",
          ...infrastructure,
          store: definition.storeName,
          checkedAt: new Date().toISOString(),
        },
      });
    } catch {
      set.status = 503;
      return v.parse(ApiErrorSchema, {
        error: {
          code: "service_unavailable",
          message: "Store infrastructure is unavailable",
        },
      });
    }
  });

export type StoreElysiaApp = ReturnType<typeof createApi>;

export type StoreBackend = {
  readonly api: StoreElysiaApp;
  readonly storefront: StorefrontReader;
  readonly background: StoreBackground;
};

export const createStoreBackend = (definition: StoreBackendDefinition): StoreBackend => ({
  api: createApi(definition),
  storefront: createStorefrontReader(definition.storeName),
  background: createStoreBackground(),
});
