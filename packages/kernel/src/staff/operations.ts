import type { StaffId, StaffMember, StaffRole } from "@ecom/contracts";
import { Result } from "better-result";
import { deleteStaffUserSessions } from "../auth/runtime";
import { staffQueries, type StaffRecord } from "./persistence";

export type StaffCapability =
  | "staff_auth"
  | "financial"
  | "catalog_cms"
  | "inventory_discounts"
  | "orders_fulfillment"
  | "analytics";

export type StaffActor = {
  readonly staffId: StaffId;
  readonly authUserId: string;
  readonly role: StaffRole;
};

const roleCapabilities: Record<StaffRole, readonly StaffCapability[]> = {
  owner: [
    "staff_auth",
    "financial",
    "catalog_cms",
    "inventory_discounts",
    "orders_fulfillment",
    "analytics",
  ],
  manager: ["financial", "catalog_cms", "inventory_discounts", "orders_fulfillment", "analytics"],
  staff: ["catalog_cms", "inventory_discounts", "orders_fulfillment", "analytics"],
};

export const hasStaffCapability = (role: StaffRole, capability: StaffCapability) =>
  roleCapabilities[role].includes(capability);

export type StaffOperationFailure = {
  readonly code:
    | "forbidden"
    | "not_found"
    | "invalid_transition"
    | "final_owner"
    | "session_revocation_failed"
    | "infrastructure_unavailable";
};

const publicMember = ({ authUserId: _authUserId, ...member }: StaffRecord): StaffMember => member;

const requireOwner = (actor: StaffActor) =>
  hasStaffCapability(actor.role, "staff_auth")
    ? undefined
    : Result.err<never, StaffOperationFailure>({ code: "forbidden" });

const commandContext = (actor: StaffActor) => ({
  actor: { staffId: actor.staffId, role: actor.role },
  correlationId: crypto.randomUUID(),
});

const deleteSessions = async (origin: string, member: StaffRecord) => {
  if (!member.authUserId) {
    return true;
  }
  try {
    return await deleteStaffUserSessions(origin, member.authUserId);
  } catch {
    return false;
  }
};

const completeAuthorityChange = async (
  origin: string,
  sessionOwner: StaffRecord,
  result: StaffRecord,
): Promise<Result<StaffMember, StaffOperationFailure>> =>
  (await deleteSessions(origin, sessionOwner))
    ? Result.ok(publicMember(result))
    : Result.err({ code: "session_revocation_failed" });

export const listStaff = async (
  actor: StaffActor,
): Promise<Result<{ readonly members: readonly StaffMember[] }, StaffOperationFailure>> => {
  const denied = requireOwner(actor);
  if (denied) {
    return denied;
  }
  try {
    return Result.ok({ members: (await staffQueries.list()).map(publicMember) });
  } catch {
    return Result.err({ code: "infrastructure_unavailable" });
  }
};

export type OwnerProvisioningFailure = {
  readonly code: "linked_identity" | "infrastructure_unavailable";
};

export const provisionOwner = async (
  email: string,
): Promise<Result<StaffMember, OwnerProvisioningFailure>> => {
  try {
    const result = await staffQueries.provisionOwner(email);
    return result.kind === "provisioned"
      ? Result.ok(publicMember(result.member))
      : Result.err({ code: "linked_identity" });
  } catch {
    return Result.err({ code: "infrastructure_unavailable" });
  }
};

export const createStaff = async (
  actor: StaffActor,
  email: string,
  role: StaffRole,
): Promise<Result<StaffMember, StaffOperationFailure>> => {
  const denied = requireOwner(actor);
  if (denied) {
    return denied;
  }
  try {
    const member = await staffQueries.createActive(commandContext(actor), email, role);
    return member ? Result.ok(publicMember(member)) : Result.err({ code: "invalid_transition" });
  } catch {
    return Result.err({ code: "infrastructure_unavailable" });
  }
};

export const approveStaff = async (
  actor: StaffActor,
  origin: string,
  id: StaffId,
  role: StaffRole,
): Promise<Result<StaffMember, StaffOperationFailure>> => {
  const denied = requireOwner(actor);
  if (denied) {
    return denied;
  }
  try {
    const before = await staffQueries.findById(id);
    if (!before) {
      return Result.err({ code: "not_found" });
    }
    if (before.status !== "pending" && !(before.status === "active" && before.role === role)) {
      return Result.err({ code: "invalid_transition" });
    }
    if (!(await deleteSessions(origin, before))) {
      return Result.err({ code: "session_revocation_failed" });
    }
    if (before.status === "active") {
      return completeAuthorityChange(origin, before, before);
    }
    const { changed, current } = await staffQueries.approve(commandContext(actor), id, role);
    if (changed) {
      return completeAuthorityChange(origin, changed, changed);
    }
    return current?.status === "active" && current.role === role
      ? completeAuthorityChange(origin, current, current)
      : Result.err({ code: current ? "invalid_transition" : "not_found" });
  } catch {
    return Result.err({ code: "infrastructure_unavailable" });
  }
};

export const changeStaffRole = async (
  actor: StaffActor,
  origin: string,
  id: StaffId,
  role: StaffRole,
): Promise<Result<StaffMember, StaffOperationFailure>> => {
  const denied = requireOwner(actor);
  if (denied) {
    return denied;
  }
  try {
    const before = await staffQueries.findById(id);
    if (!before) {
      return Result.err({ code: "not_found" });
    }
    if (before.status !== "active") {
      return Result.err({ code: "invalid_transition" });
    }
    if (
      before.role === "owner" &&
      role !== "owner" &&
      !(await staffQueries.hasAnotherActiveOwner(id))
    ) {
      return Result.err({ code: "final_owner" });
    }
    if (!(await deleteSessions(origin, before))) {
      return Result.err({ code: "session_revocation_failed" });
    }
    if (before.role === role) {
      return completeAuthorityChange(origin, before, before);
    }
    const { changed, current } = await staffQueries.changeRole(commandContext(actor), id, role);
    if (changed) {
      return completeAuthorityChange(origin, changed, changed);
    }
    if (current?.status === "active" && current.role === role) {
      return completeAuthorityChange(origin, current, current);
    }
    return Result.err({
      code:
        current?.status === "active" && current.role === "owner" && role !== "owner"
          ? "final_owner"
          : current
            ? "invalid_transition"
            : "not_found",
    });
  } catch {
    return Result.err({ code: "infrastructure_unavailable" });
  }
};

export const revokeStaff = async (
  actor: StaffActor,
  origin: string,
  id: StaffId,
): Promise<Result<StaffMember, StaffOperationFailure>> => {
  const denied = requireOwner(actor);
  if (denied) {
    return denied;
  }
  try {
    const before = await staffQueries.findById(id);
    if (!before) {
      return Result.err({ code: "not_found" });
    }
    if (before.status !== "active" && before.status !== "revoked") {
      return Result.err({ code: "invalid_transition" });
    }
    if (
      before.status === "active" &&
      before.role === "owner" &&
      !(await staffQueries.hasAnotherActiveOwner(id))
    ) {
      return Result.err({ code: "final_owner" });
    }
    if (!(await deleteSessions(origin, before))) {
      return Result.err({ code: "session_revocation_failed" });
    }
    if (before.status === "revoked") {
      return completeAuthorityChange(origin, before, before);
    }
    const { changed, current } = await staffQueries.revoke(commandContext(actor), id);
    if (changed) {
      return completeAuthorityChange(origin, changed, changed);
    }
    if (current?.status === "revoked") {
      return completeAuthorityChange(origin, current, current);
    }
    return Result.err({
      code:
        current?.status === "active" && current.role === "owner"
          ? "final_owner"
          : current
            ? "invalid_transition"
            : "not_found",
    });
  } catch {
    return Result.err({ code: "infrastructure_unavailable" });
  }
};

export const removeStaff = async (
  actor: StaffActor,
  origin: string,
  id: StaffId,
): Promise<Result<StaffMember, StaffOperationFailure>> => {
  const denied = requireOwner(actor);
  if (denied) {
    return denied;
  }
  try {
    const before = await staffQueries.findById(id);
    if (!before) {
      return Result.err({ code: "not_found" });
    }
    if (
      before.status === "active" &&
      before.role === "owner" &&
      !(await staffQueries.hasAnotherActiveOwner(id))
    ) {
      return Result.err({ code: "final_owner" });
    }
    if (!(await deleteSessions(origin, before))) {
      return Result.err({ code: "session_revocation_failed" });
    }
    const { removed, current } = await staffQueries.remove(commandContext(actor), id);
    if (removed || !current) {
      return completeAuthorityChange(origin, before, removed ?? before);
    }
    return Result.err({
      code:
        current.status === "active" && current.role === "owner"
          ? "final_owner"
          : "invalid_transition",
    });
  } catch {
    return Result.err({ code: "infrastructure_unavailable" });
  }
};
