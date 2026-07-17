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
	CONSTRAINT "customers_id_check" CHECK(length("customers"."id") = 35 AND substr("customers"."id", 1, 9) = 'customer_' AND substr("customers"."id", 10, 1) GLOB '[0-7]' AND substr("customers"."id", 10) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_normalized_phone_unique` ON `customers` (`normalized_phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `customers_auth_user_id_unique` ON `customers` (`auth_user_id`);