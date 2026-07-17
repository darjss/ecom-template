import { createAuditEventId, type ProductId } from "@ecom/contracts";
import { env } from "cloudflare:workers";
import type { StaffActor } from "../staff/operations";

export const catalogActorBindings = (actor: StaffActor) => [actor.staffId, actor.role] as const;

export const acceptedProductAudit = (
  actor: StaffActor,
  action: string,
  entityId: ProductId,
  correlationId: string,
  now: number,
) =>
  env.DB.prepare(
    "INSERT INTO audit_events (id, actor_kind, actor_id, staff_role, telegram_operator_label, telegram_user_id, source_channel, action, outcome, entity_kind, entity_id, reason, command_correlation_id, metadata_json, created_at) VALUES (?, 'staff', ?, ?, NULL, NULL, 'admin', ?, 'accepted', 'product', ?, NULL, ?, NULL, ?)",
  ).bind(
    createAuditEventId(),
    ...catalogActorBindings(actor),
    action,
    entityId,
    correlationId,
    now,
  );

export const recordRejectedAttempt = async (
  actor: StaffActor,
  action: string,
  entityKind: "product" | "stock_item",
  entityId: string,
  reason: string,
) => {
  await env.DB.prepare(
    "INSERT INTO audit_events (id, actor_kind, actor_id, staff_role, telegram_operator_label, telegram_user_id, source_channel, action, outcome, entity_kind, entity_id, reason, command_correlation_id, metadata_json, created_at) VALUES (?, 'staff', ?, ?, NULL, NULL, 'admin', ?, 'rejected', ?, ?, ?, ?, NULL, ?)",
  )
    .bind(
      createAuditEventId(),
      ...catalogActorBindings(actor),
      action,
      entityKind,
      entityId,
      reason,
      crypto.randomUUID(),
      Date.now(),
    )
    .run();
};
