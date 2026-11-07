CREATE TABLE `property_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`property_id` text,
	`author_name` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text NOT NULL,
	`is_published` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "property_reviews_rating_check" CHECK("property_reviews"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE INDEX `idx_property_reviews_tenant` ON `property_reviews` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_property_reviews_property` ON `property_reviews` (`property_id`);