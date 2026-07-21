import type { MongolianPhone, OrderId, OrderStatusToken } from "@ecom/contracts";
import { queryOptions } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import {
  requestAdminOrder,
  requestAdminOrders,
  requestCustomerOrders,
  requestOrderStatus,
} from "../order/request";
import { unwrapRequestResult } from "../request";

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
