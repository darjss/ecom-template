CREATE TABLE `catalog_item_categories` (
	`catalog_item_id` text NOT NULL,
	`category_id` text NOT NULL,
	PRIMARY KEY(`catalog_item_id`, `category_id`),
	FOREIGN KEY (`catalog_item_id`) REFERENCES `catalog_items`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `catalog_item_categories_category_idx` ON `catalog_item_categories` (`category_id`,`catalog_item_id`);--> statement-breakpoint
CREATE TABLE `catalog_item_collections` (
	`catalog_item_id` text NOT NULL,
	`collection_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`catalog_item_id`, `collection_id`),
	FOREIGN KEY (`catalog_item_id`) REFERENCES `catalog_items`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "catalog_item_collections_position_check" CHECK("catalog_item_collections"."position" BETWEEN 0 AND 10000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_item_collections_position_idx` ON `catalog_item_collections` (`collection_id`,`position`);--> statement-breakpoint
CREATE TABLE `catalog_item_tags` (
	`catalog_item_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`catalog_item_id`, `tag_id`),
	FOREIGN KEY (`catalog_item_id`) REFERENCES `catalog_items`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `catalog_item_tags_tag_idx` ON `catalog_item_tags` (`tag_id`,`catalog_item_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`position` integer NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`activated_at` integer,
	`archived_at` integer,
	FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "categories_id_check" CHECK(length("categories"."id") = 35 AND substr("categories"."id", 1, 9) = 'category_' AND substr("categories"."id", 10, 1) GLOB '[0-7]' AND substr("categories"."id", 10) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "categories_slug_check" CHECK(length("categories"."slug") BETWEEN 1 AND 100),
	CONSTRAINT "categories_name_check" CHECK(length(trim("categories"."name")) BETWEEN 1 AND 120),
	CONSTRAINT "categories_position_check" CHECK("categories"."position" BETWEEN 0 AND 10000),
	CONSTRAINT "categories_state_check" CHECK("categories"."state" IN ('draft', 'active', 'archived')),
	CONSTRAINT "categories_parent_check" CHECK("categories"."parent_id" IS NULL OR "categories"."parent_id" <> "categories"."id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE INDEX `categories_parent_state_position_idx` ON `categories` (`parent_id`,`state`,`position`,`id`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`activated_at` integer,
	`archived_at` integer,
	CONSTRAINT "collections_id_check" CHECK(length("collections"."id") = 37 AND substr("collections"."id", 1, 11) = 'collection_' AND substr("collections"."id", 12, 1) GLOB '[0-7]' AND substr("collections"."id", 12) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "collections_slug_check" CHECK(length("collections"."slug") BETWEEN 1 AND 100),
	CONSTRAINT "collections_name_check" CHECK(length(trim("collections"."name")) BETWEEN 1 AND 120),
	CONSTRAINT "collections_description_check" CHECK(length("collections"."description") <= 5000),
	CONSTRAINT "collections_state_check" CHECK("collections"."state" IN ('draft', 'active', 'archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collections_slug_unique` ON `collections` (`slug`);--> statement-breakpoint
CREATE INDEX `collections_state_name_idx` ON `collections` (`state`,`name`,`id`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`normalized_label` text NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`activated_at` integer,
	`archived_at` integer,
	CONSTRAINT "tags_id_check" CHECK(length("tags"."id") = 30 AND substr("tags"."id", 1, 4) = 'tag_' AND substr("tags"."id", 5, 1) GLOB '[0-7]' AND substr("tags"."id", 5) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "tags_label_check" CHECK(length(trim("tags"."label")) BETWEEN 1 AND 80),
	CONSTRAINT "tags_normalized_label_check" CHECK("tags"."normalized_label" = trim("tags"."normalized_label") AND length("tags"."normalized_label") BETWEEN 1 AND 80),
	CONSTRAINT "tags_state_check" CHECK("tags"."state" IN ('draft', 'active', 'archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_normalized_label_unique` ON `tags` (`normalized_label`);--> statement-breakpoint
CREATE INDEX `tags_state_label_idx` ON `tags` (`state`,`normalized_label`,`id`);