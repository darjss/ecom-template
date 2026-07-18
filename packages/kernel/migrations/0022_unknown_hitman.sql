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
	`redemption_count` integer DEFAULT 0 NOT NULL,
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
	CONSTRAINT "discount_rules_redemption_check" CHECK("discount_rules"."redemption_count" >= 0 AND ("discount_rules"."global_limit" IS NULL OR "discount_rules"."redemption_count" <= "discount_rules"."global_limit")),
	CONSTRAINT "discount_rules_revision_check" CHECK("discount_rules"."revision" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discount_rules_code_idx` ON `discount_rules` (`code`) WHERE "discount_rules"."code" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `discount_rules_eligibility_idx` ON `discount_rules` (`state`,`starts_at`,`ends_at`,`id`);--> statement-breakpoint
CREATE TABLE `discount_targets` (
	`discount_rule_id` text NOT NULL,
	`position` integer NOT NULL,
	`kind` text NOT NULL,
	`product_id` text,
	`variant_id` text,
	`category_id` text,
	`collection_id` text,
	PRIMARY KEY(`discount_rule_id`, `position`),
	FOREIGN KEY (`discount_rule_id`) REFERENCES `discount_rules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `catalog_items`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "discount_targets_position_check" CHECK("discount_targets"."position" BETWEEN 0 AND 99),
	CONSTRAINT "discount_targets_shape_check" CHECK(("discount_targets"."kind" = 'all' AND "discount_targets"."product_id" IS NULL AND "discount_targets"."variant_id" IS NULL AND "discount_targets"."category_id" IS NULL AND "discount_targets"."collection_id" IS NULL) OR ("discount_targets"."kind" = 'product' AND "discount_targets"."product_id" IS NOT NULL AND "discount_targets"."variant_id" IS NULL AND "discount_targets"."category_id" IS NULL AND "discount_targets"."collection_id" IS NULL) OR ("discount_targets"."kind" = 'variant' AND "discount_targets"."product_id" IS NULL AND "discount_targets"."variant_id" IS NOT NULL AND "discount_targets"."category_id" IS NULL AND "discount_targets"."collection_id" IS NULL) OR ("discount_targets"."kind" = 'category' AND "discount_targets"."product_id" IS NULL AND "discount_targets"."variant_id" IS NULL AND "discount_targets"."category_id" IS NOT NULL AND "discount_targets"."collection_id" IS NULL) OR ("discount_targets"."kind" = 'collection' AND "discount_targets"."product_id" IS NULL AND "discount_targets"."variant_id" IS NULL AND "discount_targets"."category_id" IS NULL AND "discount_targets"."collection_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discount_targets_identity_idx` ON `discount_targets` (`discount_rule_id`,`kind`,`product_id`,`variant_id`,`category_id`,`collection_id`);--> statement-breakpoint
CREATE INDEX `discount_targets_category_idx` ON `discount_targets` (`category_id`,`discount_rule_id`);--> statement-breakpoint
CREATE INDEX `discount_targets_collection_idx` ON `discount_targets` (`collection_id`,`discount_rule_id`);