import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findProjectRoot } from "../lib/scope";
import { resolveScopePath, ScopePathResolver } from "../lib/scope-path";

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
    expect(findProjectRoot("/c/Users/EDY/Documents/Code/esp32", home)).toBeNull();
    expect(resolveScopePath("/c/Users/EDY/Documents/Code/esp32", home)).toBe("C:\\Users\\EDY\\Documents\\Code\\esp32");
  });

  test("can test Windows project root detection through a filesystem adapter", () => {
    const resolver = new ScopePathResolver({
      platform: "linux",
      fs: {
        exists: (path) => path.toLowerCase() === "c:\\users\\edy\\documents\\code\\project\\.codetrap",
        realpath: (path) => path,
      },
    });

    expect(findProjectRoot(
      "/c/Users/EDY/Documents/Code/project/src",
      "/c/Users/EDY",
      resolver
    )).toBe("C:\\Users\\EDY\\Documents\\Code\\project");
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
