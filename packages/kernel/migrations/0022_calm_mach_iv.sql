CREATE TABLE `discount_redemption_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`discount_rule_id` text NOT NULL,
	`order_id` text NOT NULL,
	`kind` text NOT NULL,
	`quantity_delta` integer NOT NULL,
	`command_correlation_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`discount_rule_id`) REFERENCES `discount_rules`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "discount_redemption_entries_id_check" CHECK(length("discount_redemption_entries"."id") = 46 AND substr("discount_redemption_entries"."id", 1, 20) = 'discount_redemption_' AND substr("discount_redemption_entries"."id", 21, 1) GLOB '[0-7]' AND substr("discount_redemption_entries"."id", 21) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "discount_redemption_entries_kind_check" CHECK(("discount_redemption_entries"."kind" = 'claim' AND "discount_redemption_entries"."quantity_delta" = 1) OR ("discount_redemption_entries"."kind" = 'release' AND "discount_redemption_entries"."quantity_delta" = -1)),
	CONSTRAINT "discount_redemption_entries_order_check" CHECK(length("discount_redemption_entries"."order_id") BETWEEN 1 AND 128),
	CONSTRAINT "discount_redemption_entries_correlation_check" CHECK(length("discount_redemption_entries"."command_correlation_id") BETWEEN 1 AND 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discount_redemption_entries_order_kind_idx` ON `discount_redemption_entries` (`discount_rule_id`,`order_id`,`kind`);--> statement-breakpoint
CREATE INDEX `discount_redemption_entries_rule_timeline_idx` ON `discount_redemption_entries` (`discount_rule_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `discount_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`mode` text NOT NULL,
	`code` text,
	`calculation` text NOT NULL,
	`value` integer NOT NULL,
	`state` text NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`minimum_subtotal_mnt` integer NOT NULL,
	`global_limit` integer,
	`targets_json` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "discount_rules_id_check" CHECK(length("discount_rules"."id") = 35 AND substr("discount_rules"."id", 1, 9) = 'discount_' AND substr("discount_rules"."id", 10, 1) GLOB '[0-7]' AND substr("discount_rules"."id", 10) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "discount_rules_name_check" CHECK(length(trim("discount_rules"."name")) BETWEEN 1 AND 120),
	CONSTRAINT "discount_rules_mode_check" CHECK(("discount_rules"."mode" = 'automatic' AND "discount_rules"."code" IS NULL) OR ("discount_rules"."mode" = 'code' AND "discount_rules"."code" IS NOT NULL AND "discount_rules"."code" = upper(trim("discount_rules"."code")) AND length("discount_rules"."code") BETWEEN 1 AND 32)),
	CONSTRAINT "discount_rules_calculation_check" CHECK(("discount_rules"."calculation" = 'percentage' AND "discount_rules"."value" BETWEEN 1 AND 100) OR ("discount_rules"."calculation" = 'fixed_mnt' AND "discount_rules"."value" BETWEEN 1 AND 1000000000)),
	CONSTRAINT "discount_rules_state_check" CHECK("discount_rules"."state" IN ('draft', 'active', 'inactive')),
	CONSTRAINT "discount_rules_window_check" CHECK("discount_rules"."starts_at" IS NULL OR "discount_rules"."ends_at" IS NULL OR "discount_rules"."starts_at" < "discount_rules"."ends_at"),
	CONSTRAINT "discount_rules_minimum_check" CHECK("discount_rules"."minimum_subtotal_mnt" BETWEEN 0 AND 1000000000),
	CONSTRAINT "discount_rules_limit_check" CHECK("discount_rules"."global_limit" IS NULL OR "discount_rules"."global_limit" BETWEEN 1 AND 1000000),
	CONSTRAINT "discount_rules_targets_check" CHECK(json_valid("discount_rules"."targets_json") AND json_type("discount_rules"."targets_json") = 'array' AND json_array_length("discount_rules"."targets_json") BETWEEN 1 AND 100),
	CONSTRAINT "discount_rules_revision_check" CHECK("discount_rules"."revision" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discount_rules_code_idx` ON `discount_rules` (`code`) WHERE "discount_rules"."code" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `discount_rules_eligibility_idx` ON `discount_rules` (`state`,`starts_at`,`ends_at`,`id`);