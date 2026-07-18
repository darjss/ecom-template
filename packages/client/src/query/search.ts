import { queryOptions } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import { requestCatalogSearch, type CatalogSearchRequest } from "../search/request";
import { unwrapRequestResult } from "../request";

type CatalogSearchResult = Awaited<ReturnType<typeof requestCatalogSearch>>;

export const catalogSearchQueryOptions = (input: CatalogSearchRequest) =>
  queryOptions<InferOk<CatalogSearchResult>, InferErr<CatalogSearchResult>>({
    queryKey: ["catalog-search", input],
    queryFn: async ({ signal }) => unwrapRequestResult(await requestCatalogSearch(input, signal)),
    staleTime: 0,
  });
