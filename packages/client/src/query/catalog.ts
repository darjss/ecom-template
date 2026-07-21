import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import {
  requestCatalog,
  requestCatalogItems,
  requestCatalogMutation,
  type CatalogMutation,
} from "../catalog/request";
import { unwrapRequestResult } from "../request";

export const catalogQueryKey = ["catalog", "products"] as const;
const catalogItemsQueryKey = ["catalog", "items"] as const;

type CatalogResult = Awaited<ReturnType<typeof requestCatalog>>;
type CatalogItemsResult = Awaited<ReturnType<typeof requestCatalogItems>>;
type CatalogMutationResult = Awaited<ReturnType<typeof requestCatalogMutation>>;

export const catalogQueryOptions = () =>
  queryOptions<InferOk<CatalogResult>, InferErr<CatalogResult>>({
    queryKey: catalogQueryKey,
    queryFn: async () => unwrapRequestResult(await requestCatalog()),
  });

export const catalogItemsQueryOptions = () =>
  queryOptions<InferOk<CatalogItemsResult>, InferErr<CatalogItemsResult>>({
    queryKey: catalogItemsQueryKey,
    queryFn: async () => unwrapRequestResult(await requestCatalogItems()),
  });

export const catalogMutationOptions = (queryClient: QueryClient) =>
  mutationOptions<InferOk<CatalogMutationResult>, InferErr<CatalogMutationResult>, CatalogMutation>(
    {
      mutationFn: async (mutation) => unwrapRequestResult(await requestCatalogMutation(mutation)),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: catalogQueryKey, refetchType: "none" });
        await queryClient.refetchQueries({ queryKey: catalogQueryKey, type: "active" });
      },
    },
  );
