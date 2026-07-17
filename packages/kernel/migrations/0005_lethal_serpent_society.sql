CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_kind` text NOT NULL,
	`actor_id` text,
	`staff_role` text,
	`source_channel` text NOT NULL,
	`action` text NOT NULL,
	`outcome` text NOT NULL,
	`entity_kind` text NOT NULL,
	`entity_id` text NOT NULL,
	`reason` text,
	`command_correlation_id` text NOT NULL,
	`metadata_json` text,
	`created_at` integer NOT NULL,
	CONSTRAINT "audit_events_id_check" CHECK(length("audit_events"."id") = 32 AND substr("audit_events"."id", 1, 6) = 'audit_' AND substr("audit_events"."id", 7, 1) GLOB '[0-7]' AND substr("audit_events"."id", 7) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "audit_events_actor_check" CHECK(("audit_events"."actor_kind" = 'staff' AND "audit_events"."actor_id" IS NOT NULL AND "audit_events"."staff_role" IS NOT NULL) OR ("audit_events"."actor_kind" <> 'staff' AND "audit_events"."staff_role" IS NULL)),
	CONSTRAINT "audit_events_actor_kind_check" CHECK("audit_events"."actor_kind" IN ('system', 'staff', 'customer', 'provider')),
	CONSTRAINT "audit_events_staff_actor_id_check" CHECK("audit_events"."actor_kind" <> 'staff' OR (length("audit_events"."actor_id") = 32 AND substr("audit_events"."actor_id", 1, 6) = 'staff_' AND substr("audit_events"."actor_id", 7, 1) GLOB '[0-7]' AND substr("audit_events"."actor_id", 7) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*')),
	CONSTRAINT "audit_events_staff_role_check" CHECK("audit_events"."staff_role" IS NULL OR "audit_events"."staff_role" IN ('owner', 'manager', 'staff')),
	CONSTRAINT "audit_events_source_channel_check" CHECK("audit_events"."source_channel" IN ('admin', 'storefront', 'provider_callback', 'workflow', 'telegram', 'provisioning')),
	CONSTRAINT "audit_events_outcome_check" CHECK("audit_events"."outcome" IN ('accepted', 'rejected')),
	CONSTRAINT "audit_events_correlation_length_check" CHECK(length("audit_events"."command_correlation_id") BETWEEN 1 AND 64),
	CONSTRAINT "audit_events_metadata_check" CHECK("audit_events"."metadata_json" IS NULL OR (json_valid("audit_events"."metadata_json") AND length("audit_events"."metadata_json") <= 2048)),
	CONSTRAINT "audit_events_fact_length_check" CHECK(length("audit_events"."action") BETWEEN 1 AND 64 AND length("audit_events"."entity_kind") BETWEEN 1 AND 64 AND length("audit_events"."entity_id") BETWEEN 1 AND 128)
);
--> statement-breakpoint
CREATE INDEX `audit_events_entity_timeline_idx` ON `audit_events` (`entity_kind`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_events_actor_timeline_idx` ON `audit_events` (`actor_kind`,`actor_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `staff_session_cleanup_debts` (
	`auth_user_id` text PRIMARY KEY NOT NULL,
	`staff_id` text NOT NULL,
	`session_generation` integer NOT NULL,
	`operation` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "staff_session_cleanup_debts_staff_id_check" CHECK(length("staff_session_cleanup_debts"."staff_id") = 32 AND substr("staff_session_cleanup_debts"."staff_id", 1, 6) = 'staff_' AND substr("staff_session_cleanup_debts"."staff_id", 7, 1) GLOB '[0-7]' AND substr("staff_session_cleanup_debts"."staff_id", 7) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "staff_session_cleanup_debts_generation_check" CHECK("staff_session_cleanup_debts"."session_generation" >= 0),
	CONSTRAINT "staff_session_cleanup_debts_operation_check" CHECK("staff_session_cleanup_debts"."operation" IN ('approve', 'role_change', 'revoke', 'remove', 'provision'))
);
