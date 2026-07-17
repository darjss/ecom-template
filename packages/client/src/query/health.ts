import { queryOptions } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import { requestHealth, unwrapRequestResult } from "../request";

type HealthResult = Awaited<ReturnType<typeof requestHealth>>;

export const healthQueryOptions = () =>
  queryOptions<InferOk<HealthResult>, InferErr<HealthResult>>({
    queryKey: ["health"],
    queryFn: async () => unwrapRequestResult(await requestHealth()),
    staleTime: 30_000,
  });
