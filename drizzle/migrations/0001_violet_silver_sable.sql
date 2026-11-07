CREATE TABLE `lead_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`type` text NOT NULL,
	`body` text NOT NULL,
	`actor_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "lead_activities_type_check" CHECK("lead_activities"."type" IN ('stage_change', 'note', 'call', 'deal_created', 'visit_scheduled', 'whatsapp_message'))
);
--> statement-breakpoint
CREATE INDEX `idx_lead_activities_tenant` ON `lead_activities` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_lead_activities_lead` ON `lead_activities` (`lead_id`);--> statement-breakpoint
CREATE TABLE `whatsapp_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`lead_id` text,
	`phone_number_id` text NOT NULL,
	`direction` text NOT NULL,
	`body` text NOT NULL,
	`wa_message_id` text,
	`status` text DEFAULT 'received' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "whatsapp_messages_direction_check" CHECK("whatsapp_messages"."direction" IN ('inbound', 'outbound')),
	CONSTRAINT "whatsapp_messages_status_check" CHECK("whatsapp_messages"."status" IN ('received', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `idx_whatsapp_messages_tenant` ON `whatsapp_messages` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_whatsapp_messages_lead` ON `whatsapp_messages` (`lead_id`);