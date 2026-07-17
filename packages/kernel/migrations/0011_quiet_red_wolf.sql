CREATE TABLE `catalog_cache_purge_debts` (
	`product_id` text PRIMARY KEY NOT NULL,
	`revision` text NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`request_id` text,
	`command_committed_at` integer NOT NULL,
	`last_attempted_at` integer,
	FOREIGN KEY (`product_id`) REFERENCES `catalog_items`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "catalog_cache_purge_debts_revision_check" CHECK(length("catalog_cache_purge_debts"."revision") = 36),
	CONSTRAINT "catalog_cache_purge_debts_attempt_check" CHECK("catalog_cache_purge_debts"."attempt_count" BETWEEN 0 AND 1000000),
	CONSTRAINT "catalog_cache_purge_debts_request_check" CHECK("catalog_cache_purge_debts"."request_id" IS NULL OR length("catalog_cache_purge_debts"."request_id") BETWEEN 1 AND 128)
);
--> statement-breakpoint
CREATE TABLE `catalog_items` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`slug` text NOT NULL,
	`state` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price_mnt` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`published_at` integer,
	`archived_at` integer,
	CONSTRAINT "catalog_items_kind_check" CHECK("catalog_items"."kind" IN ('product', 'bundle')),
	CONSTRAINT "catalog_items_state_check" CHECK("catalog_items"."state" IN ('draft', 'published', 'archived')),
	CONSTRAINT "catalog_items_price_check" CHECK("catalog_items"."price_mnt" > 0),
	CONSTRAINT "catalog_items_name_check" CHECK(length(trim("catalog_items"."name")) BETWEEN 1 AND 120),
	CONSTRAINT "catalog_items_slug_check" CHECK(length("catalog_items"."slug") BETWEEN 1 AND 100),
	CONSTRAINT "catalog_items_id_kind_check" CHECK(("catalog_items"."kind" = 'product' AND length("catalog_items"."id") = 34 AND substr("catalog_items"."id", 1, 8) = 'product_' AND substr("catalog_items"."id", 9, 1) GLOB '[0-7]' AND substr("catalog_items"."id", 9) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*') OR ("catalog_items"."kind" = 'bundle' AND length("catalog_items"."id") = 33 AND substr("catalog_items"."id", 1, 7) = 'bundle_' AND substr("catalog_items"."id", 8, 1) GLOB '[0-7]' AND substr("catalog_items"."id", 8) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_items_slug_unique` ON `catalog_items` (`slug`);--> statement-breakpoint
CREATE INDEX `catalog_items_public_idx` ON `catalog_items` (`state`,`kind`,`id`);--> statement-breakpoint
CREATE TABLE `idempotency_records` (
	`scope` text NOT NULL,
	`key` text NOT NULL,
	`request_hash` text NOT NULL,
	`result_kind` text NOT NULL,
	`result_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`scope`, `key`),
	CONSTRAINT "idempotency_records_scope_check" CHECK(length("idempotency_records"."scope") BETWEEN 1 AND 64),
	CONSTRAINT "idempotency_records_key_check" CHECK(length("idempotency_records"."key") BETWEEN 1 AND 128),
	CONSTRAINT "idempotency_records_hash_check" CHECK(length("idempotency_records"."request_hash") = 64),
	CONSTRAINT "idempotency_records_result_check" CHECK(length("idempotency_records"."result_kind") BETWEEN 1 AND 64 AND length("idempotency_records"."result_id") BETWEEN 1 AND 128)
);
--> statement-breakpoint
CREATE TABLE `inventory_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`stock_item_id` text NOT NULL,
	`kind` text NOT NULL,
	`on_hand_delta` integer NOT NULL,
	`actor_kind` text NOT NULL,
	`staff_id` text NOT NULL,
	`staff_role` text NOT NULL,
	`reason` text NOT NULL,
	`command_correlation_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "inventory_entries_id_check" CHECK(length("inventory_entries"."id") = 42 AND substr("inventory_entries"."id", 1, 16) = 'inventory_entry_' AND substr("inventory_entries"."id", 17, 1) GLOB '[0-7]' AND substr("inventory_entries"."id", 17) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "inventory_entries_kind_check" CHECK("inventory_entries"."kind" IN ('opening', 'adjustment')),
	CONSTRAINT "inventory_entries_actor_check" CHECK("inventory_entries"."actor_kind" = 'staff' AND "inventory_entries"."staff_role" IN ('owner', 'manager', 'staff')),
	CONSTRAINT "inventory_entries_reason_check" CHECK(length(trim("inventory_entries"."reason")) BETWEEN 1 AND 240)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_entries_correlation_stock_idx` ON `inventory_entries` (`command_correlation_id`,`stock_item_id`);--> statement-breakpoint
CREATE INDEX `inventory_entries_stock_timeline_idx` ON `inventory_entries` (`stock_item_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `inventory_reservation_items` (
	`reservation_id` text NOT NULL,
	`stock_item_id` text NOT NULL,
	`quantity` integer NOT NULL,
	PRIMARY KEY(`reservation_id`, `stock_item_id`),
	FOREIGN KEY (`reservation_id`) REFERENCES `inventory_reservations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "inventory_reservation_items_quantity_check" CHECK("inventory_reservation_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE INDEX `inventory_reservation_items_stock_idx` ON `inventory_reservation_items` (`stock_item_id`);--> statement-breakpoint
CREATE TABLE `inventory_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`order_reference` text NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	`transitioned_at` integer,
	CONSTRAINT "inventory_reservations_id_check" CHECK(length("inventory_reservations"."id") = 38 AND substr("inventory_reservations"."id", 1, 12) = 'reservation_' AND substr("inventory_reservations"."id", 13, 1) GLOB '[0-7]' AND substr("inventory_reservations"."id", 13) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "inventory_reservations_state_check" CHECK("inventory_reservations"."state" IN ('active', 'consumed', 'released', 'expired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_reservations_order_reference_unique` ON `inventory_reservations` (`order_reference`);--> statement-breakpoint
CREATE INDEX `inventory_reservations_state_idx` ON `inventory_reservations` (`state`,`created_at`);--> statement-breakpoint
CREATE TABLE `skus` (
	`sku` text NOT NULL,
	`sku_compact` text PRIMARY KEY NOT NULL,
	`owner_kind` text NOT NULL,
	`variant_id` text,
	`bundle_id` text,
	`locked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`bundle_id`) REFERENCES `catalog_items`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "skus_owner_check" CHECK(("skus"."owner_kind" = 'variant' AND "skus"."variant_id" IS NOT NULL AND "skus"."bundle_id" IS NULL) OR ("skus"."owner_kind" = 'bundle' AND "skus"."variant_id" IS NULL AND "skus"."bundle_id" IS NOT NULL)),
	CONSTRAINT "skus_value_check" CHECK(length(trim("skus"."sku")) BETWEEN 1 AND 64),
	CONSTRAINT "skus_compact_check" CHECK(length("skus"."sku_compact") BETWEEN 1 AND 256)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skus_sku_unique` ON `skus` (`sku`);--> statement-breakpoint
CREATE UNIQUE INDEX `skus_variant_id_unique` ON `skus` (`variant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `skus_bundle_id_unique` ON `skus` (`bundle_id`);--> statement-breakpoint
CREATE TABLE `stock_items` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`on_hand_quantity` integer NOT NULL,
	`reserved_quantity` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "stock_items_id_check" CHECK(length("stock_items"."id") = 37 AND substr("stock_items"."id", 1, 11) = 'stock_item_' AND substr("stock_items"."id", 12, 1) GLOB '[0-7]' AND substr("stock_items"."id", 12) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "stock_items_balance_check" CHECK("stock_items"."on_hand_quantity" BETWEEN 0 AND 1000000 AND "stock_items"."reserved_quantity" >= 0 AND "stock_items"."reserved_quantity" <= "stock_items"."on_hand_quantity")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stock_items_variant_id_unique` ON `stock_items` (`variant_id`);--> statement-breakpoint
CREATE TABLE `variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`is_default` integer NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `catalog_items`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "variants_id_check" CHECK(length("variants"."id") = 34 AND substr("variants"."id", 1, 8) = 'variant_' AND substr("variants"."id", 9, 1) GLOB '[0-7]' AND substr("variants"."id", 9) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "variants_default_check" CHECK("variants"."is_default" IN (0, 1)),
	CONSTRAINT "variants_state_check" CHECK("variants"."state" IN ('active', 'archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `variants_default_product_idx` ON `variants` (`product_id`) WHERE "variants"."is_default" = 1;--> statement-breakpoint
CREATE INDEX `variants_product_state_idx` ON `variants` (`product_id`,`state`);