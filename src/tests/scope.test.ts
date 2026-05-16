import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findProjectRoot } from "../lib/scope";

describe("project root detection", () => {
  test("does not treat the global home .codetrap directory as a project root", () => {
    const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));
    mkdirSync(join(home, ".codetrap"));

    const cwd = join(home, "Documents", "Code", "esp32");
    mkdirSync(cwd, { recursive: true });

    expect(findProjectRoot(cwd, home)).toBeNull();
  });

  test("finds the nearest project .codetrap directory below the home directory", () => {
    const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));
    mkdirSync(join(home, ".codetrap"));

    const project = join(home, "Documents", "Code", "project");
    const cwd = join(project, "src", "nested");
    mkdirSync(join(project, ".codetrap"), { recursive: true });
    mkdirSync(cwd, { recursive: true });

    expect(findProjectRoot(cwd, home)).toBe(project);
  });
});
