import {
  AdminOrderApiErrorSchema,
  AdminOrderResponseSchema,
  AdminOrdersResponseSchema,
  CustomerOrdersResponseSchema,
  OrderAccessApiErrorSchema,
  OrderStatusResponseSchema,
  type MongolianPhone,
  type OrderId,
  type OrderStatusToken,
} from "@ecom/contracts";
import { queryOptions } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import { createApiClient } from "./eden";
import { requestResult, unwrapRequestResult } from "./request";

const requestOrderStatus = (token: OrderStatusToken) =>
  requestResult(
    () => createApiClient().api.orders.status({ token }).get(),
    OrderStatusResponseSchema,
    OrderAccessApiErrorSchema,
    "Invalid Order status response",
  );

const requestCustomerOrders = () =>
  requestResult(
    () => createApiClient().api.customer.orders.get(),
    CustomerOrdersResponseSchema,
    OrderAccessApiErrorSchema,
    "Invalid Customer Order history response",
  );

const requestAdminOrders = () =>
  requestResult(
    () => createApiClient().api.admin.orders.get(),
    AdminOrdersResponseSchema,
    AdminOrderApiErrorSchema,
    "Invalid Admin Order list response",
  );

const requestAdminOrder = (id: OrderId) =>
  requestResult(
    () => createApiClient().api.admin.orders({ id }).get(),
    AdminOrderResponseSchema,
    AdminOrderApiErrorSchema,
    "Invalid Admin Order response",
  );

export const customerOrdersQueryKey = ["customer", "orders"] as const;
export const adminOrdersQueryKey = ["admin", "orders"] as const;
const orderStatusKey = (token: OrderStatusToken) => ["order", "status", token] as const;
const adminOrderKey = (id: OrderId) => [...adminOrdersQueryKey, id] as const;
type OrderStatusResult = Awaited<ReturnType<typeof requestOrderStatus>>;
type CustomerOrdersResult = Awaited<ReturnType<typeof requestCustomerOrders>>;
type AdminOrdersResult = Awaited<ReturnType<typeof requestAdminOrders>>;
type AdminOrderResult = Awaited<ReturnType<typeof requestAdminOrder>>;

export const orderStatusQueryOptions = (token: OrderStatusToken) =>
  queryOptions<InferOk<OrderStatusResult>, InferErr<OrderStatusResult>>({
    queryKey: orderStatusKey(token),
    queryFn: async () => unwrapRequestResult(await requestOrderStatus(token)),
  });

export const customerOrdersQueryOptions = (phone: MongolianPhone | undefined) =>
  queryOptions<InferOk<CustomerOrdersResult>, InferErr<CustomerOrdersResult>>({
    queryKey: [...customerOrdersQueryKey, phone],
    queryFn: async () => unwrapRequestResult(await requestCustomerOrders()),
    enabled: phone !== undefined,
  });

export const adminOrdersQueryOptions = () =>
  queryOptions<InferOk<AdminOrdersResult>, InferErr<AdminOrdersResult>>({
    queryKey: adminOrdersQueryKey,
    queryFn: async () => unwrapRequestResult(await requestAdminOrders()),
  });

export const adminOrderQueryOptions = (id: OrderId) =>
  queryOptions<InferOk<AdminOrderResult>, InferErr<AdminOrderResult>>({
    queryKey: adminOrderKey(id),
    queryFn: async () => unwrapRequestResult(await requestAdminOrder(id)),
  });
