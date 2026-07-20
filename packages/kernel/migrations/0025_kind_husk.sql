PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_discount_rules` (
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
	`redemption_count` integer DEFAULT 0 NOT NULL,
	`targets_json` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "discount_rules_id_check" CHECK(length("__new_discount_rules"."id") = 35 AND substr("__new_discount_rules"."id", 1, 9) = 'discount_' AND substr("__new_discount_rules"."id", 10, 1) GLOB '[0-7]' AND substr("__new_discount_rules"."id", 10) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "discount_rules_name_check" CHECK(length(trim("__new_discount_rules"."name")) BETWEEN 1 AND 120),
	CONSTRAINT "discount_rules_mode_check" CHECK(("__new_discount_rules"."mode" = 'automatic' AND "__new_discount_rules"."code" IS NULL) OR ("__new_discount_rules"."mode" = 'code' AND "__new_discount_rules"."code" IS NOT NULL AND "__new_discount_rules"."code" = upper(trim("__new_discount_rules"."code")) AND length("__new_discount_rules"."code") BETWEEN 1 AND 32)),
	CONSTRAINT "discount_rules_calculation_check" CHECK(("__new_discount_rules"."calculation" = 'percentage' AND "__new_discount_rules"."value" BETWEEN 1 AND 100) OR ("__new_discount_rules"."calculation" = 'fixed_mnt' AND "__new_discount_rules"."value" BETWEEN 1 AND 1000000000)),
	CONSTRAINT "discount_rules_state_check" CHECK("__new_discount_rules"."state" IN ('draft', 'active', 'inactive')),
	CONSTRAINT "discount_rules_window_check" CHECK("__new_discount_rules"."starts_at" IS NULL OR "__new_discount_rules"."ends_at" IS NULL OR "__new_discount_rules"."starts_at" < "__new_discount_rules"."ends_at"),
	CONSTRAINT "discount_rules_minimum_check" CHECK("__new_discount_rules"."minimum_subtotal_mnt" BETWEEN 0 AND 1000000000),
	CONSTRAINT "discount_rules_limit_check" CHECK("__new_discount_rules"."global_limit" IS NULL OR "__new_discount_rules"."global_limit" BETWEEN 1 AND 1000000),
	CONSTRAINT "discount_rules_redemption_count_check" CHECK("__new_discount_rules"."redemption_count" >= 0),
	CONSTRAINT "discount_rules_targets_check" CHECK(json_valid("__new_discount_rules"."targets_json") AND json_type("__new_discount_rules"."targets_json") = 'array' AND json_array_length("__new_discount_rules"."targets_json") BETWEEN 1 AND 100),
	CONSTRAINT "discount_rules_revision_check" CHECK("__new_discount_rules"."revision" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_discount_rules`("id", "name", "mode", "code", "calculation", "value", "state", "starts_at", "ends_at", "minimum_subtotal_mnt", "global_limit", "redemption_count", "targets_json", "revision", "created_at", "updated_at") SELECT `rule`.`id`, `rule`.`name`, `rule`.`mode`, `rule`.`code`, `rule`.`calculation`, `rule`.`value`, `rule`.`state`, `rule`.`starts_at`, `rule`.`ends_at`, `rule`.`minimum_subtotal_mnt`, `rule`.`global_limit`, coalesce((SELECT sum(`entry`.`quantity_delta`) FROM `discount_redemption_entries` AS `entry` WHERE `entry`.`discount_rule_id` = `rule`.`id`), 0), `rule`.`targets_json`, `rule`.`revision`, `rule`.`created_at`, `rule`.`updated_at` FROM `discount_rules` AS `rule`;--> statement-breakpoint
DROP TABLE `order_discount_allocations`;--> statement-breakpoint
DROP TABLE `order_discount_adjustments`;--> statement-breakpoint
DROP TABLE `discount_redemption_entries`;--> statement-breakpoint
DROP TABLE `discount_rules`;--> statement-breakpoint
ALTER TABLE `__new_discount_rules` RENAME TO `discount_rules`;--> statement-breakpoint
CREATE UNIQUE INDEX `discount_rules_code_idx` ON `discount_rules` (`code`) WHERE "discount_rules"."code" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `discount_rules_eligibility_idx` ON `discount_rules` (`state`,`starts_at`,`ends_at`,`id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
