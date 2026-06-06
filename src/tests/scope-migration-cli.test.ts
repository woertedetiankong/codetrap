import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../db/connection";
import * as queries from "../db/queries";
import { TrapStore } from "../lib/store";
import { trap } from "./helpers";

describe("scope repair and project migration CLI", () => {
  test("repair-scope dry-run lists legacy home project traps without mutating", () => {
    const home = tempDir("codetrap-home-");
    const destination = tempProjectDir("codetrap-repair-dest-");
    const legacy = seedLegacyHomeDb(home);

    const result = runCli(["repair-scope", "--json"], destination, home);
    expect(result.exitCode).toBe(0);

    const json = JSON.parse(result.stdout);
    expect(json).toMatchObject({
      command: "repair-scope",
      mode: "dry-run",
      from_project_path: home,
      to_project_path: destination,
      source_db_exists: true,
      destination_db_exists: false,
      counts: {
        source_before: 1,
        source_after: 1,
        destination_before: 0,
        destination_after: 0,
        candidates: 1,
        moved: 0,
      },
    });
    expect(json.candidates).toEqual([
      expect.objectContaining({
        id: legacy.projectId,
        title: "Legacy home-scoped project trap",
        project_path: home,
      }),
    ]);
    expect(json.next_action.command).toContain("codetrap repair-scope");
    expect(existsSync(join(destination, ".codetrap", "traps.db"))).toBe(false);

    const db = openDatabase(join(home, ".codetrap", "traps.db"));
    try {
      expect(queries.countProjectTrapsByPath(db, home)).toBe(1);
      expect(queries.countTraps(db, { scope: "global", status: "all" })).toBe(1);
    } finally {
      db.close();
    }
  });

  test("repair-scope apply moves project traps, preserves evidence, and leaves global traps", () => {
    const home = tempDir("codetrap-home-");
    const destination = tempProjectDir("codetrap-repair-apply-");
    const legacy = seedLegacyHomeDb(home);

    const result = runCli(["repair-scope", "--apply", "--json"], destination, home);
    expect(result.exitCode).toBe(0);

    const json = JSON.parse(result.stdout);
    expect(json).toMatchObject({
      command: "repair-scope",
      mode: "apply",
      counts: {
        source_before: 1,
        source_after: 0,
        destination_before: 0,
        destination_after: 1,
        candidates: 1,
        moved: 1,
      },
    });
    expect(json.moved).toEqual([
      expect.objectContaining({
        source_id: legacy.projectId,
        title: "Legacy home-scoped project trap",
      }),
    ]);
    expect(existsSync(json.backups.source_db)).toBe(true);

    const sourceDb = openDatabase(join(home, ".codetrap", "traps.db"));
    try {
      expect(queries.countProjectTrapsByPath(sourceDb, home)).toBe(0);
      expect(queries.countTraps(sourceDb, { scope: "global", status: "all" })).toBe(1);
    } finally {
      sourceDb.close();
    }

    const destinationStore = new TrapStore(destination, undefined);
    const imported = destinationStore.list({ scope: "project", status: "all" })[0].traps[0];
    expect(imported).toMatchObject({
      title: "Legacy home-scoped project trap",
      scope: "project",
      project_path: destination,
      status: "active",
    });
    const details = destinationStore.getDetails(imported.id, "project");
    expect(details?.evidence[0]).toMatchObject({
      source_type: "commit",
      source_ref: "abc123",
      note: "Legacy evidence.",
    });
    expect(JSON.parse(details?.evidence[0].related_files ?? "[]")).toEqual(["src/legacy.ts"]);
  });

  test("migrate-project apply moves between initialized project databases with backups", () => {
    const home = tempDir("codetrap-home-");
    const source = tempProjectDir("codetrap-migrate-source-");
    const destination = tempProjectDir("codetrap-migrate-dest-");
    const sourceStore = new TrapStore(source, undefined);
    const destinationStore = new TrapStore(destination, undefined);
    const sourceTrap = sourceStore.add(trap({
      scope: "project",
      title: "Move this project trap",
      category: "bug",
      severity: "critical",
    }));
    sourceStore.addEvidence(sourceTrap.id, {
      source_type: "test_failure",
      source_ref: "run-123",
    }, "project");
    destinationStore.add(trap({
      scope: "project",
      title: "Existing destination trap",
    }));

    const result = runCli([
      "migrate-project",
      "--from-project-path",
      source,
      "--to-project-path",
      destination,
      "--apply",
      "--json",
    ], destination, home);
    expect(result.exitCode).toBe(0);

    const json = JSON.parse(result.stdout);
    expect(json).toMatchObject({
      command: "migrate-project",
      mode: "apply",
      counts: {
        source_before: 1,
        source_after: 0,
        destination_before: 1,
        destination_after: 2,
        moved: 1,
      },
    });
    expect(existsSync(json.backups.source_db)).toBe(true);
    expect(existsSync(json.backups.destination_db)).toBe(true);

    expect(new TrapStore(source, undefined).list({ scope: "project", status: "all" })).toEqual([]);
    const moved = new TrapStore(destination, undefined)
      .list({ scope: "project", status: "all" })[0].traps
      .find((candidate) => candidate.title === "Move this project trap");
    expect(moved).toBeTruthy();
    expect(moved?.project_path).toBe(destination);
  });

  test("scope migration safety cases return stable CLI outcomes", () => {
    const home = tempDir("codetrap-home-");
    const source = tempProjectDir("codetrap-safety-source-");
    const destination = tempProjectDir("codetrap-safety-dest-");
    const missingSource = tempDir("codetrap-missing-source-");

    const missing = runCli([
      "migrate-project",
      "--from-project-path",
      missingSource,
      "--to-project-path",
      destination,
      "--json",
    ], destination, home);
    expect(missing.exitCode).toBe(0);
    expect(JSON.parse(missing.stdout)).toMatchObject({
      source_db_exists: false,
      counts: { candidates: 0, moved: 0 },
      next_action: null,
    });

    const noCandidates = runCli([
      "migrate-project",
      "--from-project-path",
      source,
      "--to-project-path",
      destination,
      "--json",
    ], destination, home);
    expect(noCandidates.exitCode).toBe(0);
    expect(JSON.parse(noCandidates.stdout).counts.candidates).toBe(0);

    const uninitializedDestination = tempDir("codetrap-uninitialized-dest-");
    const uninitialized = runCli([
      "migrate-project",
      "--from-project-path",
      source,
      "--to-project-path",
      uninitializedDestination,
    ], destination, home);
    expect(uninitialized.exitCode).toBe(1);
    expect(uninitialized.stderr).toContain("Destination project is not initialized");

    const samePath = runCli([
      "migrate-project",
      "--from-project-path",
      source,
      "--to-project-path",
      source,
    ], destination, home);
    expect(samePath.exitCode).toBe(1);
    expect(samePath.stderr).toContain("must be different");

    const bothModes = runCli([
      "repair-scope",
      "--dry-run",
      "--apply",
    ], destination, home);
    expect(bothModes.exitCode).toBe(1);
    expect(bothModes.stderr).toContain("choose either --dry-run or --apply");
  });
});

function seedLegacyHomeDb(home: string): { projectId: number; globalId: number } {
  mkdirSync(join(home, ".codetrap"), { recursive: true });
  const db = openDatabase(join(home, ".codetrap", "traps.db"));
  try {
    const projectId = queries.insertTrap(db, trap({
      title: "Legacy home-scoped project trap",
      scope: "project",
      category: "convention",
      severity: "error",
      project_path: home,
    }));
    queries.addTrapEvidence(db, projectId, {
      source_type: "commit",
      source_ref: "abc123",
      related_files: ["src/legacy.ts"],
      note: "Legacy evidence.",
    });
    const globalId = queries.insertTrap(db, trap({
      title: "Real global trap stays put",
      scope: "global",
      project_path: null,
    }));
    return { projectId, globalId };
  } finally {
    db.close();
  }
}

function tempProjectDir(prefix: string): string {
  const dir = tempDir(prefix);
  mkdirSync(join(dir, ".codetrap"));
  return dir;
}

function tempDir(prefix: string): string {
  return realpathSync(mkdtempSync(join(tmpdir(), prefix)));
}

function runCli(args: string[], cwd: string, home: string) {
  const result = Bun.spawnSync({
    cmd: ["bun", "run", join(import.meta.dir, "..", "index.ts"), ...args],
    cwd,
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      CODETRAP_EMBEDDING_PROVIDER: "",
      CODETRAP_OLLAMA_MODEL: "",
      CODETRAP_OLLAMA_ENDPOINT: "",
      CODETRAP_OLLAMA_DIMENSIONS: "",
      OLLAMA_HOST: "",
      JINA_API_KEY: "",
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    exitCode: result.exitCode,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr),
  };
}
