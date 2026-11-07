CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` text,
	`refresh_token_expires_at` text,
	`scope` text,
	`password` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`tenant_id` text,
	`role` text DEFAULT 'advisor' NOT NULL,
	`phone` text,
	`is_active` integer DEFAULT true NOT NULL,
	CONSTRAINT "user_role_check" CHECK("user"."role" IN ('admin', 'advisor'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_agent_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`whatsapp_waba_id` text,
	`whatsapp_phone_number_id` text,
	`whatsapp_display_number` text,
	`gemini_key_enc` text,
	`system_prompt` text,
	`welcome_message` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_agent_configs_tenant_id_unique` ON `ai_agent_configs` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_agent_phone_number` ON `ai_agent_configs` (`whatsapp_phone_number_id`);--> statement-breakpoint
CREATE TABLE `deals` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`property_id` text NOT NULL,
	`advisor_id` text,
	`title` text,
	`deal_value_cents` integer,
	`stage` text DEFAULT 'new' NOT NULL,
	`next_action` text,
	`expected_close_date` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`advisor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "deals_stage_check" CHECK("deals"."stage" IN ('new', 'meeting_scheduled', 'qualified', 'proposal_sent', 'negotiation', 'closed_won', 'closed_lost'))
);
--> statement-breakpoint
CREATE INDEX `idx_deals_tenant` ON `deals` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_deals_stage` ON `deals` (`stage`);--> statement-breakpoint
CREATE INDEX `idx_deals_lead` ON `deals` (`lead_id`);--> statement-breakpoint
CREATE INDEX `idx_deals_property` ON `deals` (`property_id`);--> statement-breakpoint
CREATE TABLE `lead_property_interests` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`property_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lead_property_interests_unique` ON `lead_property_interests` (`lead_id`,`property_id`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`advisor_id` text,
	`full_name` text NOT NULL,
	`email` text,
	`phone` text,
	`whatsapp` text,
	`source` text DEFAULT 'website' NOT NULL,
	`stage` text DEFAULT 'new' NOT NULL,
	`notes` text,
	`budget_min_cents` integer,
	`budget_max_cents` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`advisor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "leads_source_check" CHECK("leads"."source" IN ('website', 'whatsapp', 'referral', 'manual')),
	CONSTRAINT "leads_stage_check" CHECK("leads"."stage" IN ('new', 'contacted', 'disqualified'))
);
--> statement-breakpoint
CREATE INDEX `idx_leads_tenant` ON `leads` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_leads_stage` ON `leads` (`stage`);--> statement-breakpoint
CREATE TABLE `properties` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`advisor_id` text,
	`owner_id` text,
	`internal_code` text,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`operation` text NOT NULL,
	`price_cents` integer NOT NULL,
	`currency` text DEFAULT 'COP' NOT NULL,
	`area_m2` real,
	`bedrooms` integer,
	`bathrooms` integer,
	`parking_spots` integer DEFAULT 0 NOT NULL,
	`stratum` integer,
	`city` text,
	`neighborhood` text,
	`address` text,
	`latitude` real,
	`longitude` real,
	`cover_image_id` text,
	`is_featured` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`visibility` text DEFAULT 'published' NOT NULL,
	`listing_type` text DEFAULT 'exclusive' NOT NULL,
	`mandate_start_date` text,
	`mandate_end_date` text,
	`commission_percentage` real,
	`amenities_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`advisor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `property_owners`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "properties_type_check" CHECK("properties"."type" IN ('apartment', 'house', 'commercial', 'land')),
	CONSTRAINT "properties_operation_check" CHECK("properties"."operation" IN ('sale', 'rent', 'sale_rent')),
	CONSTRAINT "properties_status_check" CHECK("properties"."status" IN ('active', 'inactive', 'sold', 'rented')),
	CONSTRAINT "properties_visibility_check" CHECK("properties"."visibility" IN ('draft', 'published', 'archived')),
	CONSTRAINT "properties_listing_type_check" CHECK("properties"."listing_type" IN ('exclusive', 'shared', 'open'))
);
--> statement-breakpoint
CREATE INDEX `idx_properties_tenant` ON `properties` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_properties_status` ON `properties` (`status`);--> statement-breakpoint
CREATE INDEX `idx_properties_type` ON `properties` (`type`);--> statement-breakpoint
CREATE INDEX `idx_properties_owner` ON `properties` (`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `properties_tenant_slug_unique` ON `properties` (`tenant_id`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `properties_tenant_internal_code_unique` ON `properties` (`tenant_id`,`internal_code`);--> statement-breakpoint
CREATE TABLE `property_images` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`image_id` text NOT NULL,
	`alt_text` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `property_owners` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`full_name` text NOT NULL,
	`document_id` text,
	`phone` text,
	`email` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_property_owners_tenant` ON `property_owners` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`wompi_reference` text,
	`current_period_start` text,
	`current_period_end` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "subscriptions_plan_check" CHECK("subscriptions"."plan" IN ('free', 'starter', 'pro', 'enterprise')),
	CONSTRAINT "subscriptions_status_check" CHECK("subscriptions"."status" IN ('active', 'past_due', 'cancelled', 'trialing'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_tenant_id_unique` ON `subscriptions` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`logo_image_id` text,
	`phone` text,
	`email` text,
	`city` text,
	`address` text,
	`website` text,
	`primary_color` text DEFAULT '#1B4FBF' NOT NULL,
	`template` text DEFAULT 'modern' NOT NULL,
	`whatsapp_number` text,
	`description` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "tenants_template_check" CHECK("tenants"."template" IN ('modern', 'classic', 'minimal'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);--> statement-breakpoint
CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`property_id` text NOT NULL,
	`deal_id` text,
	`advisor_id` text,
	`scheduled_at` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`advisor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "visits_status_check" CHECK("visits"."status" IN ('scheduled', 'completed', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX `idx_visits_tenant` ON `visits` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_visits_scheduled` ON `visits` (`scheduled_at`);