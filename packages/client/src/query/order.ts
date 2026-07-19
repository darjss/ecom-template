import type { MongolianPhone, OrderStatusToken } from "@ecom/contracts";
import { queryOptions } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import { requestCustomerOrders, requestOrderStatus } from "../order/request";
import { unwrapRequestResult } from "../request";

export const customerOrdersQueryKey = ["customer", "orders"] as const;
const orderStatusKey = (token: OrderStatusToken) => ["order", "status", token] as const;
type OrderStatusResult = Awaited<ReturnType<typeof requestOrderStatus>>;
type CustomerOrdersResult = Awaited<ReturnType<typeof requestCustomerOrders>>;

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
