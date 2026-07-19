CREATE TABLE `guest_tracking_links` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "guest_tracking_links_id_check" CHECK(length("guest_tracking_links"."id") = 40 AND substr("guest_tracking_links"."id", 1, 14) = 'tracking_link_' AND substr("guest_tracking_links"."id", 15, 1) GLOB '[0-7]' AND substr("guest_tracking_links"."id", 15) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "guest_tracking_links_hash_check" CHECK(length("guest_tracking_links"."token_hash") = 64),
	CONSTRAINT "guest_tracking_links_expiry_check" CHECK("guest_tracking_links"."created_at" < "guest_tracking_links"."expires_at"),
	CONSTRAINT "guest_tracking_links_revocation_check" CHECK("guest_tracking_links"."revoked_at" IS NULL OR "guest_tracking_links"."created_at" <= "guest_tracking_links"."revoked_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guest_tracking_links_order_id_unique` ON `guest_tracking_links` (`order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `guest_tracking_links_token_hash_unique` ON `guest_tracking_links` (`token_hash`);--> statement-breakpoint
CREATE INDEX `guest_tracking_links_expiry_idx` ON `guest_tracking_links` (`expires_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` integer NOT NULL,
	`state` text NOT NULL,
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
	`terminal_at` integer,
	`created_at` integer NOT NULL,
	CONSTRAINT "orders_number_check" CHECK("__new_orders"."order_number" > 0),
	CONSTRAINT "orders_state_check" CHECK("__new_orders"."state" IN ('placed', 'completed', 'cancelled')),
	CONSTRAINT "orders_currency_check" CHECK("__new_orders"."currency" = 'MNT'),
	CONSTRAINT "orders_amount_check" CHECK("__new_orders"."subtotal_mnt" >= 0 AND "__new_orders"."discount_total_mnt" >= 0 AND "__new_orders"."discount_total_mnt" <= "__new_orders"."subtotal_mnt" AND "__new_orders"."delivery_fee_mnt" >= 0 AND "__new_orders"."grand_total_mnt" = "__new_orders"."subtotal_mnt" - "__new_orders"."discount_total_mnt" + "__new_orders"."delivery_fee_mnt"),
	CONSTRAINT "orders_destination_check" CHECK(("__new_orders"."fulfillment_mode" = 'delivery' AND "__new_orders"."delivery_address" IS NOT NULL AND "__new_orders"."pickup_location_id" IS NULL AND "__new_orders"."pickup_name" IS NULL AND "__new_orders"."pickup_address" IS NULL) OR ("__new_orders"."fulfillment_mode" = 'pickup' AND "__new_orders"."delivery_address" IS NULL AND "__new_orders"."pickup_location_id" IS NOT NULL AND "__new_orders"."pickup_name" IS NOT NULL AND "__new_orders"."pickup_address" IS NOT NULL)),
	CONSTRAINT "orders_fingerprint_check" CHECK(length("__new_orders"."commercial_fingerprint") = 64),
	CONSTRAINT "orders_terminal_check" CHECK(("__new_orders"."state" = 'placed' AND "__new_orders"."terminal_at" IS NULL) OR ("__new_orders"."state" IN ('completed', 'cancelled') AND "__new_orders"."terminal_at" IS NOT NULL AND "__new_orders"."placed_at" <= "__new_orders"."terminal_at")),
	CONSTRAINT "orders_free_delivery_check" CHECK("__new_orders"."free_delivery_applied" IN (0, 1) AND ("__new_orders"."free_delivery_threshold_mnt" IS NULL OR "__new_orders"."free_delivery_threshold_mnt" >= 0))
);
--> statement-breakpoint
INSERT INTO `__new_orders`("id", "order_number", "state", "recipient_name", "recipient_phone", "currency", "subtotal_mnt", "discount_total_mnt", "delivery_fee_mnt", "grand_total_mnt", "free_delivery_threshold_mnt", "free_delivery_applied", "commerce_settings_updated_at", "fulfillment_mode", "delivery_address", "pickup_location_id", "pickup_name", "pickup_address", "commercial_fingerprint", "placed_at", "terminal_at", "created_at") SELECT "id", "order_number", "state", "recipient_name", "recipient_phone", "currency", "subtotal_mnt", "discount_total_mnt", "delivery_fee_mnt", "grand_total_mnt", "free_delivery_threshold_mnt", "free_delivery_applied", "commerce_settings_updated_at", "fulfillment_mode", "delivery_address", "pickup_location_id", "pickup_name", "pickup_address", "commercial_fingerprint", "placed_at", NULL, "created_at" FROM `orders`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `__new_orders` RENAME TO `orders`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`order_number`);--> statement-breakpoint
CREATE INDEX `orders_state_created_idx` ON `orders` (`state`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_phone_created_idx` ON `orders` (`recipient_phone`,`created_at`);