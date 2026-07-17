CREATE TABLE `catalog_item_images` (
	`catalog_item_id` text NOT NULL,
	`media_asset_id` text NOT NULL,
	`position` integer NOT NULL,
	`alt_text` text NOT NULL,
	PRIMARY KEY(`catalog_item_id`, `position`),
	FOREIGN KEY (`catalog_item_id`) REFERENCES `catalog_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "catalog_item_images_position_check" CHECK("catalog_item_images"."position" BETWEEN 0 AND 7),
	CONSTRAINT "catalog_item_images_alt_text_check" CHECK("catalog_item_images"."alt_text" = trim("catalog_item_images"."alt_text") AND length("catalog_item_images"."alt_text") BETWEEN 1 AND 240)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_item_images_asset_idx` ON `catalog_item_images` (`catalog_item_id`,`media_asset_id`);--> statement-breakpoint
CREATE INDEX `catalog_item_images_media_idx` ON `catalog_item_images` (`media_asset_id`);--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`declared_content_type` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "media_assets_id_check" CHECK(length("media_assets"."id") = 32 AND substr("media_assets"."id", 1, 6) = 'media_' AND substr("media_assets"."id", 7, 1) GLOB '[0-7]' AND substr("media_assets"."id", 7) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "media_assets_content_type_check" CHECK("media_assets"."declared_content_type" IN ('image/jpeg', 'image/png', 'image/webp'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_assets_object_key_unique` ON `media_assets` (`object_key`);