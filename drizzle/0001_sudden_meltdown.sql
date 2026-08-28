CREATE TABLE `access_allowed_domains` (
	`id` int AUTO_INCREMENT NOT NULL,
	`domain` varchar(255) NOT NULL,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `access_allowed_domains_id` PRIMARY KEY(`id`),
	CONSTRAINT `access_allowed_domain_unique` UNIQUE(`domain`)
);
--> statement-breakpoint
INSERT INTO `access_allowed_domains` (`domain`) VALUES ('foundationu.com');
--> statement-breakpoint
CREATE TABLE `allowed_external_emails` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`note` varchar(240),
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `allowed_external_emails_id` PRIMARY KEY(`id`),
	CONSTRAINT `allowed_external_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `denied_sign_in_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attemptedEmail` varchar(320),
	`emailDomain` varchar(255),
	`loginMethod` varchar(64),
	`reason` enum('missing_email','email_not_approved') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `denied_sign_in_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `access_allowed_domains` ADD CONSTRAINT `access_allowed_domains_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `allowed_external_emails` ADD CONSTRAINT `allowed_external_emails_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `denied_sign_in_created_idx` ON `denied_sign_in_events` (`createdAt`);
