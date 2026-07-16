ALTER TABLE `staff_members` ADD `session_generation` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `staff_members` ADD `approved_at` integer;--> statement-breakpoint
ALTER TABLE `staff_members` ADD `revoked_at` integer;--> statement-breakpoint
ALTER TABLE `staff_auth_sessions` ADD `generation` integer;