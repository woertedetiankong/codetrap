import { describe, expect, test } from "bun:test";
import { mkdirSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { isWithinFilesystem, tempDir } from "./helpers";

describe("test fixture isolation", () => {
  test("the default temp root is outside the real home", () => {
    if (process.env.CODETRAP_TEST_TMP) return;
    const dir = tempDir("codetrap-helper-isolation-", { realpath: true });
    expect(isWithinFilesystem(dir, homedir())).toBe(false);
  });

  test("filesystem identity recognizes a directory reached through a path alias", () => {
    const root = tempDir("codetrap-helper-alias-", { realpath: true });
    const target = join(root, "target");
    const nested = join(target, "nested");
    const alias = join(root, "alias");
    mkdirSync(nested, { recursive: true });
    symlinkSync(target, alias, process.platform === "win32" ? "junction" : "dir");

    expect(isWithinFilesystem(join(alias, "nested"), target)).toBe(true);
  });
});
