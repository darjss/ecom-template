import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/solid-query";
import type { InferErr, InferOk, Result as ResultType } from "better-result";
import { requestGroupings } from "../grouping/request";
import { unwrapRequestResult } from "../request";

const groupingQueryKey = ["catalog", "groupings"] as const;
type GroupingResult = Awaited<ReturnType<typeof requestGroupings>>;

export const groupingQueryOptions = () =>
  queryOptions<InferOk<GroupingResult>, InferErr<GroupingResult>>({
    queryKey: groupingQueryKey,
    queryFn: async () => unwrapRequestResult(await requestGroupings()),
  });

export const groupingMutationOptions = <
  Variables,
  RequestResult extends ResultType<unknown, unknown>,
>(
  queryClient: QueryClient,
  request: (variables: Variables) => Promise<RequestResult>,
) =>
  mutationOptions<InferOk<RequestResult>, InferErr<RequestResult>, Variables>({
    mutationFn: async (variables) => unwrapRequestResult(await request(variables)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: groupingQueryKey, refetchType: "none" });
      await queryClient.refetchQueries({ queryKey: groupingQueryKey, type: "active" });
    },
  });
