import type { AvailabilityTarget } from "@ecom/contracts";
import { queryOptions } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import { requestAvailability } from "../availability/request";
import { unwrapRequestResult } from "../request";

export const availabilityFreshnessMs = 15_000;

type AvailabilityResult = Awaited<ReturnType<typeof requestAvailability>>;

export const availabilityQueryOptions = (targets: readonly AvailabilityTarget[], enabled = true) =>
  queryOptions<InferOk<AvailabilityResult>, InferErr<AvailabilityResult>>({
    queryKey: ["availability", targets],
    queryFn: async ({ signal }) =>
      unwrapRequestResult(await requestAvailability({ targets: [...targets] }, signal)),
    staleTime: availabilityFreshnessMs,
    refetchInterval: availabilityFreshnessMs,
    retry: false,
    enabled,
  });
