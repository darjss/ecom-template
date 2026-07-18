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
  retryBundleCachePurge,
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

const bundleFailures = {
  forbidden: { status: 403, envelopeCode: "forbidden", message: "Catalog authority is required" },
  not_found: {
    status: 404,
    envelopeCode: "not_found",
    message: "Bundle or Catalog Item was not found",
  },
  duplicate_slug: {
    status: 409,
    envelopeCode: "conflict",
    message: "Catalog slug is already in use",
  },
  invalid_lifecycle: {
    status: 409,
    envelopeCode: "conflict",
    message: "Bundle lifecycle transition is not valid",
  },
  invalid_publication: {
    status: 409,
    envelopeCode: "conflict",
    message: "Bundle components must be active Variants of Published Products",
  },
  invalid_component: {
    status: 409,
    envelopeCode: "conflict",
    message: "Every Bundle component must be a valid Variant",
  },
  duplicate_component: {
    status: 409,
    envelopeCode: "conflict",
    message: "A Variant may occur only once in a Bundle",
  },
  immutable_components: {
    status: 409,
    envelopeCode: "conflict",
    message: "Published Bundle component identities and quantities are locked",
  },
  slug_locked: {
    status: 409,
    envelopeCode: "conflict",
    message: "A Published Bundle slug cannot change",
  },
  published_cms_dependency: {
    status: 409,
    envelopeCode: "conflict",
    message: "Published Homepage content depends on this Bundle",
  },
  invalid_personalization: {
    status: 409,
    envelopeCode: "conflict",
    message: "Personalization definitions are invalid",
  },
  infrastructure_unavailable: {
    status: 503,
    envelopeCode: "unavailable",
    message: "Bundle infrastructure is unavailable",
  },
} as const satisfies Record<
  BundleOperationFailure["code"],
  {
    status: number;
    envelopeCode: "forbidden" | "not_found" | "conflict" | "unavailable";
    message: string;
  }
>;

const bundleError = (failure: BundleOperationFailure, status: Status) => {
  const mapped = bundleFailures[failure.code];
  return status(
    mapped.status,
    v.parse(BundleApiErrorSchema, {
      error: {
        code: mapped.envelopeCode,
        message: mapped.message,
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
    .post("/catalog/bundles/:id/cache-purge/retry", async ({ params, request, status }) => {
      const id = v.safeParse(BundleIdSchema, params.id);
      if (!id.success) {
        return validationError(status, "A valid Bundle ID is required");
      }
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await retryBundleCachePurge(authorization.actor, id.output);
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
