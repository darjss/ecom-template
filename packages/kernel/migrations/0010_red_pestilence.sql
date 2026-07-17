PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_customers` (
	`id` text PRIMARY KEY NOT NULL,
	`normalized_phone` text NOT NULL,
	`auth_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "customers_phone_check" CHECK("__new_customers"."normalized_phone" GLOB '+976[5-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
	CONSTRAINT "customers_id_check" CHECK(length("__new_customers"."id") = 35 AND substr("__new_customers"."id", 1, 9) = 'customer_' AND substr("__new_customers"."id", 10, 1) GLOB '[0-7]' AND substr("__new_customers"."id", 10) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "customers_auth_identity_check" CHECK("__new_customers"."auth_user_id" = "__new_customers"."id")
);
--> statement-breakpoint
INSERT INTO `__new_customers`("id", "normalized_phone", "auth_user_id", "created_at") SELECT "id", "normalized_phone", "id", "created_at" FROM `customers`;--> statement-breakpoint
DROP TABLE `customers`;--> statement-breakpoint
ALTER TABLE `__new_customers` RENAME TO `customers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DELETE FROM `customer_auth_users` WHERE `id` NOT IN (SELECT `id` FROM `customers`);--> statement-breakpoint
CREATE UNIQUE INDEX `customers_normalized_phone_unique` ON `customers` (`normalized_phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `customers_auth_user_id_unique` ON `customers` (`auth_user_id`);