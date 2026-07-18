import {
  CatalogSearchApiErrorSchema,
  CatalogSearchResponseSchema,
  type CatalogSearchResponse,
} from "@ecom/contracts";
import { createApiClient } from "../eden";
import { requestResult } from "../request";

export type CatalogSearchRequest = {
  readonly query: string;
  readonly category?: string;
  readonly collection?: string;
  readonly page: number;
  readonly limit: number;
};

export const requestCatalogSearch = (input: CatalogSearchRequest, signal?: AbortSignal) =>
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

export type CatalogSearchData = CatalogSearchResponse;
