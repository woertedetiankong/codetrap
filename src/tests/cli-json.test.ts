import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
    expect(details.evidence[0].related_files).toEqual(["src/api.ts", "src/http.ts"]);

    const list = runCli(["list", "--scope", "project", "--json"], cwd, home);
    expect(list.exitCode).toBe(0);
    const traps = JSON.parse(list.stdout);
    expect(traps[0].tags).toEqual(["http", "fetch"]);

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
      JINA_API_KEY: "",
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
