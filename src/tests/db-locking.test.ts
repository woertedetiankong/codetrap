import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../db/connection";

describe("SQLite locking behavior", () => {
  test("openDatabase waits for startup locks before applying pragmas", async () => {
    const dir = mkdtempSync(join(tmpdir(), "codetrap-db-lock-"));
    const dbPath = join(dir, "traps.db");
    const sentinel = join(dir, "locked");
    const holder = Bun.spawn({
      cmd: [
        "bun",
        "-e",
        `
          import { writeFileSync } from "node:fs";
          import { Database } from "bun:sqlite";
          const db = new Database(${JSON.stringify(dbPath)});
          db.exec("CREATE TABLE t (id INTEGER)");
          db.exec("BEGIN EXCLUSIVE");
          writeFileSync(${JSON.stringify(sentinel)}, "locked");
          await Bun.sleep(250);
          db.exec("COMMIT");
          db.close();
        `,
      ],
      stdout: "pipe",
      stderr: "pipe",
    });

    await waitForFile(sentinel);
    expect(() => openDatabase(dbPath)).not.toThrow();
    expect(await holder.exited).toBe(0);
  });
});

async function waitForFile(path: string): Promise<void> {
  const started = Date.now();
  while (!existsSync(path)) {
    if (Date.now() - started > 1000) {
      throw new Error(`Timed out waiting for ${path}`);
    }
    await Bun.sleep(10);
  }
}
