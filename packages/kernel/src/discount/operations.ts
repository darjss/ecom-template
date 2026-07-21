import type { DiscountRuleId, DiscountRuleInput } from "@ecom/contracts";
import { Result } from "better-result";
import { createPipeHandlers } from "dismatch";
import { hasStaffCapability, type StaffActor } from "../staff/operations";
import { discountQueries, type DiscountPersistenceResult } from "./persistence";

type DiscountFailureCode =
  | "forbidden"
  | "not_found"
  | "duplicate_code"
  | "invalid_lifecycle"
  | "invalid_target"
  | "revision_conflict"
  | "infrastructure_unavailable";
export type DiscountOperationFailure = {
  [Code in DiscountFailureCode]: { readonly code: Code };
}[DiscountFailureCode];

const failure = (code: DiscountOperationFailure["code"]) =>
  Result.err<never, DiscountOperationFailure>({ code });
const authorized = (actor: StaffActor) => hasStaffCapability(actor.role, "inventory_discounts");

const mapPersistence = createPipeHandlers<DiscountPersistenceResult>("kind").match<
  Result<unknown, DiscountOperationFailure>
>({
  changed: (result) =>
    result.value ? Result.ok(result.value) : failure("infrastructure_unavailable"),
  duplicate_code: () => failure("duplicate_code"),
  invalid_target: () => failure("invalid_target"),
  infrastructure: () => failure("infrastructure_unavailable"),
});

export const listDiscountRules = async (actor: StaffActor) => {
  if (!authorized(actor)) {
    return failure("forbidden");
  }
  try {
    return Result.ok(await discountQueries.list());
  } catch {
    return failure("infrastructure_unavailable");
  }
};

export const createDiscountRule = async (actor: StaffActor, input: DiscountRuleInput) => {
  if (!authorized(actor)) {
    return failure("forbidden");
  }
  try {
    return mapPersistence(await discountQueries.create(actor, input));
  } catch {
    return failure("infrastructure_unavailable");
  }
};

export const changeDiscountRule = async (
  actor: StaffActor,
  id: DiscountRuleId,
  expectedRevision: number,
  input: DiscountRuleInput,
) => {
  if (!authorized(actor)) {
    return failure("forbidden");
  }
  try {
    const result = await discountQueries.update(actor, id, expectedRevision, input);
    if (result.kind === "changed") {
      return result.value ? Result.ok(result.value) : failure("infrastructure_unavailable");
    }
    return failure(result.kind === "infrastructure" ? "infrastructure_unavailable" : result.kind);
  } catch {
    return failure("infrastructure_unavailable");
  }
};

export const setDiscountRuleState = async (
  actor: StaffActor,
  id: DiscountRuleId,
  expectedRevision: number,
  state: "active" | "inactive",
) => {
  if (!authorized(actor)) {
    return failure("forbidden");
  }
  try {
    const result = await discountQueries.transition(actor, id, expectedRevision, state);
    if (result.kind === "changed") {
      return result.value ? Result.ok(result.value) : failure("infrastructure_unavailable");
    }
    return failure(result.kind);
  } catch {
    return failure("infrastructure_unavailable");
  }
};
