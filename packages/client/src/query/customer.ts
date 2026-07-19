import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import {
  requestCustomerAuthMutation,
  requestCustomerSession,
  type CustomerAuthMutation,
} from "../customer/request";
import { unwrapRequestResult } from "../request";
import { customerOrdersQueryKey } from "./order";

const customerSessionKey = ["customer", "session"] as const;

type CustomerSessionResult = Awaited<ReturnType<typeof requestCustomerSession>>;
type CustomerMutationResult = Awaited<ReturnType<typeof requestCustomerAuthMutation>>;

export const customerSessionQueryOptions = () =>
  queryOptions<InferOk<CustomerSessionResult>, InferErr<CustomerSessionResult>>({
    queryKey: customerSessionKey,
    queryFn: async ({ signal }) => unwrapRequestResult(await requestCustomerSession(signal)),
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
      if (mutation.kind === "request_otp") {
        return;
      }
      await Promise.all([
        queryClient.cancelQueries({ queryKey: customerSessionKey }),
        queryClient.cancelQueries({ queryKey: customerOrdersQueryKey }),
      ]);
      const sessionReset = queryClient.resetQueries({ queryKey: customerSessionKey });
      queryClient.removeQueries({ queryKey: customerOrdersQueryKey });
      await sessionReset;
    },
  });
