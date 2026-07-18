import {
  DiscountApiErrorSchema,
  DiscountListResponseSchema,
  DiscountMutationResponseSchema,
  DiscountRuleIdSchema,
  DiscountRuleInputSchema,
  DiscountStateInputSchema,
  DiscountUpdateInputSchema,
} from "@ecom/contracts";
import {
  changeDiscountRule,
  createDiscountRule,
  listDiscountRules,
  setDiscountRuleState,
  type DiscountOperationFailure,
  type StaffActor,
} from "@ecom/kernel";
import { createPipeHandlers } from "dismatch";
import { Elysia } from "elysia";
import * as v from "valibot";

type Status = (code: number, body: unknown) => unknown;
type Authorize = (
  request: Request,
  status: Status,
) => Promise<
  | { readonly authorized: true; readonly actor: StaffActor }
  | { readonly authorized: false; readonly response: unknown }
>;

type DiscountFailureMapping = {
  status: number;
  code: "forbidden" | "not_found" | "conflict" | "unavailable";
  message: string;
};
const mapping = createPipeHandlers<DiscountOperationFailure>("code").match<DiscountFailureMapping>({
  forbidden: () => ({
    status: 403,
    code: "forbidden" as const,
    message: "Discount authority is required",
  }),
  not_found: () => ({
    status: 404,
    code: "not_found" as const,
    message: "Discount Rule was not found",
  }),
  duplicate_code: () => ({
    status: 409,
    code: "conflict" as const,
    message: "Discount code is already in use",
  }),
  invalid_lifecycle: () => ({
    status: 409,
    code: "conflict" as const,
    message: "Discount lifecycle transition is not valid",
  }),
  invalid_target: () => ({
    status: 409,
    code: "conflict" as const,
    message: "Discount target does not exist",
  }),
  revision_conflict: () => ({
    status: 409,
    code: "conflict" as const,
    message: "Discount Rule changed; reload and try again",
  }),
  infrastructure_unavailable: () => ({
    status: 503,
    code: "unavailable" as const,
    message: "Discount infrastructure is unavailable",
  }),
});
const error = (failure: DiscountOperationFailure, status: Status) => {
  const mapped = mapping(failure);
  return status(
    mapped.status,
    v.parse(DiscountApiErrorSchema, {
      error: {
        code: mapped.code,
        message: mapped.message,
        reason:
          failure.code === "forbidden" || failure.code === "infrastructure_unavailable"
            ? undefined
            : failure.code,
      },
    }),
  );
};
const validation = (status: Status) =>
  status(
    422,
    v.parse(DiscountApiErrorSchema, {
      error: { code: "validation", message: "Valid bounded Discount facts are required" },
    }),
  );

export const createDiscountRoutes = (authorize: Authorize) =>
  new Elysia({ aot: false })
    .get("/discounts", async ({ request, status }) => {
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await listDiscountRules(authorization.actor);
      return result.isErr()
        ? error(result.error, status)
        : v.parse(DiscountListResponseSchema, { data: result.value });
    })
    .post("/discounts", async ({ body, request, status }) => {
      const input = v.safeParse(DiscountRuleInputSchema, body);
      if (!input.success) {
        return validation(status);
      }
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await createDiscountRule(authorization.actor, input.output);
      return result.isErr()
        ? error(result.error, status)
        : v.parse(DiscountMutationResponseSchema, { data: result.value });
    })
    .patch("/discounts/:id", async ({ body, params, request, status }) => {
      const id = v.safeParse(DiscountRuleIdSchema, params.id);
      const input = v.safeParse(DiscountUpdateInputSchema, body);
      if (!id.success || !input.success) {
        return validation(status);
      }
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await changeDiscountRule(
        authorization.actor,
        id.output,
        input.output.expectedRevision,
        input.output.rule,
      );
      return result.isErr()
        ? error(result.error, status)
        : v.parse(DiscountMutationResponseSchema, { data: result.value });
    })
    .patch("/discounts/:id/state", async ({ body, params, request, status }) => {
      const id = v.safeParse(DiscountRuleIdSchema, params.id);
      const input = v.safeParse(DiscountStateInputSchema, body);
      if (!id.success || !input.success) {
        return validation(status);
      }
      const authorization = await authorize(request, status);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const result = await setDiscountRuleState(
        authorization.actor,
        id.output,
        input.output.expectedRevision,
        input.output.state,
      );
      return result.isErr()
        ? error(result.error, status)
        : v.parse(DiscountMutationResponseSchema, { data: result.value });
    });
