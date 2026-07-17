import {
  GroupingApiErrorSchema,
  GroupingListResponseSchema,
  GroupingMutationResponseSchema,
  type CategoryId,
  type CategoryInput,
  type CollectionId,
  type CollectionInput,
  type GroupingMembershipInput,
  type GroupingState,
  type TagId,
  type TagInput,
} from "@ecom/contracts";
import { createApiClient } from "../eden";
import { requestResult } from "../request";

export const requestGroupings = () =>
  requestResult(
    () => createApiClient().api.catalog.groupings.get(),
    GroupingListResponseSchema,
    GroupingApiErrorSchema,
    "Invalid grouping response",
  );

export type GroupingMutation =
  | { readonly kind: "create-category"; readonly input: CategoryInput }
  | { readonly kind: "update-category"; readonly id: CategoryId; readonly input: CategoryInput }
  | { readonly kind: "state-category"; readonly id: CategoryId; readonly state: GroupingState }
  | {
      readonly kind: "members-category";
      readonly id: CategoryId;
      readonly input: GroupingMembershipInput;
    }
  | { readonly kind: "create-collection"; readonly input: CollectionInput }
  | {
      readonly kind: "update-collection";
      readonly id: CollectionId;
      readonly input: CollectionInput;
    }
  | { readonly kind: "state-collection"; readonly id: CollectionId; readonly state: GroupingState }
  | {
      readonly kind: "members-collection";
      readonly id: CollectionId;
      readonly input: GroupingMembershipInput;
    }
  | { readonly kind: "create-tag"; readonly input: TagInput }
  | { readonly kind: "update-tag"; readonly id: TagId; readonly input: TagInput }
  | { readonly kind: "state-tag"; readonly id: TagId; readonly state: GroupingState }
  | { readonly kind: "members-tag"; readonly id: TagId; readonly input: GroupingMembershipInput };

export const requestGroupingMutation = (mutation: GroupingMutation) => {
  const client = createApiClient();
  const request = () =>
    mutation.kind === "create-category"
      ? client.api.catalog.categories.post(mutation.input)
      : mutation.kind === "update-category"
        ? client.api.catalog.categories({ id: mutation.id }).patch(mutation.input)
        : mutation.kind === "state-category"
          ? client.api.catalog
              .categories({ id: mutation.id })
              .state.patch({ state: mutation.state })
          : mutation.kind === "members-category"
            ? client.api.catalog.categories({ id: mutation.id }).products.put(mutation.input)
            : mutation.kind === "create-collection"
              ? client.api.catalog.collections.post(mutation.input)
              : mutation.kind === "update-collection"
                ? client.api.catalog.collections({ id: mutation.id }).patch(mutation.input)
                : mutation.kind === "state-collection"
                  ? client.api.catalog
                      .collections({ id: mutation.id })
                      .state.patch({ state: mutation.state })
                  : mutation.kind === "members-collection"
                    ? client.api.catalog
                        .collections({ id: mutation.id })
                        .products.put(mutation.input)
                    : mutation.kind === "create-tag"
                      ? client.api.catalog.tags.post(mutation.input)
                      : mutation.kind === "update-tag"
                        ? client.api.catalog.tags({ id: mutation.id }).patch(mutation.input)
                        : mutation.kind === "state-tag"
                          ? client.api.catalog
                              .tags({ id: mutation.id })
                              .state.patch({ state: mutation.state })
                          : client.api.catalog
                              .tags({ id: mutation.id })
                              .products.put(mutation.input);
  return requestResult(
    request,
    GroupingMutationResponseSchema,
    GroupingApiErrorSchema,
    "Invalid grouping mutation response",
  );
};
