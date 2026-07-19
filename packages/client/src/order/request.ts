import {
  CustomerOrdersResponseSchema,
  OrderAccessApiErrorSchema,
  OrderStatusResponseSchema,
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

export const requestCustomerOrders = (signal?: AbortSignal) =>
  requestResult(
    () => createApiClient().api.customer.orders.get(signal ? { fetch: { signal } } : undefined),
    CustomerOrdersResponseSchema,
    OrderAccessApiErrorSchema,
    "Invalid Customer Order history response",
  );
