import { describe, expect, test } from "bun:test";
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../db/connection";
import { TrapRepository } from "../db/repository";
import { trap } from "./helpers";

describe("trap applicability filters", () => {
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
