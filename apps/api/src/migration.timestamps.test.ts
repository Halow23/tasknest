import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * MariaDB with explicit_defaults_for_timestamp=0 turns a plain
 * `ADD COLUMN x timestamp` into NOT NULL DEFAULT '0000-00-00 00:00:00' (or
 * DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP for a table's first
 * timestamp column). Rows then hold a zero-date instead of NULL, so every
 * `IS NULL` filter — soft deletes, unread notifications, unset due dates —
 * silently matches nothing, and dueAt/readAt/expiresAt get bumped on every
 * unrelated UPDATE. Migration 0009 restores the intended nullable semantics.
 */
describe("legacy timestamp defaults migration", () => {
  it("makes every nullable-intent timestamp column NULLable with a NULL default", async () => {
    const migration = await readFile(
      new URL("../drizzle/0009_fix_legacy_timestamp_defaults.sql", import.meta.url),
      "utf8",
    );

    const columns = [
      ["projects", "deletedAt"],
      ["tasks", "dueAt"],
      ["tasks", "completedAt"],
      ["tasks", "deletedAt"],
      ["notifications", "readAt"],
      ["workspace_invites", "acceptedAt"],
      ["workspace_invites", "revokedAt"],
      ["allowed_external_emails", "expiresAt"],
      ["denied_sign_in_alerts", "lastDeniedAt"],
      ["denied_sign_in_alerts", "lastNotifiedAt"],
    ] as const;

    for (const [table, column] of columns) {
      expect(migration).toContain(
        `ALTER TABLE \`${table}\` MODIFY \`${column}\` timestamp NULL DEFAULT NULL;`,
      );
    }

    // expiresAt on invites stays NOT NULL in the schema but must lose its
    // accidental ON UPDATE CURRENT_TIMESTAMP, which refreshed invite expiry.
    expect(migration).toContain("ALTER TABLE `workspace_invites` MODIFY `expiresAt` timestamp NULL;");
  });

  it("converts existing zero-dates to NULL so IS NULL filters match again", async () => {
    const migration = await readFile(
      new URL("../drizzle/0009_fix_legacy_timestamp_defaults.sql", import.meta.url),
      "utf8",
    );

    expect(migration).toContain(
      "UPDATE `projects` SET `deletedAt` = NULL WHERE `deletedAt` = '0000-00-00 00:00:00';",
    );
    expect(migration).toContain(
      "UPDATE `tasks` SET `deletedAt` = NULL WHERE `deletedAt` = '0000-00-00 00:00:00';",
    );
    expect(migration).toContain(
      "UPDATE `notifications` SET `readAt` = NULL WHERE `readAt` = '0000-00-00 00:00:00';",
    );
  });

  it("relaxes sql_mode for the ALTERs and restores it afterwards", async () => {
    const migration = await readFile(
      new URL("../drizzle/0009_fix_legacy_timestamp_defaults.sql", import.meta.url),
      "utf8",
    );

    // Strict mode rejects an ALTER while sibling columns still hold zero-date
    // defaults, so the migration relaxes the mode and puts it back at the end.
    expect(migration).toContain("SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION';");
    expect(migration.trimEnd()).toMatch(
      /SET SESSION sql_mode = 'NO_ZERO_IN_DATE,NO_ZERO_DATE,NO_ENGINE_SUBSTITUTION';$/,
    );
  });

  it("is registered in the drizzle journal", async () => {
    const journal = JSON.parse(
      await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"),
    ) as { entries: { idx: number; tag: string }[] };

    const entry = journal.entries.find((item) => item.tag === "0009_fix_legacy_timestamp_defaults");
    expect(entry).toBeDefined();
    expect(entry?.idx).toBe(9);
  });
});
