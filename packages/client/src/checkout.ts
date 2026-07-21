import {
  CheckoutApiErrorSchema,
  CheckoutOptionsResponseSchema,
  CheckoutQuoteResponseSchema,
  PlaceOrderResponseSchema,
  type CheckoutQuoteInput,
  type PlaceOrderInput,
} from "@ecom/contracts";
import { mutationOptions, queryOptions } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import { createApiClient } from "./eden";
import { requestResult, unwrapRequestResult } from "./request";

const requestCheckoutOptions = () =>
  requestResult(
    () => createApiClient().api.checkout.options.get(),
    CheckoutOptionsResponseSchema,
    CheckoutApiErrorSchema,
    "Invalid Checkout options response",
  );

const requestCheckoutQuote = (input: CheckoutQuoteInput) =>
  requestResult(
    () => createApiClient().api.checkout.quote.post(input),
    CheckoutQuoteResponseSchema,
    CheckoutApiErrorSchema,
    "Invalid Checkout quote response",
  );

const requestPlaceOrder = (input: PlaceOrderInput) =>
  requestResult(
    () => createApiClient().api.checkout.place.post(input),
    PlaceOrderResponseSchema,
    CheckoutApiErrorSchema,
    "Invalid Order placement response",
  );

type OptionsResult = Awaited<ReturnType<typeof requestCheckoutOptions>>;
type QuoteResult = Awaited<ReturnType<typeof requestCheckoutQuote>>;
type PlacementResult = Awaited<ReturnType<typeof requestPlaceOrder>>;

export const checkoutOptionsQueryOptions = () =>
  queryOptions<InferOk<OptionsResult>, InferErr<OptionsResult>>({
    queryKey: ["checkout", "options"],
    queryFn: async () => unwrapRequestResult(await requestCheckoutOptions()),
  });

export const checkoutQuoteMutationOptions = () =>
  mutationOptions<InferOk<QuoteResult>, InferErr<QuoteResult>, CheckoutQuoteInput>({
    mutationFn: async (input) => unwrapRequestResult(await requestCheckoutQuote(input)),
  });

export const orderPlacementMutationOptions = () =>
  mutationOptions<InferOk<PlacementResult>, InferErr<PlacementResult>, PlaceOrderInput>({
    mutationFn: async (input) => unwrapRequestResult(await requestPlaceOrder(input)),
  });
