import {
  ApiErrorSchema,
  CatalogApiErrorSchema,
  CatalogItemIdSchema,
  CatalogListResponseSchema,
  CatalogProductResponseSchema,
  CatalogSearchApiErrorSchema,
  CatalogSearchResponseSchema,
  CreateProductInputSchema,
  HealthApiErrorSchema,
  InventoryAdjustmentInputSchema,
  MediaAssetIdSchema,
  MediaFormatSchema,
  MediaUploadFieldsSchema,
  MediaUploadMaxBytes,
  MediaUploadMultipartMaxBytes,
  MediaUploadResponseSchema,
  MediaWidthSchema,
  ProductIdSchema,
  SaveProductOptionsInputSchema,
  UpdateVariantPresentationInputSchema,
  VariantIdSchema,
  UpdateProductInputSchema,
  HealthResponseSchema,
  StoreDefinitionSchema,
  type StoreDefinition,
} from "@ecom/contracts";
import {
  adjustProductInventory,
  attachCatalogImage,
  createLocalOwnerSession,
  createProduct,
  createStaffAuth,
  createStorefrontReader,
  listCatalog,
  readCatalogMedia,
  readDatabaseHealth,
  readStaffAuthSession,
  retryProductCachePurge,
  saveProductOptions,
  searchCatalog,
  setVariantState,
  updateVariantPresentation,
  transitionProduct,
  updateProduct,
  type CatalogMediaFailure,
  type CatalogOperationFailure,
  type CatalogVariantFailure,
  type CustomerSmsDelivery,
  type StorefrontReader,
} from "@ecom/kernel";
import { createPipeHandlers } from "dismatch";
import { Elysia } from "elysia";
import * as v from "valibot";
import { createAvailabilityRoutes } from "./availability-routes";
import { createBundleRoutes } from "./bundle-routes";
import { createCheckoutRoutes } from "./checkout-routes";
import { createCustomerAuthRoutes } from "./customer-routes";
import { createCmsRoutes } from "./cms-routes";
import { createDiscountRoutes } from "./discount-routes";
import { createGroupingRoutes } from "./grouping-routes";
import { createOrderRoutes } from "./order-routes";
import { resolveStoreRequestOrigin } from "./request-origin";
import { parseCatalogSearchParameters } from "./search-parameters";

export { MediaUploadMultipartMaxBytes };
export { parseCmsPreviewDocument } from "./cms-routes";
export { parseCatalogSearchParameters } from "./search-parameters";

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
) => v.parse(ApiErrorSchema, { error: { code, message } });

const LocalStaffLoginBodySchema = v.strictObject({
  email: v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email()),
});

const MediaUploadBodySchema = v.strictObject({
  file: v.instance(File),
  position: v.union([v.string(), v.number()]),
  altText: v.string(),
});

type CatalogFailure = CatalogOperationFailure | CatalogMediaFailure | CatalogVariantFailure;
type CatalogFailureMapping = {
  status: number;
  envelopeCode: "forbidden" | "not_found" | "validation" | "conflict" | "unavailable";
  message: string;
};
const catalogMapping = (
  status: number,
  envelopeCode: CatalogFailureMapping["envelopeCode"],
  message: string,
): CatalogFailureMapping => ({ status, envelopeCode, message });
const catalogConflict = (message: string) => () => catalogMapping(409, "conflict", message);
const catalogFailureMapping = createPipeHandlers<CatalogFailure>(
  "code",
).match<CatalogFailureMapping>({
  forbidden: () => catalogMapping(403, "forbidden", "Catalog authority is required"),
  not_found: () => catalogMapping(404, "not_found", "Requested catalog resource was not found"),
  duplicate_slug: catalogConflict("Product slug is already in use"),
  duplicate_combination: catalogConflict("Each Variant combination must be unique"),
  invalid_combination: catalogConflict("Variant choices must belong to this Product"),
  immutable_configuration: catalogConflict("Published option and combination facts are immutable"),
  media_not_owned: catalogConflict("Variant images must be attached to this Product"),
  published_bundle_dependency: catalogConflict(
    "A Published Bundle depends on this Product or Variant",
  ),
  published_cms_dependency: catalogConflict(
    "Published Homepage content depends on this Catalog Item",
  ),
  invalid_publication: catalogConflict("Product publication invariants are not satisfied"),
  invalid_lifecycle: catalogConflict("Product lifecycle transition is not valid"),
  reservation_blocked: catalogConflict("Active reservations block this inventory adjustment"),
  inventory_inconsistent: catalogConflict("Reserved inventory truth requires reconciliation"),
  inventory_limit: catalogConflict("Inventory on-hand cannot exceed 1,000,000"),
  conflict: catalogConflict("Inventory changed concurrently"),
  unsupported_media_type: () =>
    catalogMapping(
      422,
      "validation",
      "The declared image type must match JPEG, PNG, or WebP bytes",
    ),
  invalid_media_bytes: () =>
    catalogMapping(422, "validation", "The upload is not a valid JPEG, PNG, or WebP image"),
  media_too_large: () =>
    catalogMapping(422, "validation", "The image must be no larger than 8 MiB"),
  infrastructure_unavailable: () =>
    catalogMapping(503, "unavailable", "Catalog infrastructure is unavailable"),
});

const catalogError = (
  failure: CatalogOperationFailure | CatalogMediaFailure | CatalogVariantFailure,
  status: (code: number, body: unknown) => unknown,
) => {
  const mapped = catalogFailureMapping(failure);
  return status(
    mapped.status,
    v.parse(CatalogApiErrorSchema, {
      error: {
        code: mapped.envelopeCode,
        message: mapped.message,
        reason:
          failure.code === "conflict" ||
          failure.code === "infrastructure_unavailable" ||
          failure.code === "forbidden"
            ? undefined
            : failure.code,
        blockers: "blockers" in failure ? failure.blockers : undefined,
      },
    }),
  );
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

const readActor = async (request: Request, definition: StoreDefinition) => {
  const origin = resolveStoreRequestOrigin(request, definition.profile.slug);
  if (!origin) {
    return { kind: "rejected_host" as const };
  }
  const session = await readStaffAuthSession(request, origin);
  return session.kind === "active" ? { kind: "active" as const, actor: session.actor } : session;
};

const authorizeRoute = async (
  request: Request,
  definition: StoreDefinition,
  status: (code: number, body: unknown) => unknown,
) => {
  const state = await readActor(request, definition);
  if (state.kind === "active") {
    return { authorized: true as const, actor: state.actor };
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
    .use(createAvailabilityRoutes())
    .use(createCustomerAuthRoutes(definition, smsGateway))
    .use(createOrderRoutes(definition))
    .use(
      createCmsRoutes(definition, (request, status) => authorizeRoute(request, definition, status)),
    )
    .post("/auth/staff/dev-login", async ({ body, request, status }) => {
      const origin = resolveStoreRequestOrigin(request, definition.profile.slug);
      if (!origin || !new URL(origin).hostname.endsWith(".localhost")) {
        return new Response(null, { status: 404 });
      }
      if (request.headers.get("origin") !== origin) {
        return status(403, apiError("forbidden", "Request origin is not accepted"));
      }
      const input = v.safeParse(LocalStaffLoginBodySchema, body);
      if (!input.success) {
        return status(422, apiError("validation", "A valid email is required"));
      }
      const result = await createLocalOwnerSession(input.output.email, origin);
      if (result.isErr()) {
        return status(503, apiError("unavailable", "Local Staff login is unavailable"));
      }
      return new Response(null, {
        status: 303,
        headers: { location: "/admin", "set-cookie": result.value.cookie },
      });
    })
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
    .get("/catalog/products", async ({ request, status }) => {
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await listCatalog(authorization.actor);
      return result.isErr()
        ? catalogError(result.error, status)
        : v.parse(CatalogListResponseSchema, { data: result.value });
    })
    .post("/catalog/products", async ({ body, request, status }) => {
      const input = v.safeParse(CreateProductInputSchema, body);
      if (!input.success) {
        return status(
          422,
          apiError("validation", "Valid Product and opening inventory facts are required"),
        );
      }
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await createProduct(authorization.actor, input.output);
      return result.isErr()
        ? catalogError(result.error, status)
        : v.parse(CatalogProductResponseSchema, { data: result.value });
    })
    .patch("/catalog/products/:id", async ({ body, params, request, status }) => {
      const id = v.safeParse(ProductIdSchema, params.id);
      const input = v.safeParse(UpdateProductInputSchema, body);
      if (!id.success || !input.success) {
        return status(422, apiError("validation", "Valid Product facts are required"));
      }
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await updateProduct(authorization.actor, id.output, input.output);
      return result.isErr()
        ? catalogError(result.error, status)
        : v.parse(CatalogProductResponseSchema, { data: result.value });
    })
    .put("/catalog/products/:id/options", async ({ body, params, request, status }) => {
      const id = v.safeParse(ProductIdSchema, params.id);
      const input = v.safeParse(SaveProductOptionsInputSchema, body);
      if (!id.success || !input.success) {
        return status(422, apiError("validation", "Valid bounded Product options are required"));
      }
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await saveProductOptions(authorization.actor, id.output, input.output);
      return result.isErr()
        ? catalogError(result.error, status)
        : v.parse(CatalogProductResponseSchema, { data: result.value });
    })
    .patch(
      "/catalog/products/:id/variants/:variantId",
      async ({ body, params, request, status }) => {
        const id = v.safeParse(ProductIdSchema, params.id);
        const variantId = v.safeParse(VariantIdSchema, params.variantId);
        const input = v.safeParse(UpdateVariantPresentationInputSchema, body);
        if (!id.success || !variantId.success || !input.success) {
          return status(422, apiError("validation", "Valid Variant presentation is required"));
        }
        const authorization = await authorizeRoute(request, definition, status);
        if (!authorization.authorized) {
          return authorization.response;
        }
        const result = await updateVariantPresentation(
          authorization.actor,
          id.output,
          variantId.output,
          input.output,
        );
        return result.isErr()
          ? catalogError(result.error, status)
          : v.parse(CatalogProductResponseSchema, { data: result.value });
      },
    )
    .post(
      "/catalog/products/:id/variants/:variantId/:action",
      async ({ params, request, status }) => {
        const id = v.safeParse(ProductIdSchema, params.id);
        const variantId = v.safeParse(VariantIdSchema, params.variantId);
        const action = v.safeParse(v.picklist(["archive", "reactivate"]), params.action);
        if (!id.success || !variantId.success || !action.success) {
          return status(422, apiError("validation", "Valid Variant lifecycle facts are required"));
        }
        const authorization = await authorizeRoute(request, definition, status);
        if (!authorization.authorized) {
          return authorization.response;
        }
        const result = await setVariantState(
          authorization.actor,
          id.output,
          variantId.output,
          action.output === "archive" ? "archived" : "active",
        );
        return result.isErr()
          ? catalogError(result.error, status)
          : v.parse(CatalogProductResponseSchema, { data: result.value });
      },
    )
    .post("/catalog/items/:id/images", async ({ body, params, request, status }) => {
      const id = v.safeParse(CatalogItemIdSchema, params.id);
      const multipart = v.safeParse(MediaUploadBodySchema, body);
      const fields = multipart.success
        ? v.safeParse(MediaUploadFieldsSchema, {
            position: Number(multipart.output.position),
            altText: multipart.output.altText,
          })
        : undefined;
      if (!id.success || !multipart.success || !fields?.success) {
        return status(
          422,
          apiError("validation", "A valid image, position, and alt text are required"),
        );
      }
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      if (multipart.output.file.size > MediaUploadMaxBytes) {
        return catalogError({ code: "media_too_large" }, status);
      }
      const result = await attachCatalogImage(authorization.actor, id.output, {
        declaredContentType: multipart.output.file.type,
        bytes: new Uint8Array(await multipart.output.file.arrayBuffer()),
        position: fields.output.position,
        altText: fields.output.altText,
      });
      return result.isErr()
        ? catalogError(result.error, status)
        : v.parse(MediaUploadResponseSchema, { data: result.value });
    })
    .post("/catalog/products/:id/publish", async ({ params, request, status }) => {
      const id = v.safeParse(ProductIdSchema, params.id);
      if (!id.success) {
        return status(422, apiError("validation", "A valid Product ID is required"));
      }
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await transitionProduct(authorization.actor, id.output, "publish");
      return result.isErr()
        ? catalogError(result.error, status)
        : v.parse(CatalogProductResponseSchema, { data: result.value });
    })
    .post("/catalog/products/:id/archive", async ({ params, request, status }) => {
      const id = v.safeParse(ProductIdSchema, params.id);
      if (!id.success) {
        return status(422, apiError("validation", "A valid Product ID is required"));
      }
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await transitionProduct(authorization.actor, id.output, "archive");
      return result.isErr()
        ? catalogError(result.error, status)
        : v.parse(CatalogProductResponseSchema, { data: result.value });
    })
    .post("/catalog/products/:id/reactivate", async ({ params, request, status }) => {
      const id = v.safeParse(ProductIdSchema, params.id);
      if (!id.success) {
        return status(422, apiError("validation", "A valid Product ID is required"));
      }
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await transitionProduct(authorization.actor, id.output, "reactivate");
      return result.isErr()
        ? catalogError(result.error, status)
        : v.parse(CatalogProductResponseSchema, { data: result.value });
    })
    .post("/catalog/products/:id/cache-purge/retry", async ({ params, request, status }) => {
      const id = v.safeParse(ProductIdSchema, params.id);
      if (!id.success) {
        return status(422, apiError("validation", "A valid Product ID is required"));
      }
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await retryProductCachePurge(authorization.actor, id.output);
      return result.isErr()
        ? catalogError(result.error, status)
        : v.parse(CatalogProductResponseSchema, { data: result.value });
    })
    .post(
      "/catalog/products/:id/inventory-adjustments",
      async ({ body, params, request, status }) => {
        const id = v.safeParse(ProductIdSchema, params.id);
        const input = v.safeParse(InventoryAdjustmentInputSchema, body);
        if (!id.success || !input.success) {
          return status(
            422,
            apiError("validation", "A non-zero inventory delta and reason are required"),
          );
        }
        const authorization = await authorizeRoute(request, definition, status);
        if (!authorization.authorized) {
          return authorization.response;
        }
        const result = await adjustProductInventory(authorization.actor, id.output, input.output);
        return result.isErr()
          ? catalogError(result.error, status)
          : v.parse(CatalogProductResponseSchema, { data: result.value });
      },
    )
    .use(createBundleRoutes((request, status) => authorizeRoute(request, definition, status)))
    .use(createDiscountRoutes((request, status) => authorizeRoute(request, definition, status)))
    .use(createGroupingRoutes((request, status) => authorizeRoute(request, definition, status)))
    .use(createCheckoutRoutes(definition))
    .get("/catalog/search", async ({ request, status }) => {
      const parameters = parseCatalogSearchParameters(new URL(request.url).searchParams, {
        allowEmptyQuery: false,
        allowLimit: true,
      });
      if (!parameters.success) {
        return status(
          400,
          v.parse(CatalogSearchApiErrorSchema, {
            error: {
              code: "validation",
              message: "Valid q, filters, page, and limit parameters are required",
            },
          }),
        );
      }
      const result = await searchCatalog(parameters.value);
      return result.isErr()
        ? status(
            503,
            v.parse(CatalogSearchApiErrorSchema, {
              error: { code: "unavailable", message: "Catalog search is unavailable" },
            }),
          )
        : v.parse(CatalogSearchResponseSchema, result.value);
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

const mediaPathPattern =
  /^\/media\/(media_[0-7][0123456789abcdefghjkmnpqrstvwxyz]{25})\/(320|640|960|1280)\.(avif|webp)$/;

export const isPublicMediaPath = (pathname: string) => mediaPathPattern.test(pathname);

export const servePublicMedia = async (request: Request) => {
  const match = mediaPathPattern.exec(new URL(request.url).pathname);
  const mediaAssetId = v.safeParse(MediaAssetIdSchema, match?.[1]);
  const width = v.safeParse(MediaWidthSchema, Number(match?.[2]));
  const format = v.safeParse(MediaFormatSchema, match?.[3]);
  if (
    (request.method !== "GET" && request.method !== "HEAD") ||
    !mediaAssetId.success ||
    !width.success ||
    !format.success
  ) {
    return privateResponse(
      Response.json(
        { error: { code: "validation", message: "An approved media path is required" } },
        { status: 404 },
      ),
    );
  }
  const result = await readCatalogMedia(mediaAssetId.output, width.output, format.output);
  if (result.isErr()) {
    return privateResponse(
      Response.json(
        {
          error: {
            code: result.error.code === "not_found" ? "not_found" : "unavailable",
            message:
              result.error.code === "not_found"
                ? "Media Asset was not found"
                : "Media delivery is unavailable",
          },
        },
        { status: result.error.code === "not_found" ? 404 : 503 },
      ),
    );
  }
  const transformed = result.value;
  const headers = new Headers(transformed.headers);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("cloudflare-cdn-cache-control", "public, max-age=31536000, immutable");
  headers.delete("set-cookie");
  return new Response(request.method === "HEAD" ? null : transformed.body, {
    status: transformed.status,
    statusText: transformed.statusText,
    headers,
  });
};

export type StoreElysiaApp = ReturnType<typeof createApi>;

export type StoreBackend = {
  readonly api: StoreElysiaApp;
  readonly storefront: StorefrontReader;
};

export const resolveStaffRequest = async (request: Request, input: unknown) => {
  const definition = v.parse(StoreDefinitionSchema, input);
  const origin = resolveStoreRequestOrigin(request, definition.profile.slug);
  return origin ? readStaffAuthSession(request, origin) : { kind: "unauthorized" as const };
};

export { readCanonicalStoreOrigin, resolveStoreRequestOrigin } from "./request-origin";

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
    storefront: createStorefrontReader(
      {
        storeName: definition.profile.name,
        location: definition.profile.location,
        status: "open",
      },
      definition.profile.capabilities,
    ),
  };
};
