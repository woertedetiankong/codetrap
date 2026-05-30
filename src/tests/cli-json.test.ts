import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../db/connection";
import * as queries from "../db/queries";

describe("CLI JSON contract", () => {
  test("search/show/list/stats expose parseable agent-facing JSON", () => {
    const cwd = tempProjectDir("codetrap-cli-json-");
    const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));

    const add = runCli([
      "add",
      "--json",
      JSON.stringify({
        title: "Use fetchWrapper for HTTP requests",
        category: "api",
        scope: "project",
        context: "When making network requests, use the project fetchWrapper.",
        mistake: "Calling fetch directly bypasses retry and error handling.",
        fix: "Use fetchWrapper and follow the HTTP request convention.",
        tags: ["http", "fetch"],
        severity: "error",
        path_globs: ["src/api/**"],
        module: "api",
        owner: "platform",
      }),
      "--output-json",
    ], cwd, home);
    expect(add.exitCode).toBe(0);
    expect(JSON.parse(add.stdout)).toEqual({ id: 1, scope: "project" });

    expect(runCli([
      "add_trap_evidence",
      "1",
      "--scope",
      "project",
      "--source_type",
      "commit",
      "--source_ref",
      "abc123",
      "--related_files",
      "src/api.ts,src/http.ts",
      "--note",
      "Captured from a review fix.",
    ], cwd, home).exitCode).toBe(0);

    const search = runCli(["search", "fetchWrapper", "--mode", "fts", "--scope", "project", "--json"], cwd, home);
    expect(search.exitCode).toBe(0);
    expect(search.stderr).toBe("");
    const cards = JSON.parse(search.stdout);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      trap_id: 1,
      scope: "project",
      title: "Use fetchWrapper for HTTP requests",
      next_action: {
        command: "codetrap show 1 --scope project --json",
      },
    });
    expect(cards[0].next_action.details_tool).toBeUndefined();

    const show = runCli(["show", "1", "--scope", "project", "--json"], cwd, home);
    expect(show.exitCode).toBe(0);
    expect(show.stderr).toBe("");
    const details = JSON.parse(show.stdout);
    expect(details.scope).toBe("project");
    expect(details.trap.tags).toEqual(["http", "fetch"]);
    expect(details.trap.path_globs).toEqual(["src/api/**"]);
    expect(details.trap.module).toBe("api");
    expect(details.trap.owner).toBe("platform");
    expect(details.evidence[0].related_files).toEqual(["src/api.ts", "src/http.ts"]);

    const list = runCli(["list", "--scope", "project", "--json"], cwd, home);
    expect(list.exitCode).toBe(0);
    const traps = JSON.parse(list.stdout);
    expect(traps[0].tags).toEqual(["http", "fetch"]);
    expect(traps[0].path_globs).toEqual(["src/api/**"]);

    const stats = runCli(["stats", "--json"], cwd, home);
    expect(stats.exitCode).toBe(0);
    const statsJson = JSON.parse(stats.stdout);
    expect(statsJson.project.total).toBe(1);
    expect(statsJson.project.embeddings).toMatchObject({
      total: 1,
      fresh: 0,
      stale: 0,
      missing: 1,
      provider_available: false,
    });
    expect(statsJson.global.total).toBe(0);

    const scopedStats = JSON.parse(runCli(["stats", "--scope", "project", "--json"], cwd, home).stdout);
    expect(scopedStats.project.total).toBe(1);
    expect(scopedStats.global).toBeNull();
  });

  test("search --json reads stdin only when no positional query is provided", () => {
    const cwd = tempProjectDir("codetrap-cli-stdin-");
    const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));
    runCli([
      "add",
      "--json",
      JSON.stringify({
        title: "CLI flags must not become query text",
        category: "bug",
        scope: "project",
        context: "When parsing command arguments, consume flag values.",
        mistake: "Treating --mode hybrid as positionals appends hybrid to the search query.",
        fix: "Return opts and positionals from parseArgs.",
        tags: ["cli", "parseArgs"],
        severity: "error",
      }),
    ], cwd, home);

    const search = runCli(["search", "--mode", "fts", "--scope", "project", "--json"], cwd, home, "parseArgs");
    expect(search.exitCode).toBe(0);
    const cards = JSON.parse(search.stdout);
    expect(cards[0].title).toBe("CLI flags must not become query text");

    const empty = runCli(["search", "--json"], cwd, home, "");
    expect(empty.exitCode).toBe(1);
    expect(empty.stdout).toBe("");
    expect(empty.stderr).toContain("Usage: codetrap search");
  });

  test("doctor --json reports scope and embedding health", () => {
    const cwd = tempProjectDir("codetrap-cli-doctor-");
    const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));
    const result = runCli(["doctor", "--json"], cwd, home);
    expect(result.exitCode).toBe(0);

    const doctor = JSON.parse(result.stdout);
    const realCwd = realpathSync(cwd);
    expect(doctor.cwd).toBe(realCwd);
    expect(doctor.project_root).toBe(realCwd);
    expect(doctor.project_db).toBe(join(realCwd, ".codetrap", "traps.db"));
    expect(doctor.global_db).toBe(join(home, ".codetrap", "traps.db"));
    expect(doctor.hybrid_search).toMatchObject({
      semantic_available: false,
      fallback_reason: "semantic_unavailable",
    });
    expect(doctor.diagnostics.mis_scoped_traps.global_db_project_traps).toEqual([]);
    expect(doctor.next_actions).toEqual([
      expect.objectContaining({
        command: "export JINA_API_KEY=<your-jina-api-key>",
      }),
    ]);
  });

  test("doctor --json reports project-scoped traps stranded in the global database", () => {
    const cwd = tempProjectDir("codetrap-cli-doctor-misscoped-");
    const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));
    mkdirSync(join(home, ".codetrap"), { recursive: true });
    const db = openDatabase(join(home, ".codetrap", "traps.db"));
    try {
      queries.insertTrap(db, {
        title: "Legacy project trap in global DB",
        category: "bug",
        scope: "project",
        context: "When older scope detection mistook home for a project.",
        mistake: "The trap was stored in the global DB with project scope.",
        fix: "Repair the scope or migrate it into a real project DB.",
        tags: ["scope"],
        severity: "error",
        project_path: home,
      });
      queries.insertTrap(db, {
        title: "Real global trap",
        category: "bug",
        scope: "global",
        context: "When checking global traps.",
        mistake: "Counting project traps as global traps.",
        fix: "Filter repository stats by expected scope.",
        tags: ["scope"],
        severity: "warning",
      });
    } finally {
      db.close();
    }

    const stats = JSON.parse(runCli(["stats", "--json"], cwd, home).stdout);
    expect(stats.global.total).toBe(1);
    expect(stats.global.embeddings.total).toBe(1);

    const doctor = JSON.parse(runCli(["doctor", "--json"], cwd, home).stdout);
    expect(doctor.traps.global).toBe(1);
    expect(doctor.embeddings.global.total).toBe(1);
    expect(doctor.diagnostics.mis_scoped_traps.global_db_project_traps).toEqual([
      expect.objectContaining({
        title: "Legacy project trap in global DB",
        scope: "project",
        project_path: home,
      }),
    ]);
    expect(doctor.next_actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: "codetrap repair-scope --dry-run --json",
        }),
      ])
    );
  });

  test("mutation commands expose machine-readable JSON results", () => {
    const cwd = tempProjectDir("codetrap-cli-mutation-json-");
    const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));
    const add = runCli([
      "add",
      "--json",
      JSON.stringify({
        title: "Archive stale API convention",
        category: "api",
        scope: "project",
        context: "When an API convention is replaced.",
        mistake: "Deleting the old trap loses history.",
        fix: "Archive or supersede it instead.",
        severity: "warning",
      }),
      "--output-json",
    ], cwd, home);
    const first = JSON.parse(add.stdout);

    const edit = runCli([
      "edit",
      String(first.id),
      "--scope",
      "project",
      "--json",
      JSON.stringify({
        path_globs: ["src/lifecycle/**"],
        module: "lifecycle",
        owner: "docs",
      }),
      "--output-json",
    ], cwd, home);
    expect(JSON.parse(edit.stdout)).toMatchObject({
      id: first.id,
      scope: "project",
      success: true,
    });

    const evidence = runCli([
      "add_trap_evidence",
      String(first.id),
      "--scope",
      "project",
      "--source_type",
      "article",
      "--source_ref",
      "https://vllm.ai/blog/2025-10-28-kimi-k2-accuracy",
      "--note",
      "External lesson captured from a vLLM blog post.",
      "--output-json",
    ], cwd, home);
    expect(JSON.parse(evidence.stdout)).toMatchObject({
      id: first.id,
      scope: "project",
      success: true,
    });

    const details = JSON.parse(runCli(["show", String(first.id), "--scope", "project", "--json"], cwd, home).stdout);
    expect(details.evidence[0]).toMatchObject({
      source_type: "article",
      source_ref: "https://vllm.ai/blog/2025-10-28-kimi-k2-accuracy",
      note: "External lesson captured from a vLLM blog post.",
    });

    const archive = runCli(["archive", String(first.id), "--scope", "project", "--json"], cwd, home);
    expect(JSON.parse(archive.stdout)).toMatchObject({
      id: first.id,
      scope: "project",
      success: true,
      status: "archived",
    });

    const missing = runCli(["delete", "404", "--scope", "project", "--json"], cwd, home);
    expect(missing.exitCode).toBe(1);
    expect(missing.stderr).toBe("");
    expect(JSON.parse(missing.stdout)).toMatchObject({
      id: 404,
      scope: "project",
      success: false,
      error: "Trap #404 not found.",
    });
  });

  test("config defaults and applicability filters shape search results", () => {
    const cwd = tempProjectDir("codetrap-cli-config-");
    const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));
    mkdirSync(join(home, ".codetrap"), { recursive: true });
    writeFileSync(join(home, ".codetrap", "config.json"), JSON.stringify({
      search: {
        mode: "fts",
        limit: 1,
        scope: "project",
        rerank: true,
      },
    }));

    runCli([
      "add",
      "--json",
      JSON.stringify({
        title: "Use db transaction helper",
        category: "database",
        scope: "project",
        context: "When editing repository writes.",
        mistake: "Writing multiple rows without the transaction helper.",
        fix: "Use the db transaction helper.",
        tags: ["db"],
        path_globs: ["src/db/**"],
        module: "db",
        owner: "platform",
        severity: "error",
      }),
    ], cwd, home);
    runCli([
      "add",
      "--json",
      JSON.stringify({
        title: "Use API envelope helper",
        category: "api",
        scope: "project",
        context: "When editing API responses.",
        mistake: "Returning raw data.",
        fix: "Use the API envelope helper.",
        tags: ["api"],
        path_globs: ["src/api/**"],
        module: "api",
        severity: "warning",
      }),
    ], cwd, home);

    const search = runCli([
      "search",
      "helper",
      "--path",
      "src/db/repository.ts",
      "--module",
      "db",
      "--owner",
      "platform",
      "--ranking-signals",
      "--json",
    ], cwd, home);
    expect(search.exitCode).toBe(0);
    const cards = JSON.parse(search.stdout);
    expect(cards).toHaveLength(1);
    expect(cards[0].title).toBe("Use db transaction helper");
    expect(cards[0].ranking_signals.map((signal: { code: string }) => signal.code)).toContain("path_scope_match");
  });
});

function tempProjectDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(join(dir, ".codetrap"));
  return dir;
}

function runCli(args: string[], cwd: string, home: string, stdin?: string) {
  const result = Bun.spawnSync({
    cmd: ["bun", "run", join(import.meta.dir, "..", "index.ts"), ...args],
    cwd,
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      JINA_API_KEY: "",
      CODETRAP_SEARCH_MODE: "",
      CODETRAP_SEARCH_LIMIT: "",
      CODETRAP_SEARCH_SCOPE: "",
      CODETRAP_RERANK: "",
    },
    stdin: stdin === undefined ? "ignore" : new TextEncoder().encode(stdin),
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    exitCode: result.exitCode,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr),
  };
}
