import {
  CustomerAuthApiErrorSchema,
  CustomerOtpAcceptedResponseSchema,
  CustomerSessionResponseSchema,
  type CustomerOtpAcceptedResponse,
  type CustomerSessionResponse,
} from "@ecom/contracts";
import { createApiClient } from "../eden";
import { requestResult } from "../request";

export const requestCustomerSession = () =>
  requestResult(
    () => createApiClient().api.auth.customer.session.get(),
    CustomerSessionResponseSchema,
    CustomerAuthApiErrorSchema,
    "Invalid Customer session response",
  );

export type CustomerAuthMutation =
  | { readonly kind: "request_otp"; readonly phone: string }
  | { readonly kind: "verify_otp"; readonly phone: string; readonly code: string }
  | { readonly kind: "logout" };

export type CustomerAuthMutationResult = CustomerOtpAcceptedResponse | CustomerSessionResponse;

export const requestCustomerAuthMutation = (mutation: CustomerAuthMutation) => {
  const customer = createApiClient().api.auth.customer;
  if (mutation.kind === "request_otp") {
    return requestResult(
      () => customer.otp.post({ phone: mutation.phone }),
      CustomerOtpAcceptedResponseSchema,
      CustomerAuthApiErrorSchema,
      "Invalid Customer Auth response",
    );
  }
  const request = () =>
    mutation.kind === "verify_otp"
      ? customer.otp.verify.post({ phone: mutation.phone, code: mutation.code })
      : customer.logout.post();
  return requestResult(
    request,
    CustomerSessionResponseSchema,
    CustomerAuthApiErrorSchema,
    "Invalid Customer Auth response",
  );
};
