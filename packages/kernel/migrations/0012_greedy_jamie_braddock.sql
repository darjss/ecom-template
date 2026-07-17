DROP TABLE `customer_otp_rate_admissions`;--> statement-breakpoint
DROP TABLE `customer_otp_rate_counters`;--> statement-breakpoint
DROP TABLE `idempotency_records`;--> statement-breakpoint
DROP TABLE `staff_session_cleanup_debts`;--> statement-breakpoint
ALTER TABLE `staff_auth_sessions` ADD `staff_id` text;--> statement-breakpoint
ALTER TABLE `staff_auth_sessions` DROP COLUMN `generation`;--> statement-breakpoint
ALTER TABLE `staff_members` DROP COLUMN `session_generation`;