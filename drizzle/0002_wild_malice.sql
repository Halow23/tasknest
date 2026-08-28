CREATE TABLE `denied_sign_in_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`emailDomain` varchar(255) NOT NULL,
	`recentAttemptCount` int NOT NULL DEFAULT 0,
	`windowStartedAt` timestamp NOT NULL,
	`lastDeniedAt` timestamp NOT NULL,
	`lastNotifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `denied_sign_in_alerts_id` PRIMARY KEY(`id`),
	CONSTRAINT `denied_sign_in_alert_domain_unique` UNIQUE(`emailDomain`)
);
--> statement-breakpoint
ALTER TABLE `allowed_external_emails` ADD `expiresAt` timestamp;--> statement-breakpoint
CREATE INDEX `denied_sign_in_alert_recent_idx` ON `denied_sign_in_alerts` (`lastDeniedAt`);--> statement-breakpoint
CREATE INDEX `allowed_external_email_expiry_idx` ON `allowed_external_emails` (`expiresAt`);