CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`lead_id` text,
	`deal_id` text,
	`property_id` text,
	`type` text DEFAULT 'other' NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`storage_key` text NOT NULL,
	`uploaded_by` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "documents_type_check" CHECK("documents"."type" IN ('contract', 'mandate', 'id_copy', 'other'))
);
--> statement-breakpoint
CREATE INDEX `idx_documents_tenant` ON `documents` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_documents_lead` ON `documents` (`lead_id`);--> statement-breakpoint
CREATE INDEX `idx_documents_deal` ON `documents` (`deal_id`);--> statement-breakpoint
CREATE INDEX `idx_documents_property` ON `documents` (`property_id`);