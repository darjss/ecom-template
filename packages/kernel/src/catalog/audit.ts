import { createAuditEventId } from "@ecom/contracts";
import { database } from "../db/database";
import { auditEvents } from "../db/schema";
import type { StaffActor } from "../staff/operations";

export const recordRejectedAttempt = async (
  actor: StaffActor,
  action: string,
  entityKind: "product" | "stock_item",
  entityId: string,
  reason: string,
) => {
  await database().insert(auditEvents).values({
    id: createAuditEventId(),
    actorKind: "staff",
    actorId: actor.staffId,
    staffRole: actor.role,
    sourceChannel: "admin",
    action,
    outcome: "rejected",
    entityKind,
    entityId,
    reason,
    commandCorrelationId: crypto.randomUUID(),
    createdAt: new Date(),
  });
};
