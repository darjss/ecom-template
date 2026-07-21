import {
  AdminOrderApiErrorSchema,
  AdminOrderResponseSchema,
  AdminOrdersResponseSchema,
  CustomerOrdersResponseSchema,
  OrderAccessApiErrorSchema,
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

export const requestAdminOrders = () =>
  requestResult(
    () => createApiClient().api.admin.orders.get(),
    AdminOrdersResponseSchema,
    AdminOrderApiErrorSchema,
    "Invalid Admin Order list response",
  );

export const requestAdminOrder = (id: OrderId) =>
  requestResult(
    () => createApiClient().api.admin.orders({ id }).get(),
    AdminOrderResponseSchema,
    AdminOrderApiErrorSchema,
    "Invalid Admin Order response",
  );
