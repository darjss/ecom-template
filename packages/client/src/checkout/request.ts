import {
  CheckoutApiErrorSchema,
  CheckoutOptionsResponseSchema,
  CheckoutQuoteResponseSchema,
  PlaceOrderResponseSchema,
  type CheckoutQuoteInput,
  type PlaceOrderInput,
} from "@ecom/contracts";
import { createApiClient } from "../eden";
import { requestResult } from "../request";

export const requestCheckoutOptions = () =>
  requestResult(
    () => createApiClient().api.checkout.options.get(),
    CheckoutOptionsResponseSchema,
    CheckoutApiErrorSchema,
    "Invalid Checkout options response",
  );

export const requestCheckoutQuote = (input: CheckoutQuoteInput) =>
  requestResult(
    () => createApiClient().api.checkout.quote.post(input),
    CheckoutQuoteResponseSchema,
    CheckoutApiErrorSchema,
    "Invalid Checkout quote response",
  );

export const requestPlaceOrder = (input: PlaceOrderInput) =>
  requestResult(
    () => createApiClient().api.checkout.place.post(input),
    PlaceOrderResponseSchema,
    CheckoutApiErrorSchema,
    "Invalid Order placement response",
  );
