import {
  CategoryIdSchema,
  CategoryInputSchema,
  CollectionIdSchema,
  CollectionInputSchema,
  GroupingApiErrorSchema,
  GroupingCachePurgeResponseSchema,
  GroupingListResponseSchema,
  GroupingMembershipInputSchema,
  GroupingMutationResponseSchema,
  GroupingStateInputSchema,
  TagIdSchema,
  TagInputSchema,
} from "@ecom/contracts";
import {
  createCategory,
  createCollection,
  createTag,
  listGroupings,
  replaceCategoryMembership,
  replaceCollectionMembership,
  replaceTagMembership,
  retryGroupingCachePurge,
  setCategoryState,
  setCollectionState,
  setTagState,
  updateCategory,
  updateCollection,
  updateTag,
  type GroupingOperationFailure,
  type StaffActor,
} from "@ecom/kernel";
import { Elysia } from "elysia";
import * as v from "valibot";

type Status = (code: number, body: unknown) => unknown;
type AuthorizeGroupingRoute = (
  request: Request,
  status: Status,
) => Promise<
  | { readonly authorized: true; readonly actor: StaffActor }
  | { readonly authorized: false; readonly response: unknown }
>;

const groupingError = (failure: GroupingOperationFailure, status: Status) => {
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
    not_found: "Grouping or Catalog Item was not found",
    duplicate_slug: "Grouping slug is permanently reserved",
    duplicate_label: "Tag label is already in use",
    invalid_lifecycle: "Grouping lifecycle target is not valid",
    slug_locked: "An activated grouping slug cannot change",
    parent_not_found: "Parent Category was not found",
    category_cycle: "Category parent would create a cycle",
    active_child: "Active child Categories must be resolved before archival",
    active_discount_dependency: "Active Discount Rules must be deactivated before archival",
    inactive_ancestor: "Every ancestor Category must be active before activation",
    concurrent_parent_change: "Category ancestry changed while saving; retry the edit",
    duplicate_membership: "A Catalog Item may appear only once in a grouping",
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

const validation = (status: Status, message: string) =>
  status(422, v.parse(GroupingApiErrorSchema, { error: { code: "validation", message } }));
const mutationResponse = (result: Awaited<ReturnType<typeof createCategory>>, status: Status) =>
  result.isErr()
    ? groupingError(result.error, status)
    : v.parse(GroupingMutationResponseSchema, { data: result.value });

export const createGroupingRoutes = (authorize: AuthorizeGroupingRoute) =>
  new Elysia({ aot: false })
    .get("/catalog/groupings", async ({ request, status }) => {
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await listGroupings(authorization.actor);
      return result.isErr()
        ? groupingError(result.error, status)
        : v.parse(GroupingListResponseSchema, { data: result.value });
    })
    .post("/catalog/groupings/cache-purge/retry", async ({ request, status }) => {
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await retryGroupingCachePurge(authorization.actor);
      return result.isErr()
        ? groupingError(result.error, status)
        : v.parse(GroupingCachePurgeResponseSchema, { data: result.value });
    })
    .post("/catalog/categories", async ({ body, request, status }) => {
      const input = v.safeParse(CategoryInputSchema, body);
      if (!input.success) {
        return validation(status, "Valid Category facts are required");
      }
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      return mutationResponse(await createCategory(authorization.actor, input.output), status);
    })
    .patch("/catalog/categories/:id", async ({ body, params, request, status }) => {
      const id = v.safeParse(CategoryIdSchema, params.id);
      const input = v.safeParse(CategoryInputSchema, body);
      if (!id.success || !input.success) {
        return validation(status, "Valid Category facts are required");
      }
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      return mutationResponse(
        await updateCategory(authorization.actor, id.output, input.output),
        status,
      );
    })
    .patch("/catalog/categories/:id/state", async ({ body, params, request, status }) => {
      const id = v.safeParse(CategoryIdSchema, params.id);
      const input = v.safeParse(GroupingStateInputSchema, body);
      if (!id.success || !input.success) {
        return validation(status, "Valid Category lifecycle facts are required");
      }
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      return mutationResponse(
        await setCategoryState(authorization.actor, id.output, input.output.state),
        status,
      );
    })
    .put("/catalog/categories/:id/items", async ({ body, params, request, status }) => {
      const id = v.safeParse(CategoryIdSchema, params.id);
      const input = v.safeParse(GroupingMembershipInputSchema, body);
      if (!id.success || !input.success) {
        return validation(status, "Valid Category membership is required");
      }
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      return mutationResponse(
        await replaceCategoryMembership(authorization.actor, id.output, input.output),
        status,
      );
    })
    .post("/catalog/collections", async ({ body, request, status }) => {
      const input = v.safeParse(CollectionInputSchema, body);
      if (!input.success) {
        return validation(status, "Valid Collection facts are required");
      }
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      return mutationResponse(await createCollection(authorization.actor, input.output), status);
    })
    .patch("/catalog/collections/:id", async ({ body, params, request, status }) => {
      const id = v.safeParse(CollectionIdSchema, params.id);
      const input = v.safeParse(CollectionInputSchema, body);
      if (!id.success || !input.success) {
        return validation(status, "Valid Collection facts are required");
      }
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      return mutationResponse(
        await updateCollection(authorization.actor, id.output, input.output),
        status,
      );
    })
    .patch("/catalog/collections/:id/state", async ({ body, params, request, status }) => {
      const id = v.safeParse(CollectionIdSchema, params.id);
      const input = v.safeParse(GroupingStateInputSchema, body);
      if (!id.success || !input.success) {
        return validation(status, "Valid Collection lifecycle facts are required");
      }
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      return mutationResponse(
        await setCollectionState(authorization.actor, id.output, input.output.state),
        status,
      );
    })
    .put("/catalog/collections/:id/items", async ({ body, params, request, status }) => {
      const id = v.safeParse(CollectionIdSchema, params.id);
      const input = v.safeParse(GroupingMembershipInputSchema, body);
      if (!id.success || !input.success) {
        return validation(status, "Valid ordered Collection membership is required");
      }
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      return mutationResponse(
        await replaceCollectionMembership(authorization.actor, id.output, input.output),
        status,
      );
    })
    .post("/catalog/tags", async ({ body, request, status }) => {
      const input = v.safeParse(TagInputSchema, body);
      if (!input.success) {
        return validation(status, "A valid Tag label is required");
      }
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      return mutationResponse(await createTag(authorization.actor, input.output), status);
    })
    .patch("/catalog/tags/:id", async ({ body, params, request, status }) => {
      const id = v.safeParse(TagIdSchema, params.id);
      const input = v.safeParse(TagInputSchema, body);
      if (!id.success || !input.success) {
        return validation(status, "A valid Tag label is required");
      }
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      return mutationResponse(
        await updateTag(authorization.actor, id.output, input.output),
        status,
      );
    })
    .patch("/catalog/tags/:id/state", async ({ body, params, request, status }) => {
      const id = v.safeParse(TagIdSchema, params.id);
      const input = v.safeParse(GroupingStateInputSchema, body);
      if (!id.success || !input.success) {
        return validation(status, "Valid Tag lifecycle facts are required");
      }
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      return mutationResponse(
        await setTagState(authorization.actor, id.output, input.output.state),
        status,
      );
    })
    .put("/catalog/tags/:id/items", async ({ body, params, request, status }) => {
      const id = v.safeParse(TagIdSchema, params.id);
      const input = v.safeParse(GroupingMembershipInputSchema, body);
      if (!id.success || !input.success) {
        return validation(status, "Valid Tag membership is required");
      }
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      return mutationResponse(
        await replaceTagMembership(authorization.actor, id.output, input.output),
        status,
      );
    });
