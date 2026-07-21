import {
  DiscountApiErrorSchema,
  DiscountListResponseSchema,
  DiscountMutationResponseSchema,
  GroupingApiErrorSchema,
  GroupingListResponseSchema,
  GroupingMutationResponseSchema,
  HealthApiErrorSchema,
  HealthResponseSchema,
  type CategoryId,
  type CategoryInput,
  type CollectionId,
  type CollectionInput,
  type DiscountRuleId,
  type DiscountRuleInput,
  type GroupingMembershipInput,
  type TagId,
  type TagInput,
} from "@ecom/contracts";
import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import { createApiClient } from "./eden";
import { requestResult, unwrapRequestResult } from "./request";

const groupingQueryKey = ["catalog", "groupings"] as const;
const discountQueryKey = ["discounts"] as const;

const requestHealth = () =>
  requestResult(
    () => createApiClient().api.health.get(),
    HealthResponseSchema,
    HealthApiErrorSchema,
    "Invalid health response",
  );

type HealthResult = Awaited<ReturnType<typeof requestHealth>>;

export const healthQueryOptions = () =>
  queryOptions<InferOk<HealthResult>, InferErr<HealthResult>>({
    queryKey: ["health"],
    queryFn: async () => unwrapRequestResult(await requestHealth()),
    staleTime: 30_000,
  });

type GroupingMutation =
  | { readonly kind: "create-category"; readonly input: CategoryInput }
  | { readonly kind: "update-category"; readonly id: CategoryId; readonly input: CategoryInput }
  | {
      readonly kind: "set-category-state";
      readonly id: CategoryId;
      readonly state: "active" | "archived";
    }
  | {
      readonly kind: "replace-category-membership";
      readonly id: CategoryId;
      readonly input: GroupingMembershipInput;
    }
  | { readonly kind: "create-collection"; readonly input: CollectionInput }
  | {
      readonly kind: "update-collection";
      readonly id: CollectionId;
      readonly input: CollectionInput;
    }
  | {
      readonly kind: "set-collection-state";
      readonly id: CollectionId;
      readonly state: "active" | "archived";
    }
  | {
      readonly kind: "replace-collection-membership";
      readonly id: CollectionId;
      readonly input: GroupingMembershipInput;
    }
  | { readonly kind: "create-tag"; readonly input: TagInput }
  | { readonly kind: "update-tag"; readonly id: TagId; readonly input: TagInput }
  | {
      readonly kind: "set-tag-state";
      readonly id: TagId;
      readonly state: "active" | "archived";
    }
  | {
      readonly kind: "replace-tag-membership";
      readonly id: TagId;
      readonly input: GroupingMembershipInput;
    };

const requestGroupings = () =>
  requestResult(
    () => createApiClient().api.catalog.groupings.get(),
    GroupingListResponseSchema,
    GroupingApiErrorSchema,
    "Invalid grouping response",
  );

const requestGroupingMutation = (mutation: GroupingMutation) => {
  const client = createApiClient();
  const request = () => {
    switch (mutation.kind) {
      case "create-category":
        return client.api.catalog.categories.post(mutation.input);
      case "update-category":
        return client.api.catalog.categories({ id: mutation.id }).patch(mutation.input);
      case "set-category-state":
        return client.api.catalog.categories({ id: mutation.id }).state.patch({
          state: mutation.state,
        });
      case "replace-category-membership":
        return client.api.catalog.categories({ id: mutation.id }).items.put(mutation.input);
      case "create-collection":
        return client.api.catalog.collections.post(mutation.input);
      case "update-collection":
        return client.api.catalog.collections({ id: mutation.id }).patch(mutation.input);
      case "set-collection-state":
        return client.api.catalog.collections({ id: mutation.id }).state.patch({
          state: mutation.state,
        });
      case "replace-collection-membership":
        return client.api.catalog.collections({ id: mutation.id }).items.put(mutation.input);
      case "create-tag":
        return client.api.catalog.tags.post(mutation.input);
      case "update-tag":
        return client.api.catalog.tags({ id: mutation.id }).patch(mutation.input);
      case "set-tag-state":
        return client.api.catalog.tags({ id: mutation.id }).state.patch({ state: mutation.state });
      case "replace-tag-membership":
        return client.api.catalog.tags({ id: mutation.id }).items.put(mutation.input);
    }
  };
  return requestResult(
    request,
    GroupingMutationResponseSchema,
    GroupingApiErrorSchema,
    "Invalid grouping mutation response",
  );
};

type GroupingResult = Awaited<ReturnType<typeof requestGroupings>>;
type GroupingMutationResult = Awaited<ReturnType<typeof requestGroupingMutation>>;

const refreshGroupings = async (queryClient: QueryClient) => {
  await queryClient.invalidateQueries({ queryKey: groupingQueryKey, refetchType: "none" });
  await queryClient.refetchQueries({ queryKey: groupingQueryKey, type: "active" });
};

export const groupingQueryOptions = () =>
  queryOptions<InferOk<GroupingResult>, InferErr<GroupingResult>>({
    queryKey: groupingQueryKey,
    queryFn: async () => unwrapRequestResult(await requestGroupings()),
  });

export const groupingMutationOptions = (queryClient: QueryClient) =>
  mutationOptions<
    InferOk<GroupingMutationResult>,
    InferErr<GroupingMutationResult>,
    GroupingMutation
  >({
    mutationFn: async (mutation) => unwrapRequestResult(await requestGroupingMutation(mutation)),
    onSuccess: async () => refreshGroupings(queryClient),
  });

type DiscountMutation =
  | { readonly kind: "create"; readonly rule: DiscountRuleInput }
  | {
      readonly kind: "change";
      readonly id: DiscountRuleId;
      readonly expectedRevision: number;
      readonly rule: DiscountRuleInput;
    }
  | {
      readonly kind: "state";
      readonly id: DiscountRuleId;
      readonly expectedRevision: number;
      readonly state: "active" | "inactive";
    };

const requestDiscountRules = () =>
  requestResult(
    () => createApiClient().api.discounts.get(),
    DiscountListResponseSchema,
    DiscountApiErrorSchema,
    "Invalid Discount list response",
  );

const requestDiscountMutation = (mutation: DiscountMutation) => {
  if (mutation.kind === "create") {
    return requestResult(
      () => createApiClient().api.discounts.post(mutation.rule),
      DiscountMutationResponseSchema,
      DiscountApiErrorSchema,
      "Invalid Discount mutation response",
    );
  }
  if (mutation.kind === "change") {
    return requestResult(
      () =>
        createApiClient()
          .api.discounts({ id: mutation.id })
          .patch({ expectedRevision: mutation.expectedRevision, rule: mutation.rule }),
      DiscountMutationResponseSchema,
      DiscountApiErrorSchema,
      "Invalid Discount mutation response",
    );
  }
  return requestResult(
    () =>
      createApiClient()
        .api.discounts({ id: mutation.id })
        .state.patch({ expectedRevision: mutation.expectedRevision, state: mutation.state }),
    DiscountMutationResponseSchema,
    DiscountApiErrorSchema,
    "Invalid Discount mutation response",
  );
};

type DiscountResult = Awaited<ReturnType<typeof requestDiscountRules>>;
type DiscountMutationResult = Awaited<ReturnType<typeof requestDiscountMutation>>;

export const discountQueryOptions = () =>
  queryOptions<InferOk<DiscountResult>, InferErr<DiscountResult>>({
    queryKey: discountQueryKey,
    queryFn: async () => unwrapRequestResult(await requestDiscountRules()),
  });

export const discountMutationOptions = (queryClient: QueryClient) =>
  mutationOptions<
    InferOk<DiscountMutationResult>,
    InferErr<DiscountMutationResult>,
    DiscountMutation
  >({
    mutationFn: async (mutation) => unwrapRequestResult(await requestDiscountMutation(mutation)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: discountQueryKey, refetchType: "none" });
      await queryClient.refetchQueries({ queryKey: discountQueryKey, type: "active" });
    },
  });
