import { CatalogSearchApiErrorSchema, CatalogSearchResponseSchema } from "@ecom/contracts";
import { queryOptions } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import { createApiClient } from "./eden";
import { requestResult, unwrapRequestResult } from "./request";

type CatalogSearchInput = {
  readonly query: string;
  readonly category?: string;
  readonly collection?: string;
  readonly page: number;
  readonly limit: number;
};

const requestCatalogSearch = (input: CatalogSearchInput, signal?: AbortSignal) =>
  requestResult(
    () =>
      createApiClient().api.catalog.search.get({
        query: {
          q: input.query,
          ...(input.category ? { category: input.category } : {}),
          ...(input.collection ? { collection: input.collection } : {}),
          page: String(input.page),
          limit: String(input.limit),
        },
        ...(signal ? { fetch: { signal } } : {}),
      }),
    CatalogSearchResponseSchema,
    CatalogSearchApiErrorSchema,
    "Invalid catalog search response",
  );

type CatalogSearchResult = Awaited<ReturnType<typeof requestCatalogSearch>>;

export const catalogSearchQueryOptions = (input: CatalogSearchInput) =>
  queryOptions<InferOk<CatalogSearchResult>, InferErr<CatalogSearchResult>>({
    queryKey: ["catalog-search", input],
    queryFn: async ({ signal }) => unwrapRequestResult(await requestCatalogSearch(input, signal)),
    staleTime: 0,
  });
