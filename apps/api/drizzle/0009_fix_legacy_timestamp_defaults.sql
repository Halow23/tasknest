-- MariaDB 10.4 runs with explicit_defaults_for_timestamp=0 (legacy timestamp
-- mode): drizzle's plain `ADD COLUMN x timestamp` produced NOT NULL DEFAULT
-- '0000-00-00 00:00:00' (or DEFAULT CURRENT_TIMESTAMP ON UPDATE
-- CURRENT_TIMESTAMP for a table's first timestamp column). That breaks every
-- IS NULL soft-delete/unread/unset filter and silently bumps dueAt/readAt/
-- expiresAt on unrelated updates. Restore the intended NULL-able semantics
-- and convert existing zero-dates to NULL.
--
-- The ALTERs must run with a relaxed sql_mode: strict mode rejects the
-- table's *other* still-zero-dated columns during ALTER evaluation, so the
-- mode is relaxed first and restored at the end.

SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION';--> statement-breakpoint
ALTER TABLE `projects` MODIFY `deletedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `tasks` MODIFY `dueAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `tasks` MODIFY `completedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `tasks` MODIFY `deletedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `notifications` MODIFY `readAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `workspace_invites` MODIFY `expiresAt` timestamp NULL;--> statement-breakpoint
ALTER TABLE `workspace_invites` MODIFY `acceptedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `workspace_invites` MODIFY `revokedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `allowed_external_emails` MODIFY `expiresAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `denied_sign_in_alerts` MODIFY `lastDeniedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `denied_sign_in_alerts` MODIFY `lastNotifiedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
UPDATE `projects` SET `deletedAt` = NULL WHERE `deletedAt` = '0000-00-00 00:00:00';--> statement-breakpoint
UPDATE `tasks` SET `completedAt` = NULL WHERE `completedAt` = '0000-00-00 00:00:00';--> statement-breakpoint
UPDATE `tasks` SET `deletedAt` = NULL WHERE `deletedAt` = '0000-00-00 00:00:00';--> statement-breakpoint
UPDATE `notifications` SET `readAt` = NULL WHERE `readAt` = '0000-00-00 00:00:00';--> statement-breakpoint
UPDATE `workspace_invites` SET `acceptedAt` = NULL WHERE `acceptedAt` = '0000-00-00 00:00:00';--> statement-breakpoint
UPDATE `workspace_invites` SET `revokedAt` = NULL WHERE `revokedAt` = '0000-00-00 00:00:00';--> statement-breakpoint
UPDATE `allowed_external_emails` SET `expiresAt` = NULL WHERE `expiresAt` = '0000-00-00 00:00:00';--> statement-breakpoint
UPDATE `denied_sign_in_alerts` SET `lastDeniedAt` = NULL WHERE `lastDeniedAt` = '0000-00-00 00:00:00';--> statement-breakpoint
UPDATE `denied_sign_in_alerts` SET `lastNotifiedAt` = NULL WHERE `lastNotifiedAt` = '0000-00-00 00:00:00';--> statement-breakpoint
SET SESSION sql_mode = 'NO_ZERO_IN_DATE,NO_ZERO_DATE,NO_ENGINE_SUBSTITUTION';
