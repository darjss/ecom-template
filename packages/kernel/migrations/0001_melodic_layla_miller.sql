CREATE TABLE `staff_members` (
	`id` text PRIMARY KEY NOT NULL,
	`normalized_email` text NOT NULL,
	`auth_user_id` text,
	`status` text NOT NULL,
	`role` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "staff_members_status_check" CHECK("staff_members"."status" IN ('pending', 'active', 'revoked')),
	CONSTRAINT "staff_members_role_check" CHECK("staff_members"."role" IS NULL OR "staff_members"."role" IN ('owner', 'manager', 'staff')),
	CONSTRAINT "staff_members_active_role_check" CHECK("staff_members"."status" <> 'active' OR "staff_members"."role" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_members_normalized_email_unique` ON `staff_members` (`normalized_email`);--> statement-breakpoint
CREATE UNIQUE INDEX `staff_members_auth_user_id_unique` ON `staff_members` (`auth_user_id`);