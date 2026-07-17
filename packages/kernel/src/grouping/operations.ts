import type {
  CategoryId,
  CategoryInput,
  CollectionId,
  CollectionInput,
  GroupingMembershipInput,
  GroupingState,
  TagId,
  TagInput,
} from "@ecom/contracts";
import { Result } from "better-result";
import { hasStaffCapability, type StaffActor } from "../staff/operations";
import { groupingQueries } from "./persistence";

export type GroupingOperationFailure = {
  readonly code:
    | "forbidden"
    | "not_found"
    | "duplicate_slug"
    | "duplicate_label"
    | "invalid_lifecycle"
    | "slug_locked"
    | "parent_not_found"
    | "category_cycle"
    | "active_child"
    | "duplicate_membership"
    | "infrastructure_unavailable";
};

export type GroupingMutation =
  | { readonly kind: "create-category"; readonly input: CategoryInput }
  | { readonly kind: "update-category"; readonly id: CategoryId; readonly input: CategoryInput }
  | { readonly kind: "state-category"; readonly id: CategoryId; readonly state: GroupingState }
  | {
      readonly kind: "members-category";
      readonly id: CategoryId;
      readonly input: GroupingMembershipInput;
    }
  | { readonly kind: "create-collection"; readonly input: CollectionInput }
  | {
      readonly kind: "update-collection";
      readonly id: CollectionId;
      readonly input: CollectionInput;
    }
  | { readonly kind: "state-collection"; readonly id: CollectionId; readonly state: GroupingState }
  | {
      readonly kind: "members-collection";
      readonly id: CollectionId;
      readonly input: GroupingMembershipInput;
    }
  | { readonly kind: "create-tag"; readonly input: TagInput }
  | { readonly kind: "update-tag"; readonly id: TagId; readonly input: TagInput }
  | { readonly kind: "state-tag"; readonly id: TagId; readonly state: GroupingState }
  | { readonly kind: "members-tag"; readonly id: TagId; readonly input: GroupingMembershipInput };

const authorize = (actor: StaffActor) => hasStaffCapability(actor.role, "catalog_cms");
const failure = (code: GroupingOperationFailure["code"]) =>
  Result.err<never, GroupingOperationFailure>({ code });

export const listGroupings = async (actor: StaffActor) => {
  if (!authorize(actor)) {
    return failure("forbidden");
  }
  try {
    return Result.ok(await groupingQueries.listAll());
  } catch {
    return failure("infrastructure_unavailable");
  }
};

const duplicateMembership = (input: GroupingMembershipInput) =>
  new Set(input.productIds).size !== input.productIds.length;

export const mutateGrouping = async (actor: StaffActor, mutation: GroupingMutation) => {
  if (!authorize(actor)) {
    return failure("forbidden");
  }
  try {
    if (mutation.kind === "create-category" || mutation.kind === "update-category") {
      const parent = await groupingQueries.validateCategoryParent(
        mutation.kind === "update-category" ? mutation.id : undefined,
        mutation.input.parentId,
      );
      if (parent !== "valid") {
        return failure(parent === "cycle" ? "category_cycle" : "parent_not_found");
      }
    }
    if (mutation.kind === "state-category" && mutation.state === "active") {
      const category = await groupingQueries.findCategory(mutation.id);
      if (!category) {
        return failure("not_found");
      }
      const parent = await groupingQueries.validateCategoryParent(category.id, category.parentId);
      if (parent !== "valid") {
        return failure(parent === "cycle" ? "category_cycle" : "parent_not_found");
      }
    }
    if (
      (mutation.kind === "members-category" ||
        mutation.kind === "members-collection" ||
        mutation.kind === "members-tag") &&
      duplicateMembership(mutation.input)
    ) {
      return failure("duplicate_membership");
    }

    const result =
      mutation.kind === "create-category"
        ? await groupingQueries.createCategory(mutation.input)
        : mutation.kind === "update-category"
          ? await groupingQueries.updateCategory(mutation.id, mutation.input)
          : mutation.kind === "state-category"
            ? await groupingQueries.transitionCategory(mutation.id, mutation.state)
            : mutation.kind === "members-category"
              ? await groupingQueries.replaceCategoryMembership(mutation.id, mutation.input)
              : mutation.kind === "create-collection"
                ? await groupingQueries.createCollection(mutation.input)
                : mutation.kind === "update-collection"
                  ? await groupingQueries.updateCollection(mutation.id, mutation.input)
                  : mutation.kind === "state-collection"
                    ? await groupingQueries.transitionCollection(mutation.id, mutation.state)
                    : mutation.kind === "members-collection"
                      ? await groupingQueries.replaceCollectionMembership(
                          mutation.id,
                          mutation.input,
                        )
                      : mutation.kind === "create-tag"
                        ? await groupingQueries.createTag(mutation.input)
                        : mutation.kind === "update-tag"
                          ? await groupingQueries.updateTag(mutation.id, mutation.input)
                          : mutation.kind === "state-tag"
                            ? await groupingQueries.transitionTag(mutation.id, mutation.state)
                            : await groupingQueries.replaceTagMembership(
                                mutation.id,
                                mutation.input,
                              );
    if (result.kind === "changed") {
      return result.value ? Result.ok(result.value) : failure("infrastructure_unavailable");
    }
    if (result.kind === "product_not_found") {
      return failure("not_found");
    }
    return failure(result.kind);
  } catch {
    return failure("infrastructure_unavailable");
  }
};
