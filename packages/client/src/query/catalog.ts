import type { CatalogClientError } from "@ecom/contracts";
import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/solid-query";
import { requestCatalog, requestCatalogMutation, type CatalogMutation } from "../catalog/request";

const catalogQueryKey = ["catalog", "products"] as const;

export const catalogQueryOptions = () =>
  queryOptions<Awaited<ReturnType<typeof requestCatalog>>, CatalogClientError>({
    queryKey: catalogQueryKey,
    queryFn: requestCatalog,
  });

export const catalogMutationOptions = (queryClient: QueryClient) =>
  mutationOptions<
    Awaited<ReturnType<typeof requestCatalogMutation>>,
    CatalogClientError,
    CatalogMutation
  >({
    mutationFn: requestCatalogMutation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: catalogQueryKey, refetchType: "none" });
      await queryClient.refetchQueries({ queryKey: catalogQueryKey, type: "active" });
    },
  });
