CREATE TABLE `bundle_components` (
	`bundle_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`quantity` integer NOT NULL,
	PRIMARY KEY(`bundle_id`, `variant_id`),
	FOREIGN KEY (`bundle_id`) REFERENCES `catalog_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "bundle_components_quantity_check" CHECK("bundle_components"."quantity" BETWEEN 1 AND 999)
);
--> statement-breakpoint
CREATE INDEX `bundle_components_variant_idx` ON `bundle_components` (`variant_id`,`bundle_id`);--> statement-breakpoint
CREATE TABLE `personalization_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`catalog_item_id` text NOT NULL,
	`kind` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`position` integer NOT NULL,
	`required` integer NOT NULL,
	`state` text NOT NULL,
	`max_length` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`catalog_item_id`) REFERENCES `catalog_items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "personalization_definitions_id_check" CHECK(length("personalization_definitions"."id") = 42 AND substr("personalization_definitions"."id", 1, 16) = 'personalization_' AND substr("personalization_definitions"."id", 17, 1) GLOB '[0-7]' AND substr("personalization_definitions"."id", 17) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "personalization_definitions_kind_check" CHECK("personalization_definitions"."kind" IN ('text', 'single_select', 'checkbox')),
	CONSTRAINT "personalization_definitions_key_check" CHECK(length("personalization_definitions"."key") BETWEEN 1 AND 48),
	CONSTRAINT "personalization_definitions_label_check" CHECK(length(trim("personalization_definitions"."label")) BETWEEN 1 AND 80),
	CONSTRAINT "personalization_definitions_position_check" CHECK("personalization_definitions"."position" BETWEEN 0 AND 11),
	CONSTRAINT "personalization_definitions_required_check" CHECK("personalization_definitions"."required" IN (0, 1)),
	CONSTRAINT "personalization_definitions_state_check" CHECK("personalization_definitions"."state" IN ('active', 'archived')),
	CONSTRAINT "personalization_definitions_max_length_check" CHECK(("personalization_definitions"."kind" = 'text' AND "personalization_definitions"."max_length" BETWEEN 1 AND 240) OR ("personalization_definitions"."kind" <> 'text' AND "personalization_definitions"."max_length" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `personalization_definitions_item_key_idx` ON `personalization_definitions` (`catalog_item_id`,`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `personalization_definitions_item_position_idx` ON `personalization_definitions` (`catalog_item_id`,`position`);--> statement-breakpoint
CREATE TABLE `personalization_values` (
	`id` text PRIMARY KEY NOT NULL,
	`personalization_id` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`position` integer NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`personalization_id`) REFERENCES `personalization_definitions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "personalization_values_id_check" CHECK(length("personalization_values"."id") = 48 AND substr("personalization_values"."id", 1, 22) = 'personalization_value_' AND substr("personalization_values"."id", 23, 1) GLOB '[0-7]' AND substr("personalization_values"."id", 23) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "personalization_values_key_check" CHECK(length("personalization_values"."key") BETWEEN 1 AND 48),
	CONSTRAINT "personalization_values_label_check" CHECK(length(trim("personalization_values"."label")) BETWEEN 1 AND 80),
	CONSTRAINT "personalization_values_position_check" CHECK("personalization_values"."position" BETWEEN 0 AND 11),
	CONSTRAINT "personalization_values_state_check" CHECK("personalization_values"."state" IN ('active', 'archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `personalization_values_definition_key_idx` ON `personalization_values` (`personalization_id`,`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `personalization_values_definition_position_idx` ON `personalization_values` (`personalization_id`,`position`);