import type {
  CategoryId,
  CategoryInput,
  CollectionId,
  CollectionInput,
  Grouping,
  GroupingMembershipInput,
  TagId,
  TagInput,
} from "@ecom/contracts";
import { Result } from "better-result";
import { purgeCatalogListingCache } from "../catalog/cache";
import { hasStaffCapability, type StaffActor } from "../staff/operations";
import { groupingQueries, type GroupingPersistenceMutation } from "./persistence";

export type GroupingOperationFailure = {
  readonly code:
    | "forbidden"
    | "not_found"
    | "duplicate_slug"
    | "duplicate_label"
    | "slug_locked"
    | "parent_not_found"
    | "category_cycle"
    | "duplicate_membership"
    | "infrastructure_unavailable";
};

export type GroupingMutationResult = {
  readonly grouping: Grouping;
};

const authorize = (actor: StaffActor) => hasStaffCapability(actor.role, "catalog_cms");
const failure = (code: GroupingOperationFailure["code"]) =>
  Result.err<never, GroupingOperationFailure>({ code });

const completeMutation = async (result: GroupingPersistenceMutation) => {
  if (result.kind === "changed") {
    await purgeCatalogListingCache();
    return Result.ok<GroupingMutationResult, never>({ grouping: result.value });
  }
  if (result.kind === "catalog_item_not_found") {
    return failure("not_found");
  }
  return failure(result.kind === "infrastructure" ? "infrastructure_unavailable" : result.kind);
};

const runMutation = async (
  actor: StaffActor,
  operation: () => Promise<GroupingPersistenceMutation>,
) => {
  if (!authorize(actor)) {
    return failure("forbidden");
  }
  try {
    return await completeMutation(await operation());
  } catch {
    return failure("infrastructure_unavailable");
  }
};

const runMembershipMutation = async (
  actor: StaffActor,
  input: GroupingMembershipInput,
  operation: () => Promise<GroupingPersistenceMutation>,
) => {
  if (new Set(input.catalogItemIds).size !== input.catalogItemIds.length) {
    return failure("duplicate_membership");
  }
  return runMutation(actor, operation);
};

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

export const createCategory = (actor: StaffActor, input: CategoryInput) =>
  runMutation(actor, () => groupingQueries.createCategory(input));
export const updateCategory = (actor: StaffActor, id: CategoryId, input: CategoryInput) =>
  runMutation(actor, () => groupingQueries.updateCategory(id, input));
export const setCategoryState = (actor: StaffActor, id: CategoryId, state: "active" | "archived") =>
  runMutation(actor, () => groupingQueries.setCategoryState(id, state));
export const replaceCategoryMembership = (
  actor: StaffActor,
  id: CategoryId,
  input: GroupingMembershipInput,
) =>
  runMembershipMutation(actor, input, () => groupingQueries.replaceCategoryMembership(id, input));

export const createCollection = (actor: StaffActor, input: CollectionInput) =>
  runMutation(actor, () => groupingQueries.createCollection(input));
export const updateCollection = (actor: StaffActor, id: CollectionId, input: CollectionInput) =>
  runMutation(actor, () => groupingQueries.updateCollection(id, input));
export const setCollectionState = (
  actor: StaffActor,
  id: CollectionId,
  state: "active" | "archived",
) => runMutation(actor, () => groupingQueries.setCollectionState(id, state));
export const replaceCollectionMembership = (
  actor: StaffActor,
  id: CollectionId,
  input: GroupingMembershipInput,
) =>
  runMembershipMutation(actor, input, () => groupingQueries.replaceCollectionMembership(id, input));

export const createTag = (actor: StaffActor, input: TagInput) =>
  runMutation(actor, () => groupingQueries.createTag(input));
export const updateTag = (actor: StaffActor, id: TagId, input: TagInput) =>
  runMutation(actor, () => groupingQueries.updateTag(id, input));
export const setTagState = (actor: StaffActor, id: TagId, state: "active" | "archived") =>
  runMutation(actor, () => groupingQueries.setTagState(id, state));
export const replaceTagMembership = (
  actor: StaffActor,
  id: TagId,
  input: GroupingMembershipInput,
) => runMembershipMutation(actor, input, () => groupingQueries.replaceTagMembership(id, input));
