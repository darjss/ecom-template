DROP INDEX `option_groups_product_key_idx`;--> statement-breakpoint
DROP INDEX `option_groups_product_position_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `option_groups_product_key_idx` ON `option_groups` (`product_id`,`key`) WHERE "option_groups"."state" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX `option_groups_product_position_idx` ON `option_groups` (`product_id`,`position`) WHERE "option_groups"."state" = 'active';--> statement-breakpoint
DROP INDEX `option_values_group_key_idx`;--> statement-breakpoint
DROP INDEX `option_values_group_position_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `option_values_group_key_idx` ON `option_values` (`option_group_id`,`key`) WHERE "option_values"."state" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX `option_values_group_position_idx` ON `option_values` (`option_group_id`,`position`) WHERE "option_values"."state" = 'active';