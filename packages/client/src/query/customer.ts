import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import {
  requestCustomerAuthMutation,
  requestCustomerSession,
  type CustomerAuthMutation,
} from "../customer/request";
import { unwrapRequestResult } from "../request";
import { customerOrdersQueryKey } from "../orders";

const customerSessionKey = ["customer", "session"] as const;

type CustomerSessionResult = Awaited<ReturnType<typeof requestCustomerSession>>;
type CustomerMutationResult = Awaited<ReturnType<typeof requestCustomerAuthMutation>>;

export const customerSessionQueryOptions = () =>
  queryOptions<InferOk<CustomerSessionResult>, InferErr<CustomerSessionResult>>({
    queryKey: customerSessionKey,
    queryFn: async () => unwrapRequestResult(await requestCustomerSession()),
  });

export const customerAuthMutationOptions = (queryClient: QueryClient) =>
  mutationOptions<
    InferOk<CustomerMutationResult>,
    InferErr<CustomerMutationResult>,
    CustomerAuthMutation
  >({
    mutationFn: async (mutation) =>
      unwrapRequestResult(await requestCustomerAuthMutation(mutation)),
    onSuccess: async (_result, mutation) => {
      if (mutation.kind !== "request_otp") {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: customerSessionKey }),
          queryClient.invalidateQueries({ queryKey: customerOrdersQueryKey }),
        ]);
      }
    },
  });
