CREATE TABLE `option_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`position` integer NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `catalog_items`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "option_groups_id_check" CHECK(length("option_groups"."id") = 39 AND substr("option_groups"."id", 1, 13) = 'option_group_'),
	CONSTRAINT "option_groups_key_check" CHECK(length("option_groups"."key") BETWEEN 1 AND 48),
	CONSTRAINT "option_groups_label_check" CHECK(length(trim("option_groups"."label")) BETWEEN 1 AND 80),
	CONSTRAINT "option_groups_position_check" CHECK("option_groups"."position" BETWEEN 0 AND 99),
	CONSTRAINT "option_groups_state_check" CHECK("option_groups"."state" IN ('active', 'archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `option_groups_product_key_idx` ON `option_groups` (`product_id`,`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `option_groups_product_position_idx` ON `option_groups` (`product_id`,`position`);--> statement-breakpoint
CREATE TABLE `option_values` (
	`id` text PRIMARY KEY NOT NULL,
	`option_group_id` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`position` integer NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`option_group_id`) REFERENCES `option_groups`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "option_values_id_check" CHECK(length("option_values"."id") = 39 AND substr("option_values"."id", 1, 13) = 'option_value_'),
	CONSTRAINT "option_values_key_check" CHECK(length("option_values"."key") BETWEEN 1 AND 48),
	CONSTRAINT "option_values_label_check" CHECK(length(trim("option_values"."label")) BETWEEN 1 AND 80),
	CONSTRAINT "option_values_position_check" CHECK("option_values"."position" BETWEEN 0 AND 99),
	CONSTRAINT "option_values_state_check" CHECK("option_values"."state" IN ('active', 'archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `option_values_group_key_idx` ON `option_values` (`option_group_id`,`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `option_values_group_position_idx` ON `option_values` (`option_group_id`,`position`);--> statement-breakpoint
CREATE INDEX `option_values_group_state_idx` ON `option_values` (`option_group_id`,`state`);--> statement-breakpoint
CREATE TABLE `variant_option_values` (
	`variant_id` text NOT NULL,
	`option_value_id` text NOT NULL,
	PRIMARY KEY(`variant_id`, `option_value_id`),
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`option_value_id`) REFERENCES `option_values`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `variant_option_values_value_idx` ON `variant_option_values` (`option_value_id`,`variant_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`is_default` integer NOT NULL,
	`combination_key` text NOT NULL,
	`price_override_mnt` integer,
	`image_media_asset_id` text,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `catalog_items`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`image_media_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "variants_id_check" CHECK(length("__new_variants"."id") = 34 AND substr("__new_variants"."id", 1, 8) = 'variant_' AND substr("__new_variants"."id", 9, 1) GLOB '[0-7]' AND substr("__new_variants"."id", 9) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "variants_default_check" CHECK("__new_variants"."is_default" IN (0, 1)),
	CONSTRAINT "variants_combination_check" CHECK(length("__new_variants"."combination_key") BETWEEN 1 AND 512),
	CONSTRAINT "variants_price_override_check" CHECK("__new_variants"."price_override_mnt" IS NULL OR "__new_variants"."price_override_mnt" > 0),
	CONSTRAINT "variants_state_check" CHECK("__new_variants"."state" IN ('active', 'archived'))
);
--> statement-breakpoint
INSERT INTO `__new_variants`("id", "product_id", "is_default", "combination_key", "price_override_mnt", "image_media_asset_id", "state", "created_at", "updated_at") SELECT "id", "product_id", "is_default", '__default__', NULL, NULL, "state", "created_at", "updated_at" FROM `variants`;--> statement-breakpoint
DROP TABLE `variants`;--> statement-breakpoint
ALTER TABLE `__new_variants` RENAME TO `variants`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `variants_default_product_idx` ON `variants` (`product_id`) WHERE "variants"."is_default" = 1;--> statement-breakpoint
CREATE UNIQUE INDEX `variants_product_combination_idx` ON `variants` (`product_id`,`combination_key`);--> statement-breakpoint
CREATE INDEX `variants_product_state_idx` ON `variants` (`product_id`,`state`);--> statement-breakpoint
CREATE INDEX `variants_image_media_idx` ON `variants` (`image_media_asset_id`);