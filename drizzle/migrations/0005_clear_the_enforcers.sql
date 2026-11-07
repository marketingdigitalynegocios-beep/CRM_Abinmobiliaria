PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_leads` (
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
	`preferred_city` text,
	`preferred_type` text,
	`preferred_operation` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`advisor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "leads_source_check" CHECK("__new_leads"."source" IN ('website', 'whatsapp', 'referral', 'manual')),
	CONSTRAINT "leads_stage_check" CHECK("__new_leads"."stage" IN ('new', 'contacted', 'disqualified')),
	CONSTRAINT "leads_preferred_type_check" CHECK("__new_leads"."preferred_type" IS NULL OR "__new_leads"."preferred_type" IN ('apartment', 'house', 'commercial', 'land')),
	CONSTRAINT "leads_preferred_operation_check" CHECK("__new_leads"."preferred_operation" IS NULL OR "__new_leads"."preferred_operation" IN ('sale', 'rent', 'sale_rent'))
);
--> statement-breakpoint
INSERT INTO `__new_leads`("id", "tenant_id", "advisor_id", "full_name", "email", "phone", "whatsapp", "source", "stage", "notes", "budget_min_cents", "budget_max_cents", "created_at", "updated_at") SELECT "id", "tenant_id", "advisor_id", "full_name", "email", "phone", "whatsapp", "source", "stage", "notes", "budget_min_cents", "budget_max_cents", "created_at", "updated_at" FROM `leads`;--> statement-breakpoint
DROP TABLE `leads`;--> statement-breakpoint
ALTER TABLE `__new_leads` RENAME TO `leads`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_leads_tenant` ON `leads` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_leads_stage` ON `leads` (`stage`);