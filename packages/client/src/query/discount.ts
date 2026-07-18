import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import {
  requestDiscountMutation,
  requestDiscountRules,
  type DiscountMutation,
} from "../discount/request";
import { unwrapRequestResult } from "../request";

const discountQueryKey = ["discounts"] as const;
type ListResult = Awaited<ReturnType<typeof requestDiscountRules>>;
type MutationResult = Awaited<ReturnType<typeof requestDiscountMutation>>;

export const discountQueryOptions = () =>
  queryOptions<InferOk<ListResult>, InferErr<ListResult>>({
    queryKey: discountQueryKey,
    queryFn: async () => unwrapRequestResult(await requestDiscountRules()),
  });
export const discountMutationOptions = (queryClient: QueryClient) =>
  mutationOptions<InferOk<MutationResult>, InferErr<MutationResult>, DiscountMutation>({
    mutationFn: async (mutation) => unwrapRequestResult(await requestDiscountMutation(mutation)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: discountQueryKey, refetchType: "none" });
      await queryClient.refetchQueries({ queryKey: discountQueryKey, type: "active" });
    },
  });
