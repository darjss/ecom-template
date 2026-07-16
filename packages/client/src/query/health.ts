import type { HealthClientError, HealthResponse } from "@ecom/contracts";
import { queryOptions } from "@tanstack/solid-query";
import { requestHealth } from "../request";

export const healthQueryOptions = () =>
  queryOptions<HealthResponse, HealthClientError>({
    queryKey: ["health"],
    queryFn: requestHealth,
    staleTime: 30_000,
  });
