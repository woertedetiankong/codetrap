import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { openDatabase } from "../db/connection";
import { backupScopeDatabase, openReadOnlyDatabase } from "../lib/scope-maintenance";
import { tempDir } from "./helpers";

describe("scope maintenance read-only connections (M4)", () => {
  test("read-only maintenance connections set busy_timeout so they don't fail instantly under a concurrent writer", () => {
    const dir = tempDir("codetrap-ro-");
    const dbPath = join(dir, "traps.db");
    // Create + init a file-backed DB on disk, then reopen it read-only.
    openDatabase(dbPath).close();

    const ro = openReadOnlyDatabase(dbPath);
    try {
      const row = ro.query("PRAGMA busy_timeout").get() as { timeout: number };
      expect(row.timeout).toBe(5000);
    } finally {
      ro.close();
    }
  });

  test("backupScopeDatabase (also a read-only connection) still produces a backup", () => {
    const dir = tempDir("codetrap-ro-backup-");
    const dbPath = join(dir, "traps.db");
    openDatabase(dbPath).close();

    const backupPath = backupScopeDatabase(dbPath, "test");
    expect(existsSync(backupPath)).toBe(true);
  });
});
