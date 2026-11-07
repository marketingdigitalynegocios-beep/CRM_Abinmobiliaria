ALTER TABLE `tenants` ADD `portal_feed_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_portal_feed_token_unique` ON `tenants` (`portal_feed_token`);