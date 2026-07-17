import {
  ApiErrorSchema,
  CatalogApiErrorSchema,
  CatalogListResponseSchema,
  CatalogProductResponseSchema,
  CreateProductInputSchema,
  CategoryIdSchema,
  CategoryInputSchema,
  CollectionIdSchema,
  CollectionInputSchema,
  GroupingApiErrorSchema,
  GroupingListResponseSchema,
  GroupingMembershipInputSchema,
  GroupingMutationResponseSchema,
  GroupingStateInputSchema,
  TagIdSchema,
  TagInputSchema,
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
  UpdateProductInputSchema,
  HealthResponseSchema,
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
  adjustProductInventory,
  approveStaff,
  attachCatalogImage,
  createProduct,
  changeStaffRole,
  createStaff,
  createStaffAuth,
  createStorefrontReader,
  listCatalog,
  listGroupings,
  listStaff,
  mutateGrouping,
  readCatalogMedia,
  readDatabaseHealth,
  readStaffAuthSession,
  removeStaff,
  retryProductCachePurge,
  revokeStaff,
  transitionProduct,
  updateProduct,
  type CatalogMediaFailure,
  type CatalogOperationFailure,
  type CustomerSmsDelivery,
  type GroupingOperationFailure,
  type StaffOperationFailure,
  type StorefrontReader,
} from "@ecom/kernel";
import { Elysia } from "elysia";
import * as v from "valibot";
import { createCustomerAuthRoutes } from "./customer-routes";
import { resolveStoreRequestOrigin } from "./request-origin";

export { MediaUploadMultipartMaxBytes };

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

const MediaUploadBodySchema = v.strictObject({
  file: v.instance(File),
  position: v.union([v.string(), v.number()]),
  altText: v.string(),
});

const catalogError = (
  failure: CatalogOperationFailure | CatalogMediaFailure,
  status: (code: number, body: unknown) => unknown,
) => {
  const code = failure.code;
  const message =
    code === "duplicate_slug"
      ? "Product slug is already in use"
      : code === "invalid_publication"
        ? "Product publication invariants are not satisfied"
        : code === "invalid_lifecycle"
          ? "Product lifecycle transition is not valid"
          : code === "reservation_blocked"
            ? "Active reservations block this inventory adjustment"
            : code === "inventory_inconsistent"
              ? "Reserved inventory truth requires reconciliation"
              : code === "inventory_limit"
                ? "Inventory on-hand cannot exceed 1,000,000"
                : code === "unsupported_media_type"
                  ? "The declared image type must match JPEG, PNG, or WebP bytes"
                  : code === "invalid_media_bytes"
                    ? "The upload is not a valid JPEG, PNG, or WebP image"
                    : code === "media_too_large"
                      ? "The image must be no larger than 8 MiB"
                      : code === "not_found"
                        ? "Product was not found"
                        : code === "forbidden"
                          ? "Catalog authority is required"
                          : code === "conflict"
                            ? "Inventory changed concurrently"
                            : "Catalog infrastructure is unavailable";
  const httpStatus =
    code === "forbidden"
      ? 403
      : code === "not_found"
        ? 404
        : code === "infrastructure_unavailable"
          ? 503
          : code === "unsupported_media_type" ||
              code === "invalid_media_bytes" ||
              code === "media_too_large"
            ? 422
            : 409;
  return status(
    httpStatus,
    v.parse(CatalogApiErrorSchema, {
      error: {
        code:
          httpStatus === 403
            ? "forbidden"
            : httpStatus === 404
              ? "not_found"
              : httpStatus === 503
                ? "unavailable"
                : httpStatus === 422
                  ? "validation"
                  : "conflict",
        message,
        reason:
          code === "conflict" || code === "infrastructure_unavailable" || code === "forbidden"
            ? undefined
            : code,
        blockers: "blockers" in failure ? failure.blockers : undefined,
      },
    }),
  );
};

const groupingError = (
  failure: GroupingOperationFailure,
  status: (code: number, body: unknown) => unknown,
) => {
  const code = failure.code;
  const httpStatus =
    code === "forbidden"
      ? 403
      : code === "not_found" || code === "parent_not_found"
        ? 404
        : code === "infrastructure_unavailable"
          ? 503
          : 409;
  const messages: Record<GroupingOperationFailure["code"], string> = {
    forbidden: "Catalog authority is required",
    not_found: "Grouping or Product was not found",
    duplicate_slug: "Grouping slug is permanently reserved",
    duplicate_label: "Tag label is already in use",
    invalid_lifecycle: "Grouping lifecycle target is not valid",
    slug_locked: "An activated grouping slug cannot change",
    parent_not_found: "Parent Category was not found",
    category_cycle: "Category parent would create a cycle",
    active_child: "Active child Categories must be resolved before archival",
    duplicate_membership: "A Product may appear only once in a grouping",
    infrastructure_unavailable: "Grouping infrastructure is unavailable",
  };
  return status(
    httpStatus,
    v.parse(GroupingApiErrorSchema, {
      error: {
        code:
          httpStatus === 403
            ? "forbidden"
            : httpStatus === 404
              ? "not_found"
              : httpStatus === 503
                ? "unavailable"
                : "conflict",
        message: messages[code],
        reason: code === "forbidden" || code === "infrastructure_unavailable" ? undefined : code,
      },
    }),
  );
};

const groupingValidation = (status: (code: number, body: unknown) => unknown, message: string) =>
  status(422, v.parse(GroupingApiErrorSchema, { error: { code: "validation", message } }));

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
      apiError("unavailable", "Staff sessions could not be revoked", "session_revocation_failed"),
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
    .post("/catalog/products/:id/images", async ({ body, params, request, status }) => {
      const id = v.safeParse(ProductIdSchema, params.id);
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
    .get("/catalog/groupings", async ({ request, status }) => {
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) return authorization.response;
      const result = await listGroupings(authorization.actor);
      return result.isErr()
        ? groupingError(result.error, status)
        : v.parse(GroupingListResponseSchema, { data: result.value });
    })
    .post("/catalog/categories", async ({ body, request, status }) => {
      const input = v.safeParse(CategoryInputSchema, body);
      if (!input.success) return groupingValidation(status, "Valid Category facts are required");
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) return authorization.response;
      const result = await mutateGrouping(authorization.actor, {
        kind: "create-category",
        input: input.output,
      });
      return result.isErr()
        ? groupingError(result.error, status)
        : v.parse(GroupingMutationResponseSchema, { data: result.value });
    })
    .patch("/catalog/categories/:id", async ({ body, params, request, status }) => {
      const id = v.safeParse(CategoryIdSchema, params.id);
      const input = v.safeParse(CategoryInputSchema, body);
      if (!id.success || !input.success)
        return groupingValidation(status, "Valid Category facts are required");
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) return authorization.response;
      const result = await mutateGrouping(authorization.actor, {
        kind: "update-category",
        id: id.output,
        input: input.output,
      });
      return result.isErr()
        ? groupingError(result.error, status)
        : v.parse(GroupingMutationResponseSchema, { data: result.value });
    })
    .patch("/catalog/categories/:id/state", async ({ body, params, request, status }) => {
      const id = v.safeParse(CategoryIdSchema, params.id);
      const input = v.safeParse(GroupingStateInputSchema, body);
      if (!id.success || !input.success)
        return groupingValidation(status, "Valid Category lifecycle facts are required");
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) return authorization.response;
      const result = await mutateGrouping(authorization.actor, {
        kind: "state-category",
        id: id.output,
        state: input.output.state,
      });
      return result.isErr()
        ? groupingError(result.error, status)
        : v.parse(GroupingMutationResponseSchema, { data: result.value });
    })
    .put("/catalog/categories/:id/products", async ({ body, params, request, status }) => {
      const id = v.safeParse(CategoryIdSchema, params.id);
      const input = v.safeParse(GroupingMembershipInputSchema, body);
      if (!id.success || !input.success)
        return groupingValidation(status, "Valid Category membership is required");
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) return authorization.response;
      const result = await mutateGrouping(authorization.actor, {
        kind: "members-category",
        id: id.output,
        input: input.output,
      });
      return result.isErr()
        ? groupingError(result.error, status)
        : v.parse(GroupingMutationResponseSchema, { data: result.value });
    })
    .post("/catalog/collections", async ({ body, request, status }) => {
      const input = v.safeParse(CollectionInputSchema, body);
      if (!input.success) return groupingValidation(status, "Valid Collection facts are required");
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) return authorization.response;
      const result = await mutateGrouping(authorization.actor, {
        kind: "create-collection",
        input: input.output,
      });
      return result.isErr()
        ? groupingError(result.error, status)
        : v.parse(GroupingMutationResponseSchema, { data: result.value });
    })
    .patch("/catalog/collections/:id", async ({ body, params, request, status }) => {
      const id = v.safeParse(CollectionIdSchema, params.id);
      const input = v.safeParse(CollectionInputSchema, body);
      if (!id.success || !input.success)
        return groupingValidation(status, "Valid Collection facts are required");
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) return authorization.response;
      const result = await mutateGrouping(authorization.actor, {
        kind: "update-collection",
        id: id.output,
        input: input.output,
      });
      return result.isErr()
        ? groupingError(result.error, status)
        : v.parse(GroupingMutationResponseSchema, { data: result.value });
    })
    .patch("/catalog/collections/:id/state", async ({ body, params, request, status }) => {
      const id = v.safeParse(CollectionIdSchema, params.id);
      const input = v.safeParse(GroupingStateInputSchema, body);
      if (!id.success || !input.success)
        return groupingValidation(status, "Valid Collection lifecycle facts are required");
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) return authorization.response;
      const result = await mutateGrouping(authorization.actor, {
        kind: "state-collection",
        id: id.output,
        state: input.output.state,
      });
      return result.isErr()
        ? groupingError(result.error, status)
        : v.parse(GroupingMutationResponseSchema, { data: result.value });
    })
    .put("/catalog/collections/:id/products", async ({ body, params, request, status }) => {
      const id = v.safeParse(CollectionIdSchema, params.id);
      const input = v.safeParse(GroupingMembershipInputSchema, body);
      if (!id.success || !input.success)
        return groupingValidation(status, "Valid ordered Collection membership is required");
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) return authorization.response;
      const result = await mutateGrouping(authorization.actor, {
        kind: "members-collection",
        id: id.output,
        input: input.output,
      });
      return result.isErr()
        ? groupingError(result.error, status)
        : v.parse(GroupingMutationResponseSchema, { data: result.value });
    })
    .post("/catalog/tags", async ({ body, request, status }) => {
      const input = v.safeParse(TagInputSchema, body);
      if (!input.success) return groupingValidation(status, "A valid Tag label is required");
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) return authorization.response;
      const result = await mutateGrouping(authorization.actor, {
        kind: "create-tag",
        input: input.output,
      });
      return result.isErr()
        ? groupingError(result.error, status)
        : v.parse(GroupingMutationResponseSchema, { data: result.value });
    })
    .patch("/catalog/tags/:id", async ({ body, params, request, status }) => {
      const id = v.safeParse(TagIdSchema, params.id);
      const input = v.safeParse(TagInputSchema, body);
      if (!id.success || !input.success)
        return groupingValidation(status, "A valid Tag label is required");
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) return authorization.response;
      const result = await mutateGrouping(authorization.actor, {
        kind: "update-tag",
        id: id.output,
        input: input.output,
      });
      return result.isErr()
        ? groupingError(result.error, status)
        : v.parse(GroupingMutationResponseSchema, { data: result.value });
    })
    .patch("/catalog/tags/:id/state", async ({ body, params, request, status }) => {
      const id = v.safeParse(TagIdSchema, params.id);
      const input = v.safeParse(GroupingStateInputSchema, body);
      if (!id.success || !input.success)
        return groupingValidation(status, "Valid Tag lifecycle facts are required");
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) return authorization.response;
      const result = await mutateGrouping(authorization.actor, {
        kind: "state-tag",
        id: id.output,
        state: input.output.state,
      });
      return result.isErr()
        ? groupingError(result.error, status)
        : v.parse(GroupingMutationResponseSchema, { data: result.value });
    })
    .put("/catalog/tags/:id/products", async ({ body, params, request, status }) => {
      const id = v.safeParse(TagIdSchema, params.id);
      const input = v.safeParse(GroupingMembershipInputSchema, body);
      if (!id.success || !input.success)
        return groupingValidation(status, "Valid Tag membership is required");
      const authorization = await authorizeRoute(request, definition, status);
      if (!authorization.authorized) return authorization.response;
      const result = await mutateGrouping(authorization.actor, {
        kind: "members-tag",
        id: id.output,
        input: input.output,
      });
      return result.isErr()
        ? groupingError(result.error, status)
        : v.parse(GroupingMutationResponseSchema, { data: result.value });
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
  };
};
