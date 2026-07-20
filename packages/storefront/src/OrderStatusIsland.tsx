import { createStoreQueryClient, orderStatusQueryOptions, reportUnauthorized } from "@ecom/client";
import {
  OrderAccessApiErrorSchema,
  OrderStatusTokenSchema,
  type OrderAccessClientError,
  type OrderStatusToken,
} from "@ecom/contracts";
import { QueryClientProvider, createQuery } from "@tanstack/solid-query";
import { createPipeHandlers } from "dismatch";
import { Show, createMemo } from "solid-js";
import * as v from "valibot";
import { OrderSummaryView } from "./OrderSummary";

type OrderAccessApiError = v.InferOutput<typeof OrderAccessApiErrorSchema>["error"];
type OrderAccessApiErrorInput = {
  [Code in OrderAccessApiError["code"]]: { readonly code: Code };
}[OrderAccessApiError["code"]];
const apiErrorMessage = createPipeHandlers<OrderAccessApiErrorInput>("code").match<string>({
  unauthorized: () => "Захиалгын холбоос олдсонгүй.",
  not_found: () => "Захиалгын холбоос олдсонгүй.",
  unavailable: () => "Захиалгын мэдээллийг авч чадсангүй.",
});
const orderErrorMessage = createPipeHandlers<OrderAccessClientError>("kind").match<string>({
  network: () => "Сүлжээний холболтыг шалгаад дахин оролдоно уу.",
  contract: () => "Захиалгын мэдээллийг авч чадсангүй.",
  api: ({ error }) => apiErrorMessage({ code: error.code }),
});

const OrderStatusQuery = (props: { readonly token: OrderStatusToken }) => {
  const order = createQuery(() => orderStatusQueryOptions(props.token));
  return (
    <Show
      when={order.data?.data}
      fallback={
        <p role={order.error ? "alert" : "status"}>
          {order.error ? orderErrorMessage(order.error) : "Захиалгын мэдээллийг ачаалж байна…"}
        </p>
      }
    >
      {(summary) => <OrderSummaryView order={summary()} />}
    </Show>
  );
};

const OrderStatusContent = (props: { readonly token: string }) => {
  const token = createMemo(() => {
    const parsed = v.safeParse(OrderStatusTokenSchema, props.token);
    return parsed.success ? parsed.output : undefined;
  });
  return (
    <Show when={token()} keyed fallback={<p role="alert">Захиалгын холбоос олдсонгүй.</p>}>
      {(validToken) => <OrderStatusQuery token={validToken} />}
    </Show>
  );
};

export const OrderStatusIsland = (props: { readonly token: string }) => {
  const queryClient = createStoreQueryClient(reportUnauthorized);
  return (
    <QueryClientProvider client={queryClient}>
      <OrderStatusContent token={props.token} />
    </QueryClientProvider>
  );
};
