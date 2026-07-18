CREATE TABLE `cms_cache_purge_debt` (
	`key` text PRIMARY KEY NOT NULL,
	`revision` text NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`request_id` text,
	`command_committed_at` integer NOT NULL,
	`last_attempted_at` integer,
	CONSTRAINT "cms_cache_purge_debt_key_check" CHECK("cms_cache_purge_debt"."key" = 'storefront'),
	CONSTRAINT "cms_cache_purge_debt_revision_check" CHECK(length("cms_cache_purge_debt"."revision") = 36),
	CONSTRAINT "cms_cache_purge_debt_attempt_check" CHECK("cms_cache_purge_debt"."attempt_count" BETWEEN 0 AND 1000000)
);
--> statement-breakpoint
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
	CONSTRAINT "cms_documents_lifecycle_check" CHECK(("cms_documents"."status" = 'draft' AND "cms_documents"."published_at" IS NULL) OR ("cms_documents"."status" = 'published' AND "cms_documents"."published_at" IS NOT NULL))
);
--> statement-breakpoint
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
	CONSTRAINT "commerce_settings_delivery_fee_check" CHECK("commerce_settings"."delivery_fee_mnt" BETWEEN 0 AND 10000000),
	CONSTRAINT "commerce_settings_free_threshold_check" CHECK("commerce_settings"."free_delivery_threshold_mnt" IS NULL OR "commerce_settings"."free_delivery_threshold_mnt" BETWEEN 0 AND 1000000000)
);
