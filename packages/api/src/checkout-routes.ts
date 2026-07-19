import {
  CheckoutApiErrorSchema,
  CheckoutOptionsResponseSchema,
  CheckoutQuoteInputSchema,
  CheckoutQuoteResponseSchema,
  PlaceOrderInputSchema,
  PlaceOrderResponseSchema,
  type StoreDefinition,
} from "@ecom/contracts";
import {
  placeOrder,
  quoteCheckout,
  readCheckoutOptions,
  readCustomerSession,
  type CheckoutFailure,
} from "@ecom/kernel";
import { createPipeHandlers } from "dismatch";
import { Elysia } from "elysia";
import * as v from "valibot";
import { resolveStoreRequestOrigin } from "./request-origin";

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
  quantity_exceeded: () => ({
    status: 422,
    code: "validation" as const,
    message: "Aggregate Variant demand exceeds the Checkout limit",
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
  commercial_changed: () => ({
    status: 409,
    code: "conflict" as const,
    message: "Commercial facts changed; accept the current quote before placement",
  }),
  idempotency_conflict: () => ({
    status: 409,
    code: "conflict" as const,
    message: "The placement key was already used for different intent",
  }),
  bank_transfer_unavailable: () => ({
    status: 422,
    code: "validation" as const,
    message: "Bank transfer is not currently available",
  }),
  infrastructure_unavailable: () => ({
    status: 503,
    code: "unavailable" as const,
    message: "Checkout quote is unavailable",
  }),
});

export const createCheckoutRoutes = (definition: StoreDefinition) =>
  new Elysia({ aot: false })
    .get("/checkout/options", async ({ status }) => {
      const result = await readCheckoutOptions();
      if (result.isOk()) {
        return v.parse(CheckoutOptionsResponseSchema, { data: result.value });
      }
      return status(
        503,
        v.parse(CheckoutApiErrorSchema, {
          error: { code: "unavailable", message: "Checkout options are unavailable" },
        }),
      );
    })
    .post("/checkout/quote", async ({ body, status }) => {
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
    })
    .post("/checkout/place", async ({ body, request, status }) => {
      const input = v.safeParse(PlaceOrderInputSchema, body);
      if (!input.success) {
        return status(
          422,
          v.parse(CheckoutApiErrorSchema, {
            error: {
              code: "validation",
              message: "Valid accepted quote and contact facts are required",
            },
          }),
        );
      }
      const origin = resolveStoreRequestOrigin(request, definition.profile.slug);
      const session = origin
        ? await readCustomerSession(request, origin)
        : { kind: "anonymous" as const };
      const result = await placeOrder(
        input.output,
        session.kind === "active" ? { id: session.customerId, phone: session.phone } : null,
      );
      if (result.isOk()) {
        return v.parse(PlaceOrderResponseSchema, { data: result.value });
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
            currentQuote: result.error.currentQuote,
          },
        }),
      );
    });
