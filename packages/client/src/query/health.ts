import {
  ApiErrorSchema,
  HealthResponseSchema,
  type ApiError,
  type HealthResponse,
} from "@ecom/contracts";
import { queryOptions } from "@tanstack/solid-query";
import * as v from "valibot";

export const healthQueryOptions = () =>
  queryOptions<HealthResponse, ApiError>({
    queryKey: ["health"],
    queryFn: async () => {
      const response = await fetch("/api/health", {
        headers: { accept: "application/json" },
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        throw v.parse(ApiErrorSchema, body);
      }
      return v.parse(HealthResponseSchema, body);
    },
    staleTime: 30_000,
  });
