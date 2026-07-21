import {
  AdminOrderResponseSchema,
  CustomerOrdersResponseSchema,
  OrderAccessApiErrorSchema,
  OrderOperationApiErrorSchema,
  OrderStatusResponseSchema,
  type OrderId,
  type OrderStatusToken,
} from "@ecom/contracts";
import { createApiClient } from "../eden";
import { requestResult } from "../request";

export const requestOrderStatus = (token: OrderStatusToken) =>
  requestResult(
    () => createApiClient().api.orders.status({ token }).get(),
    OrderStatusResponseSchema,
    OrderAccessApiErrorSchema,
    "Invalid Order status response",
  );

export const requestCustomerOrders = () =>
  requestResult(
    () => createApiClient().api.customer.orders.get(),
    CustomerOrdersResponseSchema,
    OrderAccessApiErrorSchema,
    "Invalid Customer Order history response",
  );

export const requestAdminOrder = (id: OrderId) =>
  requestResult(
    () => createApiClient().api.admin.orders({ id }).get(),
    AdminOrderResponseSchema,
    OrderOperationApiErrorSchema,
    "Invalid Admin Order response",
  );

export type OrderMutation =
  | { readonly kind: "confirm_payment"; readonly id: OrderId }
  | { readonly kind: "advance_fulfillment"; readonly id: OrderId };

export const requestOrderMutation = (mutation: OrderMutation) => {
  const order = createApiClient().api.admin.orders({ id: mutation.id });
  return requestResult(
    () =>
      mutation.kind === "confirm_payment"
        ? order.payment.confirm.post()
        : order.fulfillment.advance.post(),
    AdminOrderResponseSchema,
    OrderOperationApiErrorSchema,
    "Invalid Order operation response",
  );
};
