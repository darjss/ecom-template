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
CREATE TABLE `catalog_item_tags` (
	`catalog_item_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`catalog_item_id`, `tag_id`),
	FOREIGN KEY (`catalog_item_id`) REFERENCES `catalog_items`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `catalog_item_tags_tag_idx` ON `catalog_item_tags` (`tag_id`,`catalog_item_id`);--> statement-breakpoint
CREATE TABLE `catalog_items` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`slug` text NOT NULL,
	`sku` text,
	`sku_compact` text,
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
	CONSTRAINT "catalog_items_sku_check" CHECK(("catalog_items"."kind" = 'product' AND "catalog_items"."sku" IS NULL AND "catalog_items"."sku_compact" IS NULL) OR ("catalog_items"."kind" = 'bundle' AND length(trim("catalog_items"."sku")) BETWEEN 1 AND 64 AND length("catalog_items"."sku_compact") BETWEEN 1 AND 256)),
	CONSTRAINT "catalog_items_id_kind_check" CHECK(("catalog_items"."kind" = 'product' AND length("catalog_items"."id") = 34 AND substr("catalog_items"."id", 1, 8) = 'product_' AND substr("catalog_items"."id", 9, 1) GLOB '[0-7]' AND substr("catalog_items"."id", 9) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*') OR ("catalog_items"."kind" = 'bundle' AND length("catalog_items"."id") = 33 AND substr("catalog_items"."id", 1, 7) = 'bundle_' AND substr("catalog_items"."id", 8, 1) GLOB '[0-7]' AND substr("catalog_items"."id", 8) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_items_slug_unique` ON `catalog_items` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_items_sku_compact_idx` ON `catalog_items` (`sku_compact`) WHERE "catalog_items"."sku_compact" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `catalog_items_public_idx` ON `catalog_items` (`state`,`kind`,`id`);--> statement-breakpoint
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
CREATE TABLE `cms_documents` (
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`schema_version` integer NOT NULL,
	`content_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`published_at` integer,
	PRIMARY KEY(`kind`, `status`),
	CONSTRAINT "cms_documents_kind_check" CHECK("cms_documents"."kind" IN ('storefront_identity', 'homepage', 'navigation', 'locations', 'policies', 'announcement', 'ordering_notices')),
	CONSTRAINT "cms_documents_status_check" CHECK("cms_documents"."status" IN ('draft', 'published')),
	CONSTRAINT "cms_documents_version_check" CHECK("cms_documents"."schema_version" = 1),
	CONSTRAINT "cms_documents_json_check" CHECK(json_valid("cms_documents"."content_json")),
	CONSTRAINT "cms_documents_lifecycle_check" CHECK(("cms_documents"."status" = 'draft' AND "cms_documents"."published_at" IS NULL) OR ("cms_documents"."status" = 'published' AND "cms_documents"."published_at" IS NOT NULL))
);
--> statement-breakpoint
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
CREATE TABLE `commerce_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`bank_transfer_enabled` integer NOT NULL,
	`cash_on_delivery_enabled` integer NOT NULL,
	`customer_accounts_enabled` integer NOT NULL,
	`telegram_enabled` integer NOT NULL,
	`pickup_enabled` integer NOT NULL,
	`delivery_enabled` integer NOT NULL,
	`delivery_fee_mnt` integer NOT NULL,
	`free_delivery_threshold_mnt` integer,
	`updated_at` integer NOT NULL,
	CONSTRAINT "commerce_settings_key_check" CHECK("commerce_settings"."key" = 'commerce'),
	CONSTRAINT "commerce_settings_booleans_check" CHECK("commerce_settings"."bank_transfer_enabled" IN (0, 1) AND "commerce_settings"."cash_on_delivery_enabled" IN (0, 1) AND "commerce_settings"."customer_accounts_enabled" IN (0, 1) AND "commerce_settings"."telegram_enabled" IN (0, 1) AND "commerce_settings"."pickup_enabled" IN (0, 1) AND "commerce_settings"."delivery_enabled" IN (0, 1)),
	CONSTRAINT "commerce_settings_delivery_fee_check" CHECK("commerce_settings"."delivery_fee_mnt" BETWEEN 0 AND 10000000),
	CONSTRAINT "commerce_settings_free_threshold_check" CHECK("commerce_settings"."free_delivery_threshold_mnt" IS NULL OR "commerce_settings"."free_delivery_threshold_mnt" BETWEEN 0 AND 1000000000)
);
--> statement-breakpoint
CREATE TABLE `customer_otp_challenges` (
	`normalized_phone` text PRIMARY KEY NOT NULL,
	`digest` text NOT NULL,
	`request_id` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "customer_otp_challenges_attempts_check" CHECK("customer_otp_challenges"."attempts" BETWEEN 0 AND 4),
	CONSTRAINT "customer_otp_challenges_digest_check" CHECK(length("customer_otp_challenges"."digest") = 64),
	CONSTRAINT "customer_otp_challenges_request_id_check" CHECK(length("customer_otp_challenges"."request_id") = 36),
	CONSTRAINT "customer_otp_challenges_expiry_check" CHECK("customer_otp_challenges"."created_at" < "customer_otp_challenges"."expires_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_otp_challenges_request_id_unique` ON `customer_otp_challenges` (`request_id`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`normalized_phone` text NOT NULL,
	`auth_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "customers_phone_check" CHECK("customers"."normalized_phone" GLOB '+976[5-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
	CONSTRAINT "customers_id_check" CHECK(length("customers"."id") = 35 AND substr("customers"."id", 1, 9) = 'customer_' AND substr("customers"."id", 10, 1) GLOB '[0-7]' AND substr("customers"."id", 10) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "customers_auth_identity_check" CHECK("customers"."auth_user_id" = "customers"."id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_normalized_phone_unique` ON `customers` (`normalized_phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `customers_auth_user_id_unique` ON `customers` (`auth_user_id`);--> statement-breakpoint
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
	CONSTRAINT "discount_rules_redemption_count_check" CHECK("discount_rules"."redemption_count" >= 0),
	CONSTRAINT "discount_rules_targets_check" CHECK(json_valid("discount_rules"."targets_json") AND json_type("discount_rules"."targets_json") = 'array' AND json_array_length("discount_rules"."targets_json") BETWEEN 1 AND 100),
	CONSTRAINT "discount_rules_revision_check" CHECK("discount_rules"."revision" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discount_rules_code_idx` ON `discount_rules` (`code`) WHERE "discount_rules"."code" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `discount_rules_eligibility_idx` ON `discount_rules` (`state`,`starts_at`,`ends_at`,`id`);--> statement-breakpoint
CREATE TABLE `fulfillments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`mode` text NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fulfillments_order_id_unique` ON `fulfillments` (`order_id`);--> statement-breakpoint
CREATE INDEX `fulfillments_state_idx` ON `fulfillments` (`state`,`created_at`);--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`declared_content_type` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "media_assets_id_check" CHECK(length("media_assets"."id") = 32 AND substr("media_assets"."id", 1, 6) = 'media_' AND substr("media_assets"."id", 7, 1) GLOB '[0-7]' AND substr("media_assets"."id", 7) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "media_assets_content_type_check" CHECK("media_assets"."declared_content_type" IN ('image/jpeg', 'image/png', 'image/webp'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_assets_object_key_unique` ON `media_assets` (`object_key`);--> statement-breakpoint
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
	CONSTRAINT "option_groups_id_check" CHECK(length("option_groups"."id") = 39 AND substr("option_groups"."id", 1, 13) = 'option_group_' AND substr("option_groups"."id", 14, 1) GLOB '[0-7]' AND substr("option_groups"."id", 14) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "option_groups_key_check" CHECK(length("option_groups"."key") BETWEEN 1 AND 48),
	CONSTRAINT "option_groups_label_check" CHECK(length(trim("option_groups"."label")) BETWEEN 1 AND 80),
	CONSTRAINT "option_groups_position_check" CHECK("option_groups"."position" BETWEEN 0 AND 99),
	CONSTRAINT "option_groups_state_check" CHECK("option_groups"."state" IN ('active', 'archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `option_groups_product_key_idx` ON `option_groups` (`product_id`,`key`) WHERE "option_groups"."state" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX `option_groups_product_position_idx` ON `option_groups` (`product_id`,`position`) WHERE "option_groups"."state" = 'active';--> statement-breakpoint
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
	CONSTRAINT "option_values_id_check" CHECK(length("option_values"."id") = 39 AND substr("option_values"."id", 1, 13) = 'option_value_' AND substr("option_values"."id", 14, 1) GLOB '[0-7]' AND substr("option_values"."id", 14) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "option_values_key_check" CHECK(length("option_values"."key") BETWEEN 1 AND 48),
	CONSTRAINT "option_values_label_check" CHECK(length(trim("option_values"."label")) BETWEEN 1 AND 80),
	CONSTRAINT "option_values_position_check" CHECK("option_values"."position" BETWEEN 0 AND 99),
	CONSTRAINT "option_values_state_check" CHECK("option_values"."state" IN ('active', 'archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `option_values_group_key_idx` ON `option_values` (`option_group_id`,`key`) WHERE "option_values"."state" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX `option_values_group_position_idx` ON `option_values` (`option_group_id`,`position`) WHERE "option_values"."state" = 'active';--> statement-breakpoint
CREATE INDEX `option_values_group_state_idx` ON `option_values` (`option_group_id`,`state`);--> statement-breakpoint
CREATE TABLE `order_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`position` integer NOT NULL,
	`catalog_item_id` text NOT NULL,
	`item_kind` text NOT NULL,
	`variant_id` text,
	`item_name` text NOT NULL,
	`sku` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price_mnt` integer NOT NULL,
	`merchandise_amount_mnt` integer NOT NULL,
	`discount_mnt` integer NOT NULL,
	`total_mnt` integer NOT NULL,
	`options_json` text NOT NULL,
	`personalizations_json` text NOT NULL,
	`bundle_components_json` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "order_lines_quantity_check" CHECK("order_lines"."quantity" BETWEEN 1 AND 999),
	CONSTRAINT "order_lines_amount_check" CHECK("order_lines"."unit_price_mnt" >= 0 AND "order_lines"."merchandise_amount_mnt" = "order_lines"."unit_price_mnt" * "order_lines"."quantity" AND "order_lines"."discount_mnt" >= 0 AND "order_lines"."total_mnt" = "order_lines"."merchandise_amount_mnt" - "order_lines"."discount_mnt"),
	CONSTRAINT "order_lines_json_check" CHECK(json_valid("order_lines"."options_json") AND json_valid("order_lines"."personalizations_json") AND json_valid("order_lines"."bundle_components_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_lines_order_position_idx` ON `order_lines` (`order_id`,`position`);--> statement-breakpoint
CREATE INDEX `order_lines_order_idx` ON `order_lines` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`placement_key` text NOT NULL,
	`placement_intent_digest` text NOT NULL,
	`order_number` integer NOT NULL,
	`state` text NOT NULL,
	`customer_id` text,
	`customer_linked_at` integer,
	`status_token_hash` text,
	`recipient_name` text NOT NULL,
	`recipient_phone` text NOT NULL,
	`currency` text NOT NULL,
	`subtotal_mnt` integer NOT NULL,
	`discount_total_mnt` integer NOT NULL,
	`delivery_fee_mnt` integer NOT NULL,
	`grand_total_mnt` integer NOT NULL,
	`free_delivery_threshold_mnt` integer,
	`free_delivery_applied` integer NOT NULL,
	`commerce_settings_updated_at` integer NOT NULL,
	`fulfillment_mode` text NOT NULL,
	`delivery_address` text,
	`pickup_location_id` text,
	`pickup_name` text,
	`pickup_address` text,
	`commercial_fingerprint` text NOT NULL,
	`placed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "orders_number_check" CHECK("orders"."order_number" > 0),
	CONSTRAINT "orders_placement_key_check" CHECK(length("orders"."placement_key") = 36),
	CONSTRAINT "orders_placement_digest_check" CHECK(length("orders"."placement_intent_digest") = 64 AND "orders"."placement_intent_digest" NOT GLOB '*[^0123456789abcdef]*'),
	CONSTRAINT "orders_state_check" CHECK("orders"."state" IN ('placed', 'completed', 'cancelled')),
	CONSTRAINT "orders_currency_check" CHECK("orders"."currency" = 'MNT'),
	CONSTRAINT "orders_amount_check" CHECK("orders"."subtotal_mnt" >= 0 AND "orders"."discount_total_mnt" >= 0 AND "orders"."discount_total_mnt" <= "orders"."subtotal_mnt" AND "orders"."delivery_fee_mnt" >= 0 AND "orders"."grand_total_mnt" = "orders"."subtotal_mnt" - "orders"."discount_total_mnt" + "orders"."delivery_fee_mnt"),
	CONSTRAINT "orders_destination_check" CHECK(("orders"."fulfillment_mode" = 'delivery' AND "orders"."delivery_address" IS NOT NULL AND "orders"."pickup_location_id" IS NULL AND "orders"."pickup_name" IS NULL AND "orders"."pickup_address" IS NULL) OR ("orders"."fulfillment_mode" = 'pickup' AND "orders"."delivery_address" IS NULL AND "orders"."pickup_location_id" IS NOT NULL AND "orders"."pickup_name" IS NOT NULL AND "orders"."pickup_address" IS NOT NULL)),
	CONSTRAINT "orders_fingerprint_check" CHECK(length("orders"."commercial_fingerprint") = 64),
	CONSTRAINT "orders_customer_link_check" CHECK(("orders"."customer_id" IS NULL AND "orders"."customer_linked_at" IS NULL) OR ("orders"."customer_id" IS NOT NULL AND "orders"."customer_linked_at" IS NOT NULL)),
	CONSTRAINT "orders_status_token_check" CHECK("orders"."status_token_hash" IS NULL OR (length("orders"."status_token_hash") = 64 AND "orders"."status_token_hash" NOT GLOB '*[^0123456789abcdef]*')),
	CONSTRAINT "orders_free_delivery_check" CHECK("orders"."free_delivery_applied" IN (0, 1) AND ("orders"."free_delivery_threshold_mnt" IS NULL OR "orders"."free_delivery_threshold_mnt" >= 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_placement_key_unique` ON `orders` (`placement_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`order_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_status_token_hash_unique` ON `orders` (`status_token_hash`);--> statement-breakpoint
CREATE INDEX `orders_state_created_idx` ON `orders` (`state`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_customer_created_idx` ON `orders` (`customer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_phone_created_idx` ON `orders` (`recipient_phone`,`created_at`) WHERE "orders"."customer_id" IS NULL;--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`method` text NOT NULL,
	`automated_provider` text,
	`status` text NOT NULL,
	`expected_amount_mnt` integer NOT NULL,
	`confirmed_amount_mnt` integer DEFAULT 0 NOT NULL,
	`refunded_amount_mnt` integer DEFAULT 0 NOT NULL,
	`provider_attempt_reference` text,
	`provider_payment_reference` text,
	`provider_deadline` integer,
	`effective_deadline` integer,
	`workflow_instance_id` text,
	`refund_obligation_amount_mnt` integer DEFAULT 0 NOT NULL,
	`refund_obligation_state` text DEFAULT 'none' NOT NULL,
	`confirmed_by` text,
	`confirmed_at` integer,
	`rejected_at` integer,
	`expired_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`confirmed_by`) REFERENCES `staff_members`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "payments_attempt_check" CHECK("payments"."attempt_number" > 0),
	CONSTRAINT "payments_method_check" CHECK("payments"."method" IN ('qpay', 'bank_transfer', 'cash_on_delivery')),
	CONSTRAINT "payments_status_check" CHECK("payments"."status" IN ('pending', 'awaiting_confirmation', 'confirmed', 'failed', 'expired', 'rejected', 'superseded', 'released_unresolved', 'partially_refunded', 'refunded')),
	CONSTRAINT "payments_provider_check" CHECK(("payments"."method" = 'qpay' AND "payments"."automated_provider" IN ('byl', 'direct_qpay')) OR ("payments"."method" <> 'qpay' AND "payments"."automated_provider" IS NULL)),
	CONSTRAINT "payments_amount_check" CHECK("payments"."expected_amount_mnt" > 0 AND "payments"."confirmed_amount_mnt" >= 0 AND "payments"."refunded_amount_mnt" BETWEEN 0 AND "payments"."confirmed_amount_mnt" AND "payments"."refund_obligation_amount_mnt" >= 0),
	CONSTRAINT "payments_refund_obligation_check" CHECK("payments"."refund_obligation_state" IN ('none', 'open', 'partially_satisfied', 'satisfied'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_provider_attempt_reference_unique` ON `payments` (`provider_attempt_reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_provider_payment_reference_unique` ON `payments` (`provider_payment_reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_order_attempt_idx` ON `payments` (`order_id`,`attempt_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_active_attempt_idx` ON `payments` (`order_id`) WHERE "payments"."status" IN ('pending', 'awaiting_confirmation');--> statement-breakpoint
CREATE INDEX `payments_order_idx` ON `payments` (`order_id`);--> statement-breakpoint
CREATE INDEX `payments_provider_attempt_idx` ON `payments` (`automated_provider`,`provider_attempt_reference`);--> statement-breakpoint
CREATE INDEX `payments_deadline_status_idx` ON `payments` (`status`,`effective_deadline`);--> statement-breakpoint
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
CREATE UNIQUE INDEX `personalization_values_definition_position_idx` ON `personalization_values` (`personalization_id`,`position`);--> statement-breakpoint
CREATE TABLE `staff_members` (
	`id` text PRIMARY KEY NOT NULL,
	`normalized_email` text NOT NULL,
	`auth_user_id` text,
	`status` text NOT NULL,
	`role` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`approved_at` integer,
	`revoked_at` integer,
	CONSTRAINT "staff_members_status_check" CHECK("staff_members"."status" IN ('pending', 'active', 'revoked')),
	CONSTRAINT "staff_members_role_check" CHECK("staff_members"."role" IS NULL OR "staff_members"."role" IN ('owner', 'manager', 'staff')),
	CONSTRAINT "staff_members_id_check" CHECK(length("staff_members"."id") = 32 AND substr("staff_members"."id", 1, 6) = 'staff_' AND substr("staff_members"."id", 7, 1) GLOB '[0-7]' AND substr("staff_members"."id", 7) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "staff_members_lifecycle_check" CHECK(("staff_members"."status" = 'pending' AND "staff_members"."approved_at" IS NULL AND "staff_members"."revoked_at" IS NULL) OR ("staff_members"."status" = 'active' AND "staff_members"."role" IS NOT NULL AND "staff_members"."approved_at" IS NOT NULL AND "staff_members"."revoked_at" IS NULL) OR ("staff_members"."status" = 'revoked' AND "staff_members"."approved_at" IS NOT NULL AND "staff_members"."revoked_at" IS NOT NULL)),
	CONSTRAINT "staff_members_lifecycle_order_check" CHECK("staff_members"."created_at" <= "staff_members"."updated_at" AND ("staff_members"."approved_at" IS NULL OR ("staff_members"."created_at" <= "staff_members"."approved_at" AND "staff_members"."approved_at" <= "staff_members"."updated_at")) AND ("staff_members"."revoked_at" IS NULL OR ("staff_members"."approved_at" <= "staff_members"."revoked_at" AND "staff_members"."revoked_at" <= "staff_members"."updated_at")))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_members_normalized_email_unique` ON `staff_members` (`normalized_email`);--> statement-breakpoint
CREATE UNIQUE INDEX `staff_members_auth_user_id_unique` ON `staff_members` (`auth_user_id`);--> statement-breakpoint
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
CREATE INDEX `tags_state_label_idx` ON `tags` (`state`,`normalized_label`,`id`);--> statement-breakpoint
CREATE TABLE `variant_option_values` (
	`variant_id` text NOT NULL,
	`option_value_id` text NOT NULL,
	PRIMARY KEY(`variant_id`, `option_value_id`),
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`option_value_id`) REFERENCES `option_values`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `variant_option_values_value_idx` ON `variant_option_values` (`option_value_id`,`variant_id`);--> statement-breakpoint
CREATE TABLE `variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`is_default` integer NOT NULL,
	`combination_key` text NOT NULL,
	`sku` text NOT NULL,
	`sku_compact` text NOT NULL,
	`price_override_mnt` integer,
	`image_media_asset_id` text,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `catalog_items`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`image_media_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "variants_id_check" CHECK(length("variants"."id") = 34 AND substr("variants"."id", 1, 8) = 'variant_' AND substr("variants"."id", 9, 1) GLOB '[0-7]' AND substr("variants"."id", 9) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "variants_default_check" CHECK("variants"."is_default" IN (0, 1)),
	CONSTRAINT "variants_combination_check" CHECK(length("variants"."combination_key") BETWEEN 1 AND 512),
	CONSTRAINT "variants_sku_check" CHECK(length(trim("variants"."sku")) BETWEEN 1 AND 64),
	CONSTRAINT "variants_sku_compact_check" CHECK(length("variants"."sku_compact") BETWEEN 1 AND 256),
	CONSTRAINT "variants_price_override_check" CHECK("variants"."price_override_mnt" IS NULL OR "variants"."price_override_mnt" > 0),
	CONSTRAINT "variants_state_check" CHECK("variants"."state" IN ('active', 'archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `variants_default_product_idx` ON `variants` (`product_id`) WHERE "variants"."is_default" = 1;--> statement-breakpoint
CREATE UNIQUE INDEX `variants_product_combination_idx` ON `variants` (`product_id`,`combination_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `variants_sku_compact_idx` ON `variants` (`sku_compact`);--> statement-breakpoint
CREATE INDEX `variants_product_state_idx` ON `variants` (`product_id`,`state`);--> statement-breakpoint
CREATE INDEX `variants_image_media_idx` ON `variants` (`image_media_asset_id`);--> statement-breakpoint
CREATE TABLE `customer_auth_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `customer_auth_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `customer_auth_accounts_userId_idx` ON `customer_auth_accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `customer_auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `customer_auth_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_auth_sessions_token_unique` ON `customer_auth_sessions` (`token`);--> statement-breakpoint
CREATE INDEX `customer_auth_sessions_userId_idx` ON `customer_auth_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `customer_auth_users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_auth_users_email_unique` ON `customer_auth_users` (`email`);--> statement-breakpoint
CREATE TABLE `customer_auth_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customer_auth_verifications_identifier_idx` ON `customer_auth_verifications` (`identifier`);--> statement-breakpoint
CREATE TABLE `staff_auth_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `staff_auth_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `staff_auth_accounts_userId_idx` ON `staff_auth_accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `staff_auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`role` text,
	`staff_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `staff_auth_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_auth_sessions_token_unique` ON `staff_auth_sessions` (`token`);--> statement-breakpoint
CREATE INDEX `staff_auth_sessions_userId_idx` ON `staff_auth_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `staff_auth_users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_auth_users_email_unique` ON `staff_auth_users` (`email`);--> statement-breakpoint
CREATE TABLE `staff_auth_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `staff_auth_verifications_identifier_idx` ON `staff_auth_verifications` (`identifier`);