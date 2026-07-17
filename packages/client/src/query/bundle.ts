import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import type { CatalogItemId, SavePersonalizationsInput } from "@ecom/contracts";
import {
  requestBundleMutation,
  requestBundles,
  requestPersonalizationMutation,
  requestPersonalizations,
  type BundleMutation,
} from "../bundle/request";
import { unwrapRequestResult } from "../request";
import { catalogQueryKey } from "./catalog";

export const bundleQueryKey = ["catalog", "bundles"] as const;
type BundleResult = Awaited<ReturnType<typeof requestBundles>>;
type MutationResult = Awaited<ReturnType<typeof requestBundleMutation>>;

export const bundleQueryOptions = () =>
  queryOptions<InferOk<BundleResult>, InferErr<BundleResult>>({
    queryKey: bundleQueryKey,
    queryFn: async () => unwrapRequestResult(await requestBundles()),
  });

export const personalizationQueryKey = (id: CatalogItemId) =>
  ["catalog", "personalizations", id] as const;

export const personalizationQueryOptions = (id: CatalogItemId) =>
  queryOptions({
    queryKey: personalizationQueryKey(id),
    queryFn: async () => unwrapRequestResult(await requestPersonalizations(id)),
  });

export const personalizationMutationOptions = (queryClient: QueryClient, id: CatalogItemId) =>
  mutationOptions({
    mutationFn: async (input: SavePersonalizationsInput) =>
      unwrapRequestResult(await requestPersonalizationMutation(id, input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: personalizationQueryKey(id) });
    },
  });

export const bundleMutationOptions = (queryClient: QueryClient) =>
  mutationOptions<InferOk<MutationResult>, InferErr<MutationResult>, BundleMutation>({
    mutationFn: async (mutation) => unwrapRequestResult(await requestBundleMutation(mutation)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: bundleQueryKey, refetchType: "none" }),
        queryClient.invalidateQueries({ queryKey: catalogQueryKey, refetchType: "none" }),
      ]);
      await queryClient.refetchQueries({ queryKey: bundleQueryKey, type: "active" });
    },
  });
