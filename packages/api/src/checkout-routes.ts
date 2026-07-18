import {
  CheckoutApiErrorSchema,
  CheckoutQuoteInputSchema,
  CheckoutQuoteResponseSchema,
} from "@ecom/contracts";
import { quoteCheckout, type CheckoutFailure } from "@ecom/kernel";
import { createPipeHandlers } from "dismatch";
import { Elysia } from "elysia";
import * as v from "valibot";

type CheckoutFailureMapping = {
  status: number;
  code: "validation" | "conflict" | "unavailable";
  message: string;
};
const mapping = createPipeHandlers<CheckoutFailure>("code").match<CheckoutFailureMapping>({
  catalog_unavailable: () => ({
    status: 409,
    code: "conflict" as const,
    message: "Some Cart items are no longer purchasable",
  }),
  invalid_personalization: () => ({
    status: 422,
    code: "validation" as const,
    message: "Personalization answers are no longer valid",
  }),
  insufficient_inventory: () => ({
    status: 409,
    code: "conflict" as const,
    message: "Current inventory cannot fulfill the Cart",
  }),
  delivery_unavailable: () => ({
    status: 422,
    code: "validation" as const,
    message: "Delivery is not currently available",
  }),
  pickup_unavailable: () => ({
    status: 422,
    code: "validation" as const,
    message: "The selected Pickup Location is not available",
  }),
  infrastructure_unavailable: () => ({
    status: 503,
    code: "unavailable" as const,
    message: "Checkout quote is unavailable",
  }),
});

export const createCheckoutRoutes = () =>
  new Elysia({ aot: false }).post("/checkout/quote", async ({ body, status }) => {
    const input = v.safeParse(CheckoutQuoteInputSchema, body);
    if (!input.success) {
      return status(
        422,
        v.parse(CheckoutApiErrorSchema, {
          error: {
            code: "validation",
            message: "A valid bounded Cart and fulfillment choice are required",
          },
        }),
      );
    }
    const result = await quoteCheckout(input.output);
    if (result.isOk()) {
      return v.parse(CheckoutQuoteResponseSchema, { data: result.value });
    }
    const mapped = mapping(result.error);
    return status(
      mapped.status,
      v.parse(CheckoutApiErrorSchema, {
        error: {
          code: mapped.code,
          message: mapped.message,
          reason:
            result.error.code === "infrastructure_unavailable" ? undefined : result.error.code,
          linePositions: result.error.linePositions,
        },
      }),
    );
  });
