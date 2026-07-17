import {
  CustomerAuthApiErrorSchema,
  CustomerAuthClientErrorSchema,
  CustomerOtpAcceptedResponseSchema,
  CustomerSessionResponseSchema,
  type CustomerAuthClientError,
  type CustomerOtpAcceptedResponse,
  type CustomerSessionResponse,
} from "@ecom/contracts";
import * as v from "valibot";
import { createApiClient } from "../eden";

const clientError = (error: CustomerAuthClientError) =>
  v.parse(CustomerAuthClientErrorSchema, error);

const failure = (source: unknown): CustomerAuthClientError => {
  const parsed = v.safeParse(CustomerAuthApiErrorSchema, source);
  return parsed.success
    ? clientError({ kind: "api", domain: "customer_auth", error: parsed.output.error })
    : clientError({
        kind: "contract",
        domain: "customer_auth",
        message: "Invalid Customer Auth API response",
      });
};

const networkFailure = () =>
  clientError({ kind: "network", domain: "customer_auth", message: "Network unavailable" });

export const requestCustomerSession = async (): Promise<CustomerSessionResponse> => {
  try {
    const response = await createApiClient().api.auth.customer.session.get();
    if (response.error) {
      throw failure(response.error.value);
    }
    const parsed = v.safeParse(CustomerSessionResponseSchema, response.data);
    if (!parsed.success) {
      throw clientError({
        kind: "contract",
        domain: "customer_auth",
        message: "Invalid Customer session response",
      });
    }
    return parsed.output;
  } catch (error) {
    const parsed = v.safeParse(CustomerAuthClientErrorSchema, error);
    throw parsed.success ? parsed.output : networkFailure();
  }
};

export type CustomerAuthMutation =
  | { readonly kind: "request_otp"; readonly phone: string }
  | { readonly kind: "verify_otp"; readonly phone: string; readonly code: string }
  | { readonly kind: "logout" };

export type CustomerAuthMutationResult = CustomerOtpAcceptedResponse | CustomerSessionResponse;

export const requestCustomerAuthMutation = async (
  mutation: CustomerAuthMutation,
): Promise<CustomerAuthMutationResult> => {
  try {
    const customer = createApiClient().api.auth.customer;
    const response =
      mutation.kind === "request_otp"
        ? await customer.otp.post({ phone: mutation.phone })
        : mutation.kind === "verify_otp"
          ? await customer.otp.verify.post({ phone: mutation.phone, code: mutation.code })
          : await customer.logout.post();
    if (response.error) {
      throw failure(response.error.value);
    }
    const schema =
      mutation.kind === "request_otp"
        ? CustomerOtpAcceptedResponseSchema
        : CustomerSessionResponseSchema;
    const parsed = v.safeParse(schema, response.data);
    if (!parsed.success) {
      throw clientError({
        kind: "contract",
        domain: "customer_auth",
        message: "Invalid Customer Auth response",
      });
    }
    return parsed.output;
  } catch (error) {
    const parsed = v.safeParse(CustomerAuthClientErrorSchema, error);
    throw parsed.success ? parsed.output : networkFailure();
  }
};
