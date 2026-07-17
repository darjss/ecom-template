PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_option_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`position` integer NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `catalog_items`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "option_groups_id_check" CHECK(length("__new_option_groups"."id") = 39 AND substr("__new_option_groups"."id", 1, 13) = 'option_group_' AND substr("__new_option_groups"."id", 14, 1) GLOB '[0-7]' AND substr("__new_option_groups"."id", 14) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "option_groups_key_check" CHECK(length("__new_option_groups"."key") BETWEEN 1 AND 48),
	CONSTRAINT "option_groups_label_check" CHECK(length(trim("__new_option_groups"."label")) BETWEEN 1 AND 80),
	CONSTRAINT "option_groups_position_check" CHECK("__new_option_groups"."position" BETWEEN 0 AND 99),
	CONSTRAINT "option_groups_state_check" CHECK("__new_option_groups"."state" IN ('active', 'archived'))
);
--> statement-breakpoint
INSERT INTO `__new_option_groups`("id", "product_id", "key", "label", "position", "state", "created_at", "updated_at") SELECT "id", "product_id", "key", "label", "position", "state", "created_at", "updated_at" FROM `option_groups`;--> statement-breakpoint
DROP TABLE `option_groups`;--> statement-breakpoint
ALTER TABLE `__new_option_groups` RENAME TO `option_groups`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `option_groups_product_key_idx` ON `option_groups` (`product_id`,`key`) WHERE "option_groups"."state" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX `option_groups_product_position_idx` ON `option_groups` (`product_id`,`position`) WHERE "option_groups"."state" = 'active';--> statement-breakpoint
CREATE TABLE `__new_option_values` (
	`id` text PRIMARY KEY NOT NULL,
	`option_group_id` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`position` integer NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`option_group_id`) REFERENCES `option_groups`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "option_values_id_check" CHECK(length("__new_option_values"."id") = 39 AND substr("__new_option_values"."id", 1, 13) = 'option_value_' AND substr("__new_option_values"."id", 14, 1) GLOB '[0-7]' AND substr("__new_option_values"."id", 14) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "option_values_key_check" CHECK(length("__new_option_values"."key") BETWEEN 1 AND 48),
	CONSTRAINT "option_values_label_check" CHECK(length(trim("__new_option_values"."label")) BETWEEN 1 AND 80),
	CONSTRAINT "option_values_position_check" CHECK("__new_option_values"."position" BETWEEN 0 AND 99),
	CONSTRAINT "option_values_state_check" CHECK("__new_option_values"."state" IN ('active', 'archived'))
);
--> statement-breakpoint
INSERT INTO `__new_option_values`("id", "option_group_id", "key", "label", "position", "state", "created_at", "updated_at") SELECT "id", "option_group_id", "key", "label", "position", "state", "created_at", "updated_at" FROM `option_values`;--> statement-breakpoint
DROP TABLE `option_values`;--> statement-breakpoint
ALTER TABLE `__new_option_values` RENAME TO `option_values`;--> statement-breakpoint
CREATE UNIQUE INDEX `option_values_group_key_idx` ON `option_values` (`option_group_id`,`key`) WHERE "option_values"."state" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX `option_values_group_position_idx` ON `option_values` (`option_group_id`,`position`) WHERE "option_values"."state" = 'active';--> statement-breakpoint
CREATE INDEX `option_values_group_state_idx` ON `option_values` (`option_group_id`,`state`);