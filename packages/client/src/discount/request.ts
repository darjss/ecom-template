import {
  DiscountApiErrorSchema,
  DiscountListResponseSchema,
  DiscountMutationResponseSchema,
  type DiscountRuleId,
  type DiscountRuleInput,
} from "@ecom/contracts";
import { createApiClient } from "../eden";
import { requestResult } from "../request";

export type DiscountMutation =
  | { kind: "create"; rule: DiscountRuleInput }
  | { kind: "change"; id: DiscountRuleId; expectedRevision: number; rule: DiscountRuleInput }
  | { kind: "state"; id: DiscountRuleId; expectedRevision: number; state: "active" | "inactive" };

export const requestDiscountRules = () =>
  requestResult(
    () => createApiClient().api.discounts.get(),
    DiscountListResponseSchema,
    DiscountApiErrorSchema,
    "Invalid Discount list response",
  );

export const requestDiscountMutation = (mutation: DiscountMutation) => {
  if (mutation.kind === "create") {
    return requestResult(
      () => createApiClient().api.discounts.post(mutation.rule),
      DiscountMutationResponseSchema,
      DiscountApiErrorSchema,
      "Invalid Discount mutation response",
    );
  }
  if (mutation.kind === "change") {
    return requestResult(
      () =>
        createApiClient()
          .api.discounts({ id: mutation.id })
          .patch({ expectedRevision: mutation.expectedRevision, rule: mutation.rule }),
      DiscountMutationResponseSchema,
      DiscountApiErrorSchema,
      "Invalid Discount mutation response",
    );
  }
  return requestResult(
    () =>
      createApiClient()
        .api.discounts({ id: mutation.id })
        .state.patch({ expectedRevision: mutation.expectedRevision, state: mutation.state }),
    DiscountMutationResponseSchema,
    DiscountApiErrorSchema,
    "Invalid Discount mutation response",
  );
};
