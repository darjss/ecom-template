import {
  AdminOrderApiErrorSchema,
  AdminOrderResponseSchema,
  AdminOrdersResponseSchema,
  CustomerOrdersResponseSchema,
  OrderAccessApiErrorSchema,
  OrderIdSchema,
  OrderStatusResponseSchema,
  OrderStatusTokenSchema,
  type StoreDefinition,
} from "@ecom/contracts";
import {
  listAdminOrders,
  listCustomerOrders,
  readAdminOrder,
  readCustomerSession,
  readOrderByStatusToken,
  type AdminOrderFailure,
  type OrderAccessFailure,
  type StaffActor,
} from "@ecom/kernel";
import { createPipeHandlers } from "dismatch";
import { Elysia } from "elysia";
import * as v from "valibot";
import { resolveStoreRequestOrigin } from "./request-origin";
import { forwardSetCookies } from "./set-cookie";

const orderError = (code: "unauthorized" | "not_found" | "unavailable", message: string) =>
  v.parse(OrderAccessApiErrorSchema, { error: { code, message } });

const adminOrderError = (
  code: "unauthorized" | "forbidden" | "not_found" | "validation" | "unavailable",
  message: string,
) => v.parse(AdminOrderApiErrorSchema, { error: { code, message } });

const orderAccessFailure = createPipeHandlers<OrderAccessFailure>("code").match<{
  readonly status: 404 | 503;
  readonly code: "not_found" | "unavailable";
  readonly message: string;
}>({
  not_found: () => ({
    status: 404,
    code: "not_found",
    message: "Order status was not found",
  }),
  infrastructure_unavailable: () => ({
    status: 503,
    code: "unavailable",
    message: "Order status is unavailable",
  }),
});

const adminOrderFailure = createPipeHandlers<AdminOrderFailure>("code").match<{
  readonly status: 403 | 404 | 503;
  readonly code: "forbidden" | "not_found" | "unavailable";
  readonly message: string;
}>({
  forbidden: () => ({
    status: 403,
    code: "forbidden",
    message: "Order authority is required",
  }),
  not_found: () => ({
    status: 404,
    code: "not_found",
    message: "Order was not found",
  }),
  infrastructure_unavailable: () => ({
    status: 503,
    code: "unavailable",
    message: "Orders are unavailable",
  }),
});

type AuthorizeOrderRoute = (
  request: Request,
  status: (code: number, body: unknown) => unknown,
) => Promise<
  | { readonly authorized: true; readonly actor: StaffActor }
  | { readonly authorized: false; readonly response: unknown }
>;

export const createOrderRoutes = (definition: StoreDefinition, authorize: AuthorizeOrderRoute) =>
  new Elysia({ aot: false })
    .get("/orders/status/:token", async ({ params, set, status }) => {
      set.headers["referrer-policy"] = "no-referrer";
      set.headers["x-robots-tag"] = "noindex, nofollow";
      const token = v.safeParse(OrderStatusTokenSchema, params.token);
      if (!token.success) {
        return status(404, orderError("not_found", "Order status was not found"));
      }
      const result = await readOrderByStatusToken(token.output);
      if (result.isErr()) {
        const failure = orderAccessFailure(result.error);
        return status(failure.status, orderError(failure.code, failure.message));
      }
      return v.parse(OrderStatusResponseSchema, { data: result.value });
    })
    .get("/customer/orders", async ({ request, set, status }) => {
      const origin = resolveStoreRequestOrigin(request, definition.profile.slug);
      if (!origin) {
        return status(401, orderError("unauthorized", "Customer authentication is required"));
      }
      const session = await readCustomerSession(request, origin);
      if (session.kind === "unavailable") {
        return status(503, orderError("unavailable", "Customer Order history is unavailable"));
      }
      if (session.kind !== "active") {
        return status(401, orderError("unauthorized", "Customer authentication is required"));
      }
      forwardSetCookies(session.responseHeaders, set.headers);
      set.headers["referrer-policy"] = "no-referrer";
      const result = await listCustomerOrders(session.customerId);
      return result.isErr()
        ? status(503, orderError("unavailable", "Customer Order history is unavailable"))
        : v.parse(CustomerOrdersResponseSchema, { data: { orders: result.value } });
    })
    .get("/admin/orders", async ({ request, status }) => {
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await listAdminOrders(authorization.actor);
      if (result.isErr()) {
        const failure = adminOrderFailure(result.error);
        return status(failure.status, adminOrderError(failure.code, failure.message));
      }
      return v.parse(AdminOrdersResponseSchema, { data: { orders: result.value } });
    })
    .get("/admin/orders/:id", async ({ params, request, status }) => {
      const id = v.safeParse(OrderIdSchema, params.id);
      if (!id.success) {
        return status(404, adminOrderError("not_found", "Order was not found"));
      }
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await readAdminOrder(authorization.actor, id.output);
      if (result.isErr()) {
        const failure = adminOrderFailure(result.error);
        return status(failure.status, adminOrderError(failure.code, failure.message));
      }
      return v.parse(AdminOrderResponseSchema, { data: result.value });
    });
