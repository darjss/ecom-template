import {
  BundleApiErrorSchema,
  BundleIdSchema,
  BundleListResponseSchema,
  BundleMutationResponseSchema,
  DiscountApiErrorSchema,
  DiscountListResponseSchema,
  DiscountMutationResponseSchema,
  GroupingApiErrorSchema,
  GroupingCachePurgeResponseSchema,
  GroupingListResponseSchema,
  GroupingMutationResponseSchema,
  HealthApiErrorSchema,
  HealthResponseSchema,
  PersonalizationListResponseSchema,
  PersonalizationMutationResponseSchema,
  type BundleId,
  type CatalogItemId,
  type CategoryId,
  type CategoryInput,
  type CollectionId,
  type CollectionInput,
  type CreateBundleInput,
  type DiscountRuleId,
  type DiscountRuleInput,
  type GroupingMembershipInput,
  type SaveBundleComponentsInput,
  type SavePersonalizationsInput,
  type TagId,
  type TagInput,
  type UpdateBundleInput,
} from "@ecom/contracts";
import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import * as v from "valibot";
import { createApiClient } from "./eden";
import { catalogQueryKey } from "./query/catalog";
import { requestResult, unwrapRequestResult } from "./request";

const bundleQueryKey = ["catalog", "bundles"] as const;
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

type BundleMutation =
  | ({ readonly kind: "create" } & CreateBundleInput)
  | ({ readonly kind: "update"; readonly id: BundleId } & UpdateBundleInput)
  | ({ readonly kind: "save-components"; readonly id: BundleId } & SaveBundleComponentsInput)
  | { readonly kind: "retry-cache-purge"; readonly id: BundleId }
  | { readonly kind: "publish" | "archive" | "reactivate"; readonly id: BundleId };

const requestBundles = () =>
  requestResult(
    () => createApiClient().api.catalog.bundles.get(),
    BundleListResponseSchema,
    BundleApiErrorSchema,
    "Invalid Bundle response",
  );

const requestBundleMutation = (mutation: BundleMutation) => {
  const client = createApiClient();
  const request = () =>
    mutation.kind === "create"
      ? client.api.catalog.bundles.post({
          name: mutation.name,
          slug: mutation.slug,
          description: mutation.description,
          priceMnt: mutation.priceMnt,
        })
      : mutation.kind === "update"
        ? client.api.catalog.bundles({ id: mutation.id }).patch({
            name: mutation.name,
            slug: mutation.slug,
            description: mutation.description,
            priceMnt: mutation.priceMnt,
          })
        : mutation.kind === "save-components"
          ? client.api.catalog.bundles({ id: mutation.id }).components.put({
              components: mutation.components,
            })
          : mutation.kind === "retry-cache-purge"
            ? client.api.catalog.bundles({ id: mutation.id })["cache-purge"].retry.post()
            : client.api.catalog.bundles({ id: mutation.id })({ action: mutation.kind }).post();
  return requestResult(
    request,
    BundleMutationResponseSchema,
    BundleApiErrorSchema,
    "Invalid Bundle mutation response",
  );
};

const requestPersonalizations = (id: CatalogItemId) =>
  requestResult(
    () => createApiClient().api.catalog.items({ id }).personalizations.get(),
    PersonalizationListResponseSchema,
    BundleApiErrorSchema,
    "Invalid Personalization response",
  );

const requestPersonalizationMutation = (id: CatalogItemId, input: SavePersonalizationsInput) =>
  requestResult(
    () => createApiClient().api.catalog.items({ id }).personalizations.put(input),
    PersonalizationMutationResponseSchema,
    BundleApiErrorSchema,
    "Invalid Personalization mutation response",
  );

type BundleResult = Awaited<ReturnType<typeof requestBundles>>;
type BundleMutationResult = Awaited<ReturnType<typeof requestBundleMutation>>;

const personalizationQueryKey = (id: CatalogItemId) => ["catalog", "personalizations", id] as const;

export const refreshCatalogItemOwner = async (queryClient: QueryClient, id: CatalogItemId) => {
  const bundleId = v.safeParse(BundleIdSchema, id);
  const authoritativeKey = bundleId.success ? bundleQueryKey : catalogQueryKey;
  await queryClient.invalidateQueries({ queryKey: authoritativeKey, refetchType: "none" });
  await queryClient.refetchQueries({ queryKey: authoritativeKey, type: "active" });
};

export const bundleQueryOptions = () =>
  queryOptions<InferOk<BundleResult>, InferErr<BundleResult>>({
    queryKey: bundleQueryKey,
    queryFn: async () => unwrapRequestResult(await requestBundles()),
  });

export const bundleMutationOptions = (queryClient: QueryClient) =>
  mutationOptions<InferOk<BundleMutationResult>, InferErr<BundleMutationResult>, BundleMutation>({
    mutationFn: async (mutation) => unwrapRequestResult(await requestBundleMutation(mutation)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: bundleQueryKey, refetchType: "none" }),
        queryClient.invalidateQueries({ queryKey: catalogQueryKey, refetchType: "none" }),
      ]);
      await queryClient.refetchQueries({ queryKey: bundleQueryKey, type: "active" });
    },
  });

export const personalizationQueryOptions = (id: CatalogItemId, enabled = true) =>
  queryOptions({
    queryKey: personalizationQueryKey(id),
    queryFn: async () => unwrapRequestResult(await requestPersonalizations(id)),
    enabled,
  });

export const personalizationMutationOptions = (queryClient: QueryClient, id: CatalogItemId) =>
  mutationOptions({
    mutationFn: async (input: SavePersonalizationsInput) =>
      unwrapRequestResult(await requestPersonalizationMutation(id, input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: personalizationQueryKey(id),
        refetchType: "none",
      });
      await Promise.all([
        queryClient.refetchQueries({ queryKey: personalizationQueryKey(id), type: "active" }),
        refreshCatalogItemOwner(queryClient, id),
      ]);
    },
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

const requestGroupingCachePurge = () =>
  requestResult(
    () => createApiClient().api.catalog.groupings["cache-purge"].retry.post(),
    GroupingCachePurgeResponseSchema,
    GroupingApiErrorSchema,
    "Invalid grouping cache-purge response",
  );

type GroupingResult = Awaited<ReturnType<typeof requestGroupings>>;
type GroupingMutationResult = Awaited<ReturnType<typeof requestGroupingMutation>>;
type GroupingCachePurgeResult = Awaited<ReturnType<typeof requestGroupingCachePurge>>;

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

export const groupingCachePurgeMutationOptions = (queryClient: QueryClient) =>
  mutationOptions<InferOk<GroupingCachePurgeResult>, InferErr<GroupingCachePurgeResult>, void>({
    mutationFn: async () => unwrapRequestResult(await requestGroupingCachePurge()),
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
