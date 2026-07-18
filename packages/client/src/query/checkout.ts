import type { CheckoutQuoteInput } from "@ecom/contracts";
import { mutationOptions, queryOptions } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import { requestCheckoutOptions, requestCheckoutQuote } from "../checkout/request";
import { unwrapRequestResult } from "../request";

type OptionsResult = Awaited<ReturnType<typeof requestCheckoutOptions>>;
type QuoteResult = Awaited<ReturnType<typeof requestCheckoutQuote>>;
export const checkoutOptionsQueryOptions = () =>
  queryOptions<InferOk<OptionsResult>, InferErr<OptionsResult>>({
    queryKey: ["checkout", "options"],
    queryFn: async () => unwrapRequestResult(await requestCheckoutOptions()),
  });
export const checkoutQuoteMutationOptions = () =>
  mutationOptions<InferOk<QuoteResult>, InferErr<QuoteResult>, CheckoutQuoteInput>({
    mutationFn: async (input) => unwrapRequestResult(await requestCheckoutQuote(input)),
  });
