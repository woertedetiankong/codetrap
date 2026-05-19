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

  test("normalizes MSYS-style Windows home paths before stopping at the global store", () => {
    const home = "C:\\Users\\EDY";
    const cwd = "C:\\Users\\EDY\\Documents\\Code\\esp32";

    expect(findProjectRoot(cwd, "/c/Users/EDY")).toBeNull();
    expect(findProjectRoot(cwd, "c:/users/edy")).toBeNull();
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

  test("finds a project root outside the home directory", () => {
    const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));
    mkdirSync(join(home, ".codetrap"));

    const project = mkdtempSync(join(tmpdir(), "codetrap-external-project-"));
    const cwd = join(project, "packages", "app");
    mkdirSync(join(project, ".codetrap"), { recursive: true });
    mkdirSync(cwd, { recursive: true });

    expect(findProjectRoot(cwd, home)).toBe(project);
  });

  test("uses the nearest nested project root", () => {
    const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));
    const outer = join(home, "work", "outer");
    const inner = join(outer, "packages", "inner");
    const cwd = join(inner, "src");
    mkdirSync(join(outer, ".codetrap"), { recursive: true });
    mkdirSync(join(inner, ".codetrap"), { recursive: true });
    mkdirSync(cwd, { recursive: true });

    expect(findProjectRoot(cwd, home)).toBe(inner);
  });
});
