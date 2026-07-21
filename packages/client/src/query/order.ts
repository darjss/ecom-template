import type { MongolianPhone, OrderId, OrderStatusToken } from "@ecom/contracts";
import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/solid-query";
import type { InferErr, InferOk } from "better-result";
import {
  requestAdminOrder,
  requestCustomerOrders,
  requestOrderMutation,
  requestOrderStatus,
  type OrderMutation,
} from "../order/request";
import { unwrapRequestResult } from "../request";

export const customerOrdersQueryKey = ["customer", "orders"] as const;
const orderStatusKey = (token: OrderStatusToken) => ["order", "status", token] as const;
const adminOrderKey = (id: OrderId) => ["admin", "orders", id] as const;
type OrderStatusResult = Awaited<ReturnType<typeof requestOrderStatus>>;
type CustomerOrdersResult = Awaited<ReturnType<typeof requestCustomerOrders>>;
type AdminOrderResult = Awaited<ReturnType<typeof requestAdminOrder>>;
type OrderMutationResult = Awaited<ReturnType<typeof requestOrderMutation>>;

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

export const adminOrderQueryOptions = (id: OrderId) =>
  queryOptions<InferOk<AdminOrderResult>, InferErr<AdminOrderResult>>({
    queryKey: adminOrderKey(id),
    queryFn: async () => unwrapRequestResult(await requestAdminOrder(id)),
  });

export const orderMutationOptions = (queryClient: QueryClient) =>
  mutationOptions<InferOk<OrderMutationResult>, InferErr<OrderMutationResult>, OrderMutation>({
    mutationFn: async (mutation) => unwrapRequestResult(await requestOrderMutation(mutation)),
    onSuccess: async (_, mutation) => {
      await queryClient.invalidateQueries({ queryKey: adminOrderKey(mutation.id) });
    },
  });
