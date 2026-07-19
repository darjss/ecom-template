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
CREATE TABLE `order_discount_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`discount_rule_id` text,
	`rule_name` text NOT NULL,
	`mode` text NOT NULL,
	`code` text,
	`calculation` text NOT NULL,
	`value` integer NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`minimum_subtotal_mnt` integer NOT NULL,
	`global_limit` integer,
	`targets_json` text NOT NULL,
	`submitted_code` text,
	`code_accepted` integer NOT NULL,
	`reason` text NOT NULL,
	`amount_mnt` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`discount_rule_id`) REFERENCES `discount_rules`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "order_discount_adjustments_amount_check" CHECK("order_discount_adjustments"."amount_mnt" > 0),
	CONSTRAINT "order_discount_adjustments_targets_check" CHECK(json_valid("order_discount_adjustments"."targets_json")),
	CONSTRAINT "order_discount_adjustments_code_accepted_check" CHECK("order_discount_adjustments"."code_accepted" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `order_discount_allocations` (
	`adjustment_id` text NOT NULL,
	`order_line_id` text NOT NULL,
	`amount_mnt` integer NOT NULL,
	PRIMARY KEY(`adjustment_id`, `order_line_id`),
	FOREIGN KEY (`adjustment_id`) REFERENCES `order_discount_adjustments`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`order_line_id`) REFERENCES `order_lines`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "order_discount_allocations_amount_check" CHECK("order_discount_allocations"."amount_mnt" > 0)
);
--> statement-breakpoint
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
	`created_at` integer NOT NULL,
	CONSTRAINT "orders_number_check" CHECK("orders"."order_number" > 0),
	CONSTRAINT "orders_state_check" CHECK("orders"."state" IN ('placed', 'completed', 'cancelled')),
	CONSTRAINT "orders_currency_check" CHECK("orders"."currency" = 'MNT'),
	CONSTRAINT "orders_amount_check" CHECK("orders"."subtotal_mnt" >= 0 AND "orders"."discount_total_mnt" >= 0 AND "orders"."discount_total_mnt" <= "orders"."subtotal_mnt" AND "orders"."delivery_fee_mnt" >= 0 AND "orders"."grand_total_mnt" = "orders"."subtotal_mnt" - "orders"."discount_total_mnt" + "orders"."delivery_fee_mnt"),
	CONSTRAINT "orders_destination_check" CHECK(("orders"."fulfillment_mode" = 'delivery' AND "orders"."delivery_address" IS NOT NULL AND "orders"."pickup_location_id" IS NULL AND "orders"."pickup_name" IS NULL AND "orders"."pickup_address" IS NULL) OR ("orders"."fulfillment_mode" = 'pickup' AND "orders"."delivery_address" IS NULL AND "orders"."pickup_location_id" IS NOT NULL AND "orders"."pickup_name" IS NOT NULL AND "orders"."pickup_address" IS NOT NULL)),
	CONSTRAINT "orders_fingerprint_check" CHECK(length("orders"."commercial_fingerprint") = 64),
	CONSTRAINT "orders_free_delivery_check" CHECK("orders"."free_delivery_applied" IN (0, 1) AND ("orders"."free_delivery_threshold_mnt" IS NULL OR "orders"."free_delivery_threshold_mnt" >= 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`order_number`);--> statement-breakpoint
CREATE INDEX `orders_state_created_idx` ON `orders` (`state`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_phone_created_idx` ON `orders` (`recipient_phone`,`created_at`);--> statement-breakpoint
CREATE TABLE `payment_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`kind` text NOT NULL,
	`expected_delta_mnt` integer NOT NULL,
	`confirmed_delta_mnt` integer NOT NULL,
	`refunded_delta_mnt` integer NOT NULL,
	`actor_kind` text NOT NULL,
	`staff_id` text,
	`staff_role` text,
	`telegram_operator_label` text,
	`telegram_user_id` integer,
	`source_channel` text NOT NULL,
	`reason` text,
	`provider_reference` text,
	`observed_at` integer,
	`evidence_json` text,
	`command_correlation_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "payment_entries_kind_check" CHECK("payment_entries"."kind" IN ('expected', 'evidence_received', 'confirmed', 'rejected', 'failed', 'expired', 'superseded', 'released_unresolved', 'refunded', 'correction')),
	CONSTRAINT "payment_entries_actor_check" CHECK(("payment_entries"."actor_kind" = 'staff' AND "payment_entries"."staff_id" IS NOT NULL AND "payment_entries"."staff_role" IN ('owner', 'manager', 'staff') AND "payment_entries"."telegram_operator_label" IS NULL AND "payment_entries"."telegram_user_id" IS NULL) OR ("payment_entries"."actor_kind" = 'telegram_operator' AND "payment_entries"."staff_id" IS NULL AND "payment_entries"."staff_role" IS NULL AND "payment_entries"."telegram_operator_label" IS NOT NULL AND "payment_entries"."telegram_user_id" > 0) OR ("payment_entries"."actor_kind" IN ('system', 'provider') AND "payment_entries"."staff_id" IS NULL AND "payment_entries"."staff_role" IS NULL AND "payment_entries"."telegram_operator_label" IS NULL AND "payment_entries"."telegram_user_id" IS NULL)),
	CONSTRAINT "payment_entries_source_check" CHECK("payment_entries"."source_channel" IN ('storefront', 'admin', 'provider_callback', 'workflow', 'telegram')),
	CONSTRAINT "payment_entries_evidence_check" CHECK("payment_entries"."evidence_json" IS NULL OR json_valid("payment_entries"."evidence_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_entries_payment_sequence_idx` ON `payment_entries` (`payment_id`,`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_entries_provider_reference_idx` ON `payment_entries` (`provider_reference`) WHERE "payment_entries"."provider_reference" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `payment_entries_payment_timeline_idx` ON `payment_entries` (`payment_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`method` text NOT NULL,
	`automated_provider` text,
	`state` text NOT NULL,
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
	`confirmed_at` integer,
	`rejected_at` integer,
	`expired_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "payments_attempt_check" CHECK("payments"."attempt_number" > 0),
	CONSTRAINT "payments_method_check" CHECK("payments"."method" IN ('qpay', 'bank_transfer', 'cash_on_delivery')),
	CONSTRAINT "payments_state_check" CHECK("payments"."state" IN ('pending', 'awaiting_confirmation', 'confirmed', 'failed', 'expired', 'rejected', 'superseded', 'released_unresolved', 'partially_refunded', 'refunded')),
	CONSTRAINT "payments_provider_check" CHECK(("payments"."method" = 'qpay' AND "payments"."automated_provider" IN ('byl', 'direct_qpay')) OR ("payments"."method" <> 'qpay' AND "payments"."automated_provider" IS NULL)),
	CONSTRAINT "payments_amount_check" CHECK("payments"."expected_amount_mnt" > 0 AND "payments"."confirmed_amount_mnt" >= 0 AND "payments"."refunded_amount_mnt" BETWEEN 0 AND "payments"."confirmed_amount_mnt" AND "payments"."refund_obligation_amount_mnt" >= 0),
	CONSTRAINT "payments_refund_obligation_check" CHECK("payments"."refund_obligation_state" IN ('none', 'open', 'partially_satisfied', 'satisfied'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_provider_attempt_reference_unique` ON `payments` (`provider_attempt_reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_provider_payment_reference_unique` ON `payments` (`provider_payment_reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_order_attempt_idx` ON `payments` (`order_id`,`attempt_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_active_attempt_idx` ON `payments` (`order_id`) WHERE "payments"."state" IN ('pending', 'awaiting_confirmation');--> statement-breakpoint
CREATE INDEX `payments_order_idx` ON `payments` (`order_id`);--> statement-breakpoint
CREATE INDEX `payments_provider_attempt_idx` ON `payments` (`automated_provider`,`provider_attempt_reference`);--> statement-breakpoint
CREATE INDEX `payments_deadline_state_idx` ON `payments` (`state`,`effective_deadline`);--> statement-breakpoint
CREATE TABLE `placement_idempotency` (
	`key` text PRIMARY KEY NOT NULL,
	`intent_digest` text NOT NULL,
	`result_json` text NOT NULL,
	`order_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "placement_idempotency_key_check" CHECK(length("placement_idempotency"."key") BETWEEN 1 AND 64),
	CONSTRAINT "placement_idempotency_digest_check" CHECK(length("placement_idempotency"."intent_digest") = 64),
	CONSTRAINT "placement_idempotency_result_check" CHECK(json_valid("placement_idempotency"."result_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `placement_idempotency_order_id_unique` ON `placement_idempotency` (`order_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__placement_migration_guard` (`reservation_count` integer NOT NULL CHECK (`reservation_count` = 0));--> statement-breakpoint
INSERT INTO `__placement_migration_guard` SELECT count(*) FROM `inventory_reservations`;--> statement-breakpoint
DROP TABLE `__placement_migration_guard`;--> statement-breakpoint
CREATE TABLE `__new_inventory_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	`transitioned_at` integer,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "inventory_reservations_id_check" CHECK(length("__new_inventory_reservations"."id") = 38 AND substr("__new_inventory_reservations"."id", 1, 12) = 'reservation_' AND substr("__new_inventory_reservations"."id", 13, 1) GLOB '[0-7]' AND substr("__new_inventory_reservations"."id", 13) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "inventory_reservations_state_check" CHECK("__new_inventory_reservations"."state" IN ('active', 'consumed', 'released', 'expired'))
);
--> statement-breakpoint
INSERT INTO `__new_inventory_reservations`("id", "order_id", "state", "created_at", "transitioned_at") SELECT "id", "order_reference", "state", "created_at", "transitioned_at" FROM `inventory_reservations`;--> statement-breakpoint
DROP TABLE `inventory_reservations`;--> statement-breakpoint
ALTER TABLE `__new_inventory_reservations` RENAME TO `inventory_reservations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_reservations_order_id_unique` ON `inventory_reservations` (`order_id`);--> statement-breakpoint
CREATE INDEX `inventory_reservations_state_idx` ON `inventory_reservations` (`state`,`created_at`);--> statement-breakpoint
CREATE TABLE `__new_inventory_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`stock_item_id` text NOT NULL,
	`reservation_id` text,
	`order_id` text,
	`kind` text NOT NULL,
	`on_hand_delta` integer NOT NULL,
	`reserved_delta` integer DEFAULT 0 NOT NULL,
	`actor_kind` text NOT NULL,
	`staff_id` text,
	`staff_role` text,
	`reason` text NOT NULL,
	`command_correlation_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`reservation_id`) REFERENCES `inventory_reservations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "inventory_entries_id_check" CHECK(length("__new_inventory_entries"."id") = 42 AND substr("__new_inventory_entries"."id", 1, 16) = 'inventory_entry_' AND substr("__new_inventory_entries"."id", 17, 1) GLOB '[0-7]' AND substr("__new_inventory_entries"."id", 17) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "inventory_entries_kind_check" CHECK("__new_inventory_entries"."kind" IN ('opening', 'adjustment', 'reservation', 'release', 'consumption', 'restoration')),
	CONSTRAINT "inventory_entries_actor_check" CHECK(("__new_inventory_entries"."actor_kind" = 'staff' AND "__new_inventory_entries"."staff_id" IS NOT NULL AND "__new_inventory_entries"."staff_role" IN ('owner', 'manager', 'staff')) OR ("__new_inventory_entries"."actor_kind" = 'system' AND "__new_inventory_entries"."staff_id" IS NULL AND "__new_inventory_entries"."staff_role" IS NULL)),
	CONSTRAINT "inventory_entries_reason_check" CHECK(length(trim("__new_inventory_entries"."reason")) BETWEEN 1 AND 240)
);
--> statement-breakpoint
INSERT INTO `__new_inventory_entries`("id", "stock_item_id", "reservation_id", "order_id", "kind", "on_hand_delta", "reserved_delta", "actor_kind", "staff_id", "staff_role", "reason", "command_correlation_id", "created_at") SELECT "id", "stock_item_id", NULL, NULL, "kind", "on_hand_delta", 0, "actor_kind", "staff_id", "staff_role", "reason", "command_correlation_id", "created_at" FROM `inventory_entries`;--> statement-breakpoint
DROP TABLE `inventory_entries`;--> statement-breakpoint
ALTER TABLE `__new_inventory_entries` RENAME TO `inventory_entries`;--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_entries_correlation_stock_idx` ON `inventory_entries` (`command_correlation_id`,`stock_item_id`);--> statement-breakpoint
CREATE INDEX `inventory_entries_stock_timeline_idx` ON `inventory_entries` (`stock_item_id`,`created_at`,`id`);