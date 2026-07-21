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
import { uniq } from "es-toolkit";
import { purgeCatalogListingCache } from "../catalog/cache";
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
    | "active_discount_dependency"
    | "inactive_ancestor"
    | "concurrent_parent_change"
    | "duplicate_membership"
    | "infrastructure_unavailable";
};

export type GroupingMutationResult = {
  readonly grouping: Grouping;
  readonly cache: "not_required" | "purged" | "committed_but_not_purged";
  readonly cachePurgeRequestId: string | null;
};

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

const purgeCommittedCatalogChange = async () => {
  const purge = await purgeCatalogListingCache();
  return {
    cache: purge.kind === "purged" ? ("purged" as const) : ("committed_but_not_purged" as const),
    cachePurgeRequestId: purge.requestId,
  };
};

type PersistenceMutationResult =
  | Awaited<ReturnType<typeof groupingQueries.createCategory>>
  | Awaited<ReturnType<typeof groupingQueries.updateCategory>>
  | Awaited<ReturnType<typeof groupingQueries.transitionCategory>>
  | Awaited<ReturnType<typeof groupingQueries.replaceCategoryMembership>>
  | Awaited<ReturnType<typeof groupingQueries.createCollection>>
  | Awaited<ReturnType<typeof groupingQueries.updateCollection>>
  | Awaited<ReturnType<typeof groupingQueries.transitionCollection>>
  | Awaited<ReturnType<typeof groupingQueries.replaceCollectionMembership>>
  | Awaited<ReturnType<typeof groupingQueries.createTag>>
  | Awaited<ReturnType<typeof groupingQueries.updateTag>>
  | Awaited<ReturnType<typeof groupingQueries.transitionTag>>
  | Awaited<ReturnType<typeof groupingQueries.replaceTagMembership>>;

const completeMutation = async (result: PersistenceMutationResult) => {
  if (result.kind === "changed") {
    if (!result.value) {
      return failure("infrastructure_unavailable");
    }
    return Result.ok<GroupingMutationResult, never>({
      grouping: result.value,
      ...(await purgeCommittedCatalogChange()),
    });
  }
  if (result.kind === "catalog_item_not_found") {
    return failure("not_found");
  }
  return failure(result.kind === "infrastructure" ? "infrastructure_unavailable" : result.kind);
};

const duplicateMembership = (input: GroupingMembershipInput) =>
  uniq(input.catalogItemIds).length !== input.catalogItemIds.length;

const runAuthorizedMutation = async (
  actor: StaffActor,
  operation: () => Promise<PersistenceMutationResult>,
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

export const createCategory = async (actor: StaffActor, input: CategoryInput) => {
  if (!authorize(actor)) {
    return failure("forbidden");
  }
  try {
    const parent = await groupingQueries.validateCategoryParent(undefined, input.parentId);
    return parent.kind === "valid"
      ? completeMutation(await groupingQueries.createCategory(input))
      : failure(parent.kind === "cycle" ? "category_cycle" : "parent_not_found");
  } catch {
    return failure("infrastructure_unavailable");
  }
};

export const updateCategory = async (actor: StaffActor, id: CategoryId, input: CategoryInput) => {
  if (!authorize(actor)) {
    return failure("forbidden");
  }
  try {
    const parent = await groupingQueries.validateCategoryParent(id, input.parentId);
    return parent.kind === "valid"
      ? completeMutation(await groupingQueries.updateCategory(id, input, parent.lineage))
      : failure(parent.kind === "cycle" ? "category_cycle" : "parent_not_found");
  } catch {
    return failure("infrastructure_unavailable");
  }
};

export const setCategoryState = async (
  actor: StaffActor,
  id: CategoryId,
  state: "active" | "archived",
) => {
  if (!authorize(actor)) {
    return failure("forbidden");
  }
  try {
    const category = await groupingQueries.findCategory(id);
    if (!category) {
      return failure("not_found");
    }
    const parent = await groupingQueries.validateCategoryParent(category.id, category.parentId);
    if (parent.kind !== "valid") {
      return failure(parent.kind === "cycle" ? "category_cycle" : "parent_not_found");
    }
    if (state === "active" && parent.lineage.some((ancestor) => ancestor.state !== "active")) {
      return failure("inactive_ancestor");
    }
    return completeMutation(await groupingQueries.transitionCategory(id, state, parent.lineage));
  } catch {
    return failure("infrastructure_unavailable");
  }
};

export const replaceCategoryMembership = async (
  actor: StaffActor,
  id: CategoryId,
  input: GroupingMembershipInput,
) => {
  if (!authorize(actor)) {
    return failure("forbidden");
  }
  return duplicateMembership(input)
    ? failure("duplicate_membership")
    : runAuthorizedMutation(actor, () => groupingQueries.replaceCategoryMembership(id, input));
};

export const createCollection = (actor: StaffActor, input: CollectionInput) =>
  runAuthorizedMutation(actor, () => groupingQueries.createCollection(input));
export const updateCollection = (actor: StaffActor, id: CollectionId, input: CollectionInput) =>
  runAuthorizedMutation(actor, () => groupingQueries.updateCollection(id, input));
export const setCollectionState = (
  actor: StaffActor,
  id: CollectionId,
  state: "active" | "archived",
) => runAuthorizedMutation(actor, () => groupingQueries.transitionCollection(id, state));
export const replaceCollectionMembership = (
  actor: StaffActor,
  id: CollectionId,
  input: GroupingMembershipInput,
) => {
  if (!authorize(actor)) {
    return failure("forbidden");
  }
  return duplicateMembership(input)
    ? failure("duplicate_membership")
    : runAuthorizedMutation(actor, () => groupingQueries.replaceCollectionMembership(id, input));
};

export const createTag = (actor: StaffActor, input: TagInput) =>
  runAuthorizedMutation(actor, () => groupingQueries.createTag(input));
export const updateTag = (actor: StaffActor, id: TagId, input: TagInput) =>
  runAuthorizedMutation(actor, () => groupingQueries.updateTag(id, input));
export const setTagState = (actor: StaffActor, id: TagId, state: "active" | "archived") =>
  runAuthorizedMutation(actor, () => groupingQueries.transitionTag(id, state));
export const replaceTagMembership = (
  actor: StaffActor,
  id: TagId,
  input: GroupingMembershipInput,
) => {
  if (!authorize(actor)) {
    return failure("forbidden");
  }
  return duplicateMembership(input)
    ? failure("duplicate_membership")
    : runAuthorizedMutation(actor, () => groupingQueries.replaceTagMembership(id, input));
};
