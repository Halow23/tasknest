CREATE TABLE `project_fields` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(60) NOT NULL,
	`type` enum('text','select','date') NOT NULL DEFAULT 'text',
	`options` json,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_fields_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_field_name_unique` UNIQUE(`projectId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `task_field_values` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`fieldId` int NOT NULL,
	`value` varchar(2000),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `task_field_values_id` PRIMARY KEY(`id`),
	CONSTRAINT `task_field_value_unique` UNIQUE(`taskId`,`fieldId`)
);
--> statement-breakpoint
ALTER TABLE `project_fields` ADD CONSTRAINT `project_fields_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_fields` ADD CONSTRAINT `project_fields_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_field_values` ADD CONSTRAINT `task_field_values_taskId_tasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_field_values` ADD CONSTRAINT `task_field_values_fieldId_project_fields_id_fk` FOREIGN KEY (`fieldId`) REFERENCES `project_fields`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `project_field_order_idx` ON `project_fields` (`projectId`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `task_field_value_field_idx` ON `task_field_values` (`fieldId`);