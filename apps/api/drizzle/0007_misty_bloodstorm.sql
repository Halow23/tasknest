CREATE TABLE `automation_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`trigger` enum('task_created','task_completed','comment_added') NOT NULL,
	`action` enum('assign_user','set_priority','move_status','notify_user') NOT NULL,
	`actionValue` varchar(240) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `automation_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`title` varchar(240) NOT NULL,
	`description` text,
	`priority` enum('high','medium','low') NOT NULL DEFAULT 'medium',
	`recurrenceRule` enum('none','daily','weekly','monthly') NOT NULL DEFAULT 'none',
	`subtaskTitles` json,
	`labelIds` json,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `task_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `time_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`userId` int NOT NULL,
	`minutes` int NOT NULL,
	`note` varchar(240),
	`loggedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `time_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `type` enum('assigned','commented','mentioned','due_today','overdue','automation') NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `automation_rules` ADD CONSTRAINT `automation_rules_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `automation_rules` ADD CONSTRAINT `automation_rules_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_templates` ADD CONSTRAINT `task_templates_workspaceId_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_templates` ADD CONSTRAINT `task_templates_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `time_entries` ADD CONSTRAINT `time_entries_taskId_tasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `time_entries` ADD CONSTRAINT `time_entries_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `automation_rule_workspace_idx` ON `automation_rules` (`workspaceId`,`trigger`);--> statement-breakpoint
CREATE INDEX `task_template_workspace_idx` ON `task_templates` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `time_entry_task_idx` ON `time_entries` (`taskId`);--> statement-breakpoint
CREATE INDEX `time_entry_user_idx` ON `time_entries` (`userId`);