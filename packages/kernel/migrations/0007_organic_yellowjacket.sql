PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_kind` text NOT NULL,
	`actor_id` text,
	`staff_role` text,
	`telegram_operator_label` text,
	`telegram_user_id` integer,
	`source_channel` text NOT NULL,
	`action` text NOT NULL,
	`outcome` text NOT NULL,
	`entity_kind` text NOT NULL,
	`entity_id` text NOT NULL,
	`reason` text,
	`command_correlation_id` text NOT NULL,
	`metadata_json` text,
	`created_at` integer NOT NULL,
	CONSTRAINT "audit_events_id_check" CHECK(length("__new_audit_events"."id") = 32 AND substr("__new_audit_events"."id", 1, 6) = 'audit_' AND substr("__new_audit_events"."id", 7, 1) GLOB '[0-7]' AND substr("__new_audit_events"."id", 7) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "audit_events_actor_check" CHECK(("__new_audit_events"."actor_kind" = 'staff' AND "__new_audit_events"."actor_id" IS NOT NULL AND "__new_audit_events"."staff_role" IS NOT NULL AND "__new_audit_events"."telegram_operator_label" IS NULL AND "__new_audit_events"."telegram_user_id" IS NULL) OR ("__new_audit_events"."actor_kind" = 'telegram_operator' AND "__new_audit_events"."actor_id" IS NULL AND "__new_audit_events"."staff_role" IS NULL AND "__new_audit_events"."telegram_operator_label" IS NOT NULL AND "__new_audit_events"."telegram_user_id" IS NOT NULL) OR ("__new_audit_events"."actor_kind" NOT IN ('staff', 'telegram_operator') AND "__new_audit_events"."staff_role" IS NULL AND "__new_audit_events"."telegram_operator_label" IS NULL AND "__new_audit_events"."telegram_user_id" IS NULL)),
	CONSTRAINT "audit_events_actor_kind_check" CHECK("__new_audit_events"."actor_kind" IN ('system', 'staff', 'customer', 'provider', 'telegram_operator')),
	CONSTRAINT "audit_events_staff_actor_id_check" CHECK("__new_audit_events"."actor_kind" <> 'staff' OR (length("__new_audit_events"."actor_id") = 32 AND substr("__new_audit_events"."actor_id", 1, 6) = 'staff_' AND substr("__new_audit_events"."actor_id", 7, 1) GLOB '[0-7]' AND substr("__new_audit_events"."actor_id", 7) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*')),
	CONSTRAINT "audit_events_staff_role_check" CHECK("__new_audit_events"."staff_role" IS NULL OR "__new_audit_events"."staff_role" IN ('owner', 'manager', 'staff')),
	CONSTRAINT "audit_events_telegram_operator_check" CHECK("__new_audit_events"."actor_kind" <> 'telegram_operator' OR ("__new_audit_events"."telegram_operator_label" = trim("__new_audit_events"."telegram_operator_label") AND length("__new_audit_events"."telegram_operator_label") BETWEEN 1 AND 64 AND "__new_audit_events"."telegram_user_id" > 0 AND "__new_audit_events"."telegram_user_id" <= 9007199254740991)),
	CONSTRAINT "audit_events_source_channel_check" CHECK("__new_audit_events"."source_channel" IN ('admin', 'storefront', 'provider_callback', 'workflow', 'telegram', 'provisioning')),
	CONSTRAINT "audit_events_outcome_check" CHECK("__new_audit_events"."outcome" IN ('accepted', 'rejected')),
	CONSTRAINT "audit_events_correlation_length_check" CHECK(length("__new_audit_events"."command_correlation_id") BETWEEN 1 AND 64),
	CONSTRAINT "audit_events_metadata_check" CHECK("__new_audit_events"."metadata_json" IS NULL OR (json_valid("__new_audit_events"."metadata_json") AND length("__new_audit_events"."metadata_json") <= 2048)),
	CONSTRAINT "audit_events_fact_length_check" CHECK(length("__new_audit_events"."action") BETWEEN 1 AND 64 AND length("__new_audit_events"."entity_kind") BETWEEN 1 AND 64 AND length("__new_audit_events"."entity_id") BETWEEN 1 AND 128)
);
--> statement-breakpoint
INSERT INTO `__new_audit_events`("id", "actor_kind", "actor_id", "staff_role", "telegram_operator_label", "telegram_user_id", "source_channel", "action", "outcome", "entity_kind", "entity_id", "reason", "command_correlation_id", "metadata_json", "created_at") SELECT "id", "actor_kind", "actor_id", "staff_role", "telegram_operator_label", "telegram_user_id", "source_channel", "action", "outcome", "entity_kind", "entity_id", "reason", "command_correlation_id", "metadata_json", "created_at" FROM `audit_events`;--> statement-breakpoint
DROP TABLE `audit_events`;--> statement-breakpoint
ALTER TABLE `__new_audit_events` RENAME TO `audit_events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `audit_events_entity_timeline_idx` ON `audit_events` (`entity_kind`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_events_actor_timeline_idx` ON `audit_events` (`actor_kind`,`actor_id`,`created_at`);