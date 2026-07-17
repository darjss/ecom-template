import type { CustomerAuthClientError, CustomerSessionResponse } from "@ecom/contracts";
import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/solid-query";
import {
  requestCustomerAuthMutation,
  requestCustomerSession,
  type CustomerAuthMutation,
  type CustomerAuthMutationResult,
} from "../customer/request";

const customerSessionKey = ["customer", "session"] as const;

export const customerSessionQueryOptions = () =>
  queryOptions<CustomerSessionResponse, CustomerAuthClientError>({
    queryKey: customerSessionKey,
    queryFn: requestCustomerSession,
  });

export const customerAuthMutationOptions = (queryClient: QueryClient) =>
  mutationOptions<CustomerAuthMutationResult, CustomerAuthClientError, CustomerAuthMutation>({
    mutationFn: requestCustomerAuthMutation,
    onSuccess: async (_result, mutation) => {
      if (mutation.kind !== "request_otp") {
        await queryClient.invalidateQueries({ queryKey: customerSessionKey });
      }
    },
  });
