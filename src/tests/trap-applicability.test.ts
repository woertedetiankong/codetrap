import { describe, expect, test } from "bun:test";
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../db/connection";
import { TrapRepository } from "../db/repository";
import { globMatchesPath } from "../lib/trap-scope-match";
import { trap } from "./helpers";

describe("trap applicability filters", () => {
  test("**/ globs match zero directories, so top-level files are not excluded", () => {
    expect(globMatchesPath("**/*.ts", "index.ts")).toBe(true);
    expect(globMatchesPath("**/*.ts", "src/db/schema.ts")).toBe(true);
    expect(globMatchesPath("**/*.ts", "README.md")).toBe(false);
    expect(globMatchesPath("src/**/test/*.ts", "src/test/a.test.ts")).toBe(true);
    expect(globMatchesPath("src/**/test/*.ts", "src/x/y/test/a.test.ts")).toBe(true);
    expect(globMatchesPath("src/**", "src/api.ts")).toBe(true);
    expect(globMatchesPath("src/*", "src/db/queries.ts")).toBe(false);
  });

  test("relative globs match suffixes of absolute paths for global traps", () => {
    expect(globMatchesPath("src/db/**", "/home/user/project/src/db/queries.ts")).toBe(true);
    expect(globMatchesPath("**/*.ts", "/home/user/project/index.ts")).toBe(true);
    expect(globMatchesPath("src/db/**", "/home/user/project/lib/db/queries.ts")).toBe(false);
    expect(globMatchesPath("/etc/*.conf", "/home/user/etc/app.conf")).toBe(false);
  });

  test("global traps with relative globs still apply to absolute --path filters", async () => {
    const repo = new TrapRepository(openDatabase(":memory:"), undefined);
    repo.add(trap({
      title: "Guard db queries",
      category: "database",
      scope: "global",
      project_path: null,
      context: "When editing query code anywhere.",
      mistake: "Skipping the shared guard loses lessons.",
      fix: "Apply the shared guard.",
      path_globs: ["src/db/**"],
    }));

    const results = await repo.search("guard db queries", {
      mode: "fts",
      scope: "global",
      path: "/home/user/some-project/src/db/queries.ts",
    });
    expect(results[0]?.trap.title).toBe("Guard db queries");
  });

  test("project-relative path globs match absolute file paths under the project root", async () => {
    const projectRoot = realpathSync(mkdtempSync(join(tmpdir(), "codetrap-applicability-")));
    const repo = new TrapRepository(openDatabase(":memory:"), undefined);
    repo.add(trap({
      title: "Use repository transaction helper",
      category: "database",
      scope: "project",
      project_path: projectRoot,
      context: "When editing db repository code.",
      mistake: "Writing directly can split related changes.",
      fix: "Use the transaction helper.",
      path_globs: ["src/db/**"],
    }));

    const aliasedProjectRoot = projectRoot.startsWith("/private/var/")
      ? projectRoot.replace(/^\/private\/var\//, "/var/")
      : projectRoot;

    const results = await repo.search("repository transaction", {
      mode: "fts",
      scope: "project",
      path: join(aliasedProjectRoot, "src/db/repository.ts"),
    });

    expect(results[0]?.trap.title).toBe("Use repository transaction helper");
  });

  test("empty module and owner values behave like unscoped applicability fields", async () => {
    const repo = new TrapRepository(openDatabase(":memory:"), undefined);
    repo.add(trap({
      title: "Use database helper",
      category: "database",
      context: "When editing database code.",
      mistake: "Duplicating write behavior.",
      fix: "Use the database helper.",
      module: "",
      owner: "",
    }));

    const results = await repo.search("database helper", {
      mode: "fts",
      module: "db",
      owner: "platform",
    });
    const listed = repo.list({ module: "db", owner: "platform" });

    expect(results[0]?.trap.title).toBe("Use database helper");
    expect(listed[0]?.title).toBe("Use database helper");
  });
});
