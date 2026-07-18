import type { CheckoutQuoteInput } from "@ecom/contracts";
import { mutationOptions } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import { requestCheckoutQuote } from "../checkout/request";
import { unwrapRequestResult } from "../request";

type QuoteResult = Awaited<ReturnType<typeof requestCheckoutQuote>>;
export const checkoutQuoteMutationOptions = () =>
  mutationOptions<InferOk<QuoteResult>, InferErr<QuoteResult>, CheckoutQuoteInput>({
    mutationFn: async (input) => unwrapRequestResult(await requestCheckoutQuote(input)),
  });
