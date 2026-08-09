import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renameFileWithRetry, writeFileAtomic } from "../lib/fs-json";

describe("atomic JSON file replacement", () => {
  test("flushes and replaces an existing file without leaving temp siblings", () => {
    const dir = mkdtempSync(join(tmpdir(), "codetrap-fs-json-"));
    const path = join(dir, "state.json");

    writeFileAtomic(path, '{"version":1}\n');
    writeFileAtomic(path, '{"version":2}\n');

    expect(readFileSync(path, "utf8")).toBe('{"version":2}\n');
    expect(readdirSync(dir)).toEqual(["state.json"]);
  });

  test("retries bounded Windows-style sharing errors with backoff", () => {
    let calls = 0;
    const delays: number[] = [];

    renameFileWithRetry("source.tmp", "destination.json", {
      maxRetries: 3,
      baseDelayMs: 5,
      rename: () => {
        calls++;
        if (calls < 3) throw Object.assign(new Error("temporarily locked"), { code: "EPERM" });
      },
      sleep: (milliseconds) => delays.push(milliseconds),
    });

    expect(calls).toBe(3);
    expect(delays).toEqual([5, 10]);
  });

  test("does not retry unrelated filesystem failures", () => {
    let calls = 0;
    expect(() => renameFileWithRetry("source.tmp", "destination.json", {
      rename: () => {
        calls++;
        throw Object.assign(new Error("missing parent"), { code: "ENOENT" });
      },
      sleep: () => {
        throw new Error("sleep should not run");
      },
    })).toThrow("missing parent");
    expect(calls).toBe(1);
  });

  test("stops retrying after the configured limit", () => {
    let calls = 0;
    expect(() => renameFileWithRetry("source.tmp", "destination.json", {
      maxRetries: 2,
      rename: () => {
        calls++;
        throw Object.assign(new Error("still locked"), { code: "EBUSY" });
      },
      sleep: () => undefined,
    })).toThrow("still locked");
    expect(calls).toBe(3);
  });
});
