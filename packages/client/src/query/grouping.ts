import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import {
  requestGroupingMutation,
  requestGroupings,
  type GroupingMutation,
} from "../grouping/request";
import { unwrapRequestResult } from "../request";

export const groupingQueryKey = ["catalog", "groupings"] as const;
type GroupingResult = Awaited<ReturnType<typeof requestGroupings>>;
type GroupingMutationResult = Awaited<ReturnType<typeof requestGroupingMutation>>;

export const groupingQueryOptions = () =>
  queryOptions<InferOk<GroupingResult>, InferErr<GroupingResult>>({
    queryKey: groupingQueryKey,
    queryFn: async () => unwrapRequestResult(await requestGroupings()),
  });

export const groupingMutationOptions = (queryClient: QueryClient) =>
  mutationOptions<
    InferOk<GroupingMutationResult>,
    InferErr<GroupingMutationResult>,
    GroupingMutation
  >({
    mutationFn: async (mutation) => unwrapRequestResult(await requestGroupingMutation(mutation)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: groupingQueryKey, refetchType: "none" });
      await queryClient.refetchQueries({ queryKey: groupingQueryKey, type: "active" });
    },
  });
