PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_staff_members` (
	`id` text PRIMARY KEY NOT NULL,
	`normalized_email` text NOT NULL,
	`auth_user_id` text,
	`status` text NOT NULL,
	`role` text,
	`session_generation` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`approved_at` integer,
	`revoked_at` integer,
	CONSTRAINT "staff_members_status_check" CHECK("__new_staff_members"."status" IN ('pending', 'active', 'revoked')),
	CONSTRAINT "staff_members_role_check" CHECK("__new_staff_members"."role" IS NULL OR "__new_staff_members"."role" IN ('owner', 'manager', 'staff')),
	CONSTRAINT "staff_members_id_check" CHECK(length("__new_staff_members"."id") = 32 AND substr("__new_staff_members"."id", 1, 6) = 'staff_' AND substr("__new_staff_members"."id", 7, 1) GLOB '[0-7]' AND substr("__new_staff_members"."id", 7) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'),
	CONSTRAINT "staff_members_lifecycle_check" CHECK(("__new_staff_members"."status" = 'pending' AND "__new_staff_members"."approved_at" IS NULL AND "__new_staff_members"."revoked_at" IS NULL) OR ("__new_staff_members"."status" = 'active' AND "__new_staff_members"."role" IS NOT NULL AND "__new_staff_members"."approved_at" IS NOT NULL AND "__new_staff_members"."revoked_at" IS NULL) OR ("__new_staff_members"."status" = 'revoked' AND "__new_staff_members"."approved_at" IS NOT NULL AND "__new_staff_members"."revoked_at" IS NOT NULL)),
	CONSTRAINT "staff_members_lifecycle_order_check" CHECK("__new_staff_members"."created_at" <= "__new_staff_members"."updated_at" AND ("__new_staff_members"."approved_at" IS NULL OR ("__new_staff_members"."created_at" <= "__new_staff_members"."approved_at" AND "__new_staff_members"."approved_at" <= "__new_staff_members"."updated_at")) AND ("__new_staff_members"."revoked_at" IS NULL OR ("__new_staff_members"."approved_at" <= "__new_staff_members"."revoked_at" AND "__new_staff_members"."revoked_at" <= "__new_staff_members"."updated_at")))
);
--> statement-breakpoint
INSERT INTO `__new_staff_members`("id", "normalized_email", "auth_user_id", "status", "role", "session_generation", "created_at", "updated_at", "approved_at", "revoked_at")
SELECT
	CASE
		WHEN length("id") = 32 AND substr("id", 1, 6) = 'staff_' AND substr("id", 7, 1) GLOB '[0-7]' AND substr("id", 7) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*' THEN "id"
		ELSE 'staff_0' || substr(lower(hex(randomblob(13))), 1, 25)
	END,
	"normalized_email",
	"auth_user_id",
	"status",
	"role",
	"session_generation",
	"created_at",
	CASE "status"
		WHEN 'pending' THEN max("created_at", "updated_at")
		WHEN 'active' THEN max("created_at", "updated_at", coalesce("approved_at", "updated_at", "created_at"))
		ELSE max("created_at", "updated_at", coalesce("approved_at", "created_at"), coalesce("revoked_at", "updated_at", "created_at"))
	END,
	CASE "status"
		WHEN 'pending' THEN NULL
		WHEN 'active' THEN max("created_at", coalesce("approved_at", "updated_at", "created_at"))
		ELSE max("created_at", coalesce("approved_at", "created_at"))
	END,
	CASE "status"
		WHEN 'revoked' THEN max("created_at", coalesce("approved_at", "created_at"), coalesce("revoked_at", "updated_at", "created_at"))
		ELSE NULL
	END
FROM `staff_members`;--> statement-breakpoint
DROP TABLE `staff_members`;--> statement-breakpoint
ALTER TABLE `__new_staff_members` RENAME TO `staff_members`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `staff_members_normalized_email_unique` ON `staff_members` (`normalized_email`);--> statement-breakpoint
CREATE UNIQUE INDEX `staff_members_auth_user_id_unique` ON `staff_members` (`auth_user_id`);