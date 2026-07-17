CREATE TABLE `catalog_listing_cache_purge_debt` (
	`key` text PRIMARY KEY NOT NULL,
	`revision` text NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`request_id` text,
	`command_committed_at` integer NOT NULL,
	`last_attempted_at` integer,
	CONSTRAINT "catalog_listing_cache_purge_debt_key_check" CHECK("catalog_listing_cache_purge_debt"."key" = 'catalog'),
	CONSTRAINT "catalog_listing_cache_purge_debt_revision_check" CHECK(length("catalog_listing_cache_purge_debt"."revision") = 36),
	CONSTRAINT "catalog_listing_cache_purge_debt_attempt_check" CHECK("catalog_listing_cache_purge_debt"."attempt_count" BETWEEN 0 AND 1000000),
	CONSTRAINT "catalog_listing_cache_purge_debt_request_check" CHECK("catalog_listing_cache_purge_debt"."request_id" IS NULL OR length("catalog_listing_cache_purge_debt"."request_id") BETWEEN 1 AND 128)
);
