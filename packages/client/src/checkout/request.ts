import {
  CheckoutApiErrorSchema,
  CheckoutQuoteResponseSchema,
  type CheckoutQuoteInput,
} from "@ecom/contracts";
import { createApiClient } from "../eden";
import { requestResult } from "../request";

export const requestCheckoutQuote = (input: CheckoutQuoteInput) =>
  requestResult(
    () => createApiClient().api.checkout.quote.post(input),
    CheckoutQuoteResponseSchema,
    CheckoutApiErrorSchema,
    "Invalid Checkout quote response",
  );
