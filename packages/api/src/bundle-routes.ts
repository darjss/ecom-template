import {
  BundleApiErrorSchema,
  BundleIdSchema,
  BundleListResponseSchema,
  BundleMutationResponseSchema,
  CatalogItemIdSchema,
  CreateBundleInputSchema,
  PersonalizationListResponseSchema,
  PersonalizationMutationResponseSchema,
  SaveBundleComponentsInputSchema,
  SavePersonalizationsInputSchema,
  UpdateBundleInputSchema,
} from "@ecom/contracts";
import {
  createBundle,
  listBundles,
  readCatalogItemPersonalizations,
  saveBundleComponents,
  saveCatalogItemPersonalizations,
  transitionBundle,
  updateBundle,
  type BundleOperationFailure,
  type StaffActor,
} from "@ecom/kernel";
import { Elysia } from "elysia";
import * as v from "valibot";

type Status = (code: number, body: unknown) => unknown;
type AuthorizeBundleRoute = (
  request: Request,
  status: Status,
) => Promise<
  | { readonly authorized: true; readonly actor: StaffActor }
  | { readonly authorized: false; readonly response: unknown }
>;

const validationError = (status: Status, message: string) =>
  status(
    422,
    v.parse(BundleApiErrorSchema, {
      error: { code: "validation", message },
    }),
  );

const bundleError = (failure: BundleOperationFailure, status: Status) => {
  const httpStatus =
    failure.code === "forbidden"
      ? 403
      : failure.code === "not_found"
        ? 404
        : failure.code === "infrastructure_unavailable"
          ? 503
          : 409;
  const messages: Record<BundleOperationFailure["code"], string> = {
    forbidden: "Catalog authority is required",
    not_found: "Bundle or Catalog Item was not found",
    duplicate_slug: "Catalog slug is already in use",
    invalid_lifecycle: "Bundle lifecycle transition is not valid",
    invalid_publication: "Bundle components must be active Published non-default Variants",
    invalid_component: "Every Bundle component must be a valid Variant",
    duplicate_component: "A Variant may occur only once in a Bundle",
    immutable_components: "Published Bundle component identities and quantities are locked",
    invalid_personalization: "Personalization definitions are invalid",
    infrastructure_unavailable: "Bundle infrastructure is unavailable",
  };
  return status(
    httpStatus,
    v.parse(BundleApiErrorSchema, {
      error: {
        code:
          httpStatus === 403
            ? "forbidden"
            : httpStatus === 404
              ? "not_found"
              : httpStatus === 503
                ? "unavailable"
                : "conflict",
        message: messages[failure.code],
        reason:
          failure.code === "forbidden" || failure.code === "infrastructure_unavailable"
            ? undefined
            : failure.code,
      },
    }),
  );
};

export const createBundleRoutes = (authorize: AuthorizeBundleRoute) =>
  new Elysia({ aot: false })
    .get("/catalog/bundles", async ({ request, status }) => {
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await listBundles(authorization.actor);
      return result.isErr()
        ? bundleError(result.error, status)
        : v.parse(BundleListResponseSchema, { data: result.value });
    })
    .post("/catalog/bundles", async ({ body, request, status }) => {
      const input = v.safeParse(CreateBundleInputSchema, body);
      if (!input.success) {
        return validationError(status, "Valid Bundle facts are required");
      }
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await createBundle(authorization.actor, input.output);
      return result.isErr()
        ? bundleError(result.error, status)
        : v.parse(BundleMutationResponseSchema, { data: result.value });
    })
    .patch("/catalog/bundles/:id", async ({ body, params, request, status }) => {
      const id = v.safeParse(BundleIdSchema, params.id);
      const input = v.safeParse(UpdateBundleInputSchema, body);
      if (!id.success || !input.success) {
        return validationError(status, "Valid Bundle facts are required");
      }
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await updateBundle(authorization.actor, id.output, input.output);
      return result.isErr()
        ? bundleError(result.error, status)
        : v.parse(BundleMutationResponseSchema, { data: result.value });
    })
    .put("/catalog/bundles/:id/components", async ({ body, params, request, status }) => {
      const id = v.safeParse(BundleIdSchema, params.id);
      const input = v.safeParse(SaveBundleComponentsInputSchema, body);
      if (!id.success || !input.success) {
        return validationError(status, "Valid bounded Bundle components are required");
      }
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await saveBundleComponents(authorization.actor, id.output, input.output);
      return result.isErr()
        ? bundleError(result.error, status)
        : v.parse(BundleMutationResponseSchema, { data: result.value });
    })
    .post("/catalog/bundles/:id/:action", async ({ params, request, status }) => {
      const id = v.safeParse(BundleIdSchema, params.id);
      const action = v.safeParse(v.picklist(["publish", "archive", "reactivate"]), params.action);
      if (!id.success || !action.success) {
        return validationError(status, "Valid Bundle lifecycle facts are required");
      }
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await transitionBundle(authorization.actor, id.output, action.output);
      return result.isErr()
        ? bundleError(result.error, status)
        : v.parse(BundleMutationResponseSchema, { data: result.value });
    })
    .get("/catalog/items/:id/personalizations", async ({ params, request, status }) => {
      const id = v.safeParse(CatalogItemIdSchema, params.id);
      if (!id.success) {
        return validationError(status, "A valid Catalog Item ID is required");
      }
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await readCatalogItemPersonalizations(authorization.actor, id.output);
      return result.isErr()
        ? bundleError(result.error, status)
        : v.parse(PersonalizationListResponseSchema, { data: result.value });
    })
    .put("/catalog/items/:id/personalizations", async ({ body, params, request, status }) => {
      const id = v.safeParse(CatalogItemIdSchema, params.id);
      const input = v.safeParse(SavePersonalizationsInputSchema, body);
      if (!id.success || !input.success) {
        return validationError(status, "Valid bounded Personalization definitions are required");
      }
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await saveCatalogItemPersonalizations(
        authorization.actor,
        id.output,
        input.output,
      );
      return result.isErr()
        ? bundleError(result.error, status)
        : v.parse(PersonalizationMutationResponseSchema, { data: result.value });
    });
