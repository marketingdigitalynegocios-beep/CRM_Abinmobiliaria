CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`link` text,
	`read` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "notifications_type_check" CHECK("notifications"."type" IN ('new_lead', 'visit_scheduled', 'task_due'))
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_tenant_user` ON `notifications` (`tenant_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_notifications_user_read` ON `notifications` (`user_id`,`read`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`lead_id` text,
	`deal_id` text,
	`title` text NOT NULL,
	`due_at` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`assignee_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assignee_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "tasks_status_check" CHECK("tasks"."status" IN ('pending', 'done'))
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_tenant` ON `tasks` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_due` ON `tasks` (`due_at`);--> statement-breakpoint
CREATE INDEX `idx_tasks_status` ON `tasks` (`status`);