import {
  GroupingApiErrorSchema,
  GroupingListResponseSchema,
  GroupingMutationResponseSchema,
  type CategoryId,
  type CategoryInput,
  type CollectionId,
  type CollectionInput,
  type GroupingMembershipInput,
  type TagId,
  type TagInput,
} from "@ecom/contracts";
import { createApiClient } from "../eden";
import { requestResult } from "../request";

const invalidMutation = "Invalid grouping mutation response";
export const requestGroupings = () =>
  requestResult(
    () => createApiClient().api.catalog.groupings.get(),
    GroupingListResponseSchema,
    GroupingApiErrorSchema,
    "Invalid grouping response",
  );

export const requestCreateCategory = (input: CategoryInput) =>
  requestResult(
    () => createApiClient().api.catalog.categories.post(input),
    GroupingMutationResponseSchema,
    GroupingApiErrorSchema,
    invalidMutation,
  );
export const requestUpdateCategory = (id: CategoryId, input: CategoryInput) =>
  requestResult(
    () => createApiClient().api.catalog.categories({ id }).patch(input),
    GroupingMutationResponseSchema,
    GroupingApiErrorSchema,
    invalidMutation,
  );
export const requestSetCategoryState = (id: CategoryId, state: "active" | "archived") =>
  requestResult(
    () => createApiClient().api.catalog.categories({ id }).state.patch({ state }),
    GroupingMutationResponseSchema,
    GroupingApiErrorSchema,
    invalidMutation,
  );
export const requestReplaceCategoryMembership = (id: CategoryId, input: GroupingMembershipInput) =>
  requestResult(
    () => createApiClient().api.catalog.categories({ id }).items.put(input),
    GroupingMutationResponseSchema,
    GroupingApiErrorSchema,
    invalidMutation,
  );

export const requestCreateCollection = (input: CollectionInput) =>
  requestResult(
    () => createApiClient().api.catalog.collections.post(input),
    GroupingMutationResponseSchema,
    GroupingApiErrorSchema,
    invalidMutation,
  );
export const requestUpdateCollection = (id: CollectionId, input: CollectionInput) =>
  requestResult(
    () => createApiClient().api.catalog.collections({ id }).patch(input),
    GroupingMutationResponseSchema,
    GroupingApiErrorSchema,
    invalidMutation,
  );
export const requestSetCollectionState = (id: CollectionId, state: "active" | "archived") =>
  requestResult(
    () => createApiClient().api.catalog.collections({ id }).state.patch({ state }),
    GroupingMutationResponseSchema,
    GroupingApiErrorSchema,
    invalidMutation,
  );
export const requestReplaceCollectionMembership = (
  id: CollectionId,
  input: GroupingMembershipInput,
) =>
  requestResult(
    () => createApiClient().api.catalog.collections({ id }).items.put(input),
    GroupingMutationResponseSchema,
    GroupingApiErrorSchema,
    invalidMutation,
  );

export const requestCreateTag = (input: TagInput) =>
  requestResult(
    () => createApiClient().api.catalog.tags.post(input),
    GroupingMutationResponseSchema,
    GroupingApiErrorSchema,
    invalidMutation,
  );
export const requestUpdateTag = (id: TagId, input: TagInput) =>
  requestResult(
    () => createApiClient().api.catalog.tags({ id }).patch(input),
    GroupingMutationResponseSchema,
    GroupingApiErrorSchema,
    invalidMutation,
  );
export const requestSetTagState = (id: TagId, state: "active" | "archived") =>
  requestResult(
    () => createApiClient().api.catalog.tags({ id }).state.patch({ state }),
    GroupingMutationResponseSchema,
    GroupingApiErrorSchema,
    invalidMutation,
  );
export const requestReplaceTagMembership = (id: TagId, input: GroupingMembershipInput) =>
  requestResult(
    () => createApiClient().api.catalog.tags({ id }).items.put(input),
    GroupingMutationResponseSchema,
    GroupingApiErrorSchema,
    invalidMutation,
  );
