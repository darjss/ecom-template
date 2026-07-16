import type { StaffId, StaffMember, StaffRole } from "@ecom/contracts";
import { Result } from "better-result";
import { revokeStaffUserSessions } from "../auth/runtime";
import { staffQueries, type StaffRecord } from "./persistence";

export type StaffCapability =
  | "staff_auth"
  | "financial"
  | "catalog_cms"
  | "inventory_discounts"
  | "orders_fulfillment"
  | "analytics";

export type StaffActor = { readonly authUserId: string; readonly role: StaffRole };

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

const publicMember = ({
  authUserId: _authUserId,
  sessionGeneration: _sessionGeneration,
  ...member
}: StaffRecord): StaffMember => member;

const requireOwner = (actor: StaffActor) =>
  hasStaffCapability(actor.role, "staff_auth")
    ? undefined
    : Result.err<never, StaffOperationFailure>({ code: "forbidden" });

const revokeSessions = async (origin: string, member: StaffRecord) => {
  if (!member.authUserId) {
    return true;
  }
  try {
    return await revokeStaffUserSessions(origin, member.authUserId);
  } catch {
    return false;
  }
};

export const listStaff = async (
  actor: StaffActor,
): Promise<Result<readonly StaffMember[], StaffOperationFailure>> => {
  const denied = requireOwner(actor);
  if (denied) {
    return denied;
  }
  try {
    return Result.ok((await staffQueries.list()).map(publicMember));
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
    const member = await staffQueries.createActive(email, role);
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
    const before = (await staffQueries.list()).find((member) => member.id === id);
    if (!before) {
      return Result.err({ code: "not_found" });
    }
    if (before.status === "active") {
      return Result.err({ code: "invalid_transition" });
    }
    const member = await staffQueries.approve(id, role);
    if (!member || member.status !== "active" || member.role !== role) {
      return Result.err({ code: "invalid_transition" });
    }
    if (!(await revokeSessions(origin, member))) {
      return Result.err({ code: "session_revocation_failed" });
    }
    return Result.ok(publicMember(member));
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
    const before = (await staffQueries.list()).find((member) => member.id === id);
    if (!before) {
      return Result.err({ code: "not_found" });
    }
    if (before.status !== "active") {
      return Result.err({ code: "invalid_transition" });
    }
    const member = await staffQueries.changeRole(id, role);
    if (!member) {
      return Result.err({ code: "not_found" });
    }
    if (member.role !== role) {
      return Result.err({ code: "final_owner" });
    }
    if (!(await revokeSessions(origin, member))) {
      return Result.err({ code: "session_revocation_failed" });
    }
    return Result.ok(publicMember(member));
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
    const before = (await staffQueries.list()).find((member) => member.id === id);
    if (!before) {
      return Result.err({ code: "not_found" });
    }
    const member = await staffQueries.revoke(id);
    if (!member) {
      return Result.err({ code: "not_found" });
    }
    if (member.status !== "revoked") {
      return Result.err({
        code:
          before.status === "active" && before.role === "owner"
            ? "final_owner"
            : "invalid_transition",
      });
    }
    if (!(await revokeSessions(origin, member))) {
      return Result.err({ code: "session_revocation_failed" });
    }
    return Result.ok(publicMember(member));
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
    const { removed, current } = await staffQueries.remove(id);
    if (!removed) {
      if (!current) {
        return Result.err({ code: "not_found" });
      }
      return Result.err({
        code:
          current.status === "active" && current.role === "owner"
            ? "final_owner"
            : "invalid_transition",
      });
    }
    if (!(await revokeSessions(origin, removed))) {
      return Result.err({ code: "session_revocation_failed" });
    }
    return Result.ok(publicMember(removed));
  } catch {
    return Result.err({ code: "infrastructure_unavailable" });
  }
};
