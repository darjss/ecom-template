import { HealthResponseSchema, type ApiError, type HealthResponse } from "@ecom/contracts";
import { queryOptions } from "@tanstack/solid-query";
import * as v from "valibot";
import { api } from "../eden";

export const healthQueryOptions = () =>
  queryOptions<HealthResponse, ApiError>({
    queryKey: ["health"],
    queryFn: async () => {
      const response = await api.api.health.get();
      if (response.error) {
        throw response.error.value;
      }
      return v.parse(HealthResponseSchema, response.data);
    },
    staleTime: 30_000,
  });
