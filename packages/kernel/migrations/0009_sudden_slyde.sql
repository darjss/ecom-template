CREATE TABLE `customer_otp_rate_admissions` (
	`request_id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "customer_otp_rate_admissions_request_id_check" CHECK(length("customer_otp_rate_admissions"."request_id") = 36)
);
--> statement-breakpoint
CREATE INDEX `customer_otp_rate_admissions_created_idx` ON `customer_otp_rate_admissions` (`created_at`);--> statement-breakpoint
CREATE TABLE `customer_otp_rate_counters` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL,
	CONSTRAINT "customer_otp_rate_counters_count_check" CHECK("customer_otp_rate_counters"."count" > 0)
);
--> statement-breakpoint
CREATE INDEX `customer_otp_rate_counters_expiry_idx` ON `customer_otp_rate_counters` (`expires_at`);