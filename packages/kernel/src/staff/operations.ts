import type { StaffId, StaffMember, StaffRole } from "@ecom/contracts";
import { Result } from "better-result";
import { cleanupStaffUserSessions } from "../auth/runtime";
import { staffQueries, type StaffCleanupOperation, type StaffRecord } from "./persistence";

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

const publicMember = ({
  authUserId: _authUserId,
  sessionGeneration: _sessionGeneration,
  ...member
}: StaffRecord): StaffMember => member;

const requireOwner = (actor: StaffActor) =>
  hasStaffCapability(actor.role, "staff_auth")
    ? undefined
    : Result.err<never, StaffOperationFailure>({ code: "forbidden" });

const commandContext = (actor: StaffActor) => ({
  actor: { staffId: actor.staffId, role: actor.role },
  correlationId: crypto.randomUUID(),
});

const cleanupMode = (operation: StaffCleanupOperation): "stale" | "all" =>
  operation === "revoke" || operation === "remove" ? "all" : "stale";

const cleanupSessions = async (
  origin: string,
  member: StaffRecord,
  operation: StaffCleanupOperation,
  cleanupGeneration = member.sessionGeneration,
) => {
  if (!member.authUserId) {
    return true;
  }
  try {
    if (
      !(await cleanupStaffUserSessions(
        origin,
        member.authUserId,
        cleanupGeneration,
        cleanupMode(operation),
      ))
    ) {
      return false;
    }
    return await staffQueries.clearCleanupDebt(member.authUserId, cleanupGeneration);
  } catch {
    return false;
  }
};

export const listStaff = async (
  actor: StaffActor,
): Promise<
  Result<
    { readonly members: readonly StaffMember[]; readonly cleanupRequiredCount: number },
    StaffOperationFailure
  >
> => {
  const denied = requireOwner(actor);
  if (denied) {
    return denied;
  }
  try {
    const [members, cleanupRequiredCount] = await Promise.all([
      staffQueries.list(),
      staffQueries.countCleanupDebts(),
    ]);
    return Result.ok({ members: members.map(publicMember), cleanupRequiredCount });
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
    const { changed, current } = await staffQueries.approve(commandContext(actor), id, role);
    if (!changed) {
      return Result.err({ code: current ? "invalid_transition" : "not_found" });
    }
    if (!(await cleanupSessions(origin, changed, "approve"))) {
      return Result.err({ code: "session_revocation_failed" });
    }
    return Result.ok(publicMember(changed));
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
    if (before.status !== "active" || before.role === role) {
      return Result.err({ code: "invalid_transition" });
    }
    const { changed, current } = await staffQueries.changeRole(commandContext(actor), id, role);
    if (!changed) {
      if (!current) {
        return Result.err({ code: "not_found" });
      }
      return Result.err({
        code:
          current.status === "active" && current.role !== role
            ? "final_owner"
            : "invalid_transition",
      });
    }
    if (!(await cleanupSessions(origin, changed, "role_change"))) {
      return Result.err({ code: "session_revocation_failed" });
    }
    return Result.ok(publicMember(changed));
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
    const { changed, current } = await staffQueries.revoke(commandContext(actor), id);
    if (!changed) {
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
    if (!(await cleanupSessions(origin, changed, "revoke"))) {
      return Result.err({ code: "session_revocation_failed" });
    }
    return Result.ok(publicMember(changed));
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
    const { removed, cleanupGeneration, current } = await staffQueries.remove(
      commandContext(actor),
      id,
    );
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
    if (!(await cleanupSessions(origin, removed, "remove", cleanupGeneration))) {
      return Result.err({ code: "session_revocation_failed" });
    }
    return Result.ok(publicMember(removed));
  } catch {
    return Result.err({ code: "infrastructure_unavailable" });
  }
};

const cleanupRetryLimit = 100;

export type StaffCleanupResult = {
  readonly attempted: number;
  readonly cleared: number;
  readonly remaining: number;
};

export const retryStaffSessionCleanup = async (
  actor: StaffActor,
  origin: string,
): Promise<Result<StaffCleanupResult, StaffOperationFailure>> => {
  const denied = requireOwner(actor);
  if (denied) {
    return denied;
  }
  try {
    const debts = await staffQueries.listCleanupDebts(cleanupRetryLimit);
    let cleared = 0;
    for (const debt of debts) {
      let sessionsDeleted = false;
      try {
        sessionsDeleted = await cleanupStaffUserSessions(
          origin,
          debt.authUserId,
          debt.sessionGeneration,
          cleanupMode(debt.operation),
        );
      } catch {
        sessionsDeleted = false;
      }
      if (
        sessionsDeleted &&
        (await staffQueries.clearCleanupDebt(debt.authUserId, debt.sessionGeneration))
      ) {
        cleared += 1;
      }
    }
    return Result.ok({
      attempted: debts.length,
      cleared,
      remaining: await staffQueries.countCleanupDebts(),
    });
  } catch {
    return Result.err({ code: "infrastructure_unavailable" });
  }
};
