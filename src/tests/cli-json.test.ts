import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openDatabase } from "../db/connection";
import * as queries from "../db/queries";
import { runCli, tempHome, tempProjectDir } from "./helpers";

describe("CLI JSON contract", () => {
  test("search/show/list/stats expose parseable agent-facing JSON", () => {
    const cwd = tempProjectDir("codetrap-cli-json-");
    const home = tempHome();

    const add = runCli([
      "add",
      "--input-json",
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
    const cards = JSON.parse(search.stdout).results;
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
    const home = tempHome();
    runCli([
      "add",
      "--input-json",
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
    const cards = JSON.parse(search.stdout).results;
    expect(cards[0].title).toBe("CLI flags must not become query text");

    const empty = runCli(["search", "--json"], cwd, home, "");
    expect(empty.exitCode).toBe(1);
    expect(empty.stdout).toBe("");
    expect(empty.stderr).toContain("Usage: codetrap search");
  });

  test("boolean flags never swallow positionals and --flag=value works", () => {
    const cwd = tempProjectDir("codetrap-cli-flags-");
    const home = tempHome();
    runCli([
      "add",
      "--input-json",
      JSON.stringify({
        title: "Flag parser keeps the query",
        category: "bug",
        scope: "project",
        context: "When boolean flags precede the positional query.",
        mistake: "--json swallowed the next word as its value.",
        fix: "Parse boolean flags from an allowlist and split --flag=value.",
        severity: "error",
      }),
    ], cwd, home);

    // --json before the query must not swallow it (M22).
    const search = runCli(["search", "--json", "parser", "--mode", "fts"], cwd, home);
    expect(search.exitCode).toBe(0);
    expect(JSON.parse(search.stdout).results[0].title).toBe("Flag parser keeps the query");

    // --flag=value form is honored instead of silently ignored (M22).
    const limited = runCli(["list", "--limit=1", "--scope=project", "--json"], cwd, home);
    expect(limited.exitCode).toBe(0);
    expect(JSON.parse(limited.stdout)).toHaveLength(1);
  });

  test("bad input yields clean errors, and JSON mode gets a JSON envelope", () => {
    const cwd = tempProjectDir("codetrap-cli-errors-");
    const home = tempHome();

    // M23: invalid scope must not print a raw stack trace.
    const badScope = runCli(["delete", "1", "--scope", "bogus"], cwd, home);
    expect(badScope.exitCode).toBe(1);
    expect(badScope.stderr).toContain("Invalid scope: bogus");
    expect(badScope.stderr).not.toContain(" at ");

    // M25: failures under --json are structured envelopes on stdout.
    const badScopeJson = runCli(["delete", "1", "--scope", "bogus", "--json"], cwd, home);
    expect(badScopeJson.exitCode).toBe(1);
    expect(JSON.parse(badScopeJson.stdout)).toMatchObject({
      success: false,
      error: "Invalid scope: bogus",
    });

    const missingShow = runCli(["show", "999", "--json"], cwd, home);
    expect(missingShow.exitCode).toBe(1);
    expect(JSON.parse(missingShow.stdout)).toMatchObject({
      success: false,
      error: "Trap #999 not found.",
    });

    // M23: a corrupt user config degrades to defaults with a warning
    // instead of bricking every command.
    mkdirSync(join(home, ".codetrap"), { recursive: true });
    writeFileSync(join(home, ".codetrap", "config.json"), "{corrupt");
    const stats = runCli(["stats", "--json"], cwd, home);
    expect(stats.exitCode).toBe(0);
    expect(stats.stderr).toContain("ignoring invalid codetrap config");
    const doctor = runCli(["doctor", "--json"], cwd, home);
    expect(doctor.exitCode).toBe(0);
  });

  test("doctor --json reports scope and embedding health", () => {
    const cwd = tempProjectDir("codetrap-cli-doctor-");
    const home = tempHome();
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
    expect(doctor.candidate_review).toMatchObject({
      pending_count: 0,
      reviewed_count: 0,
      session_count: 0,
      next_session_id: null,
    });
    expect(doctor.next_actions).toEqual([
      expect.objectContaining({
        command: "export CODETRAP_EMBEDDING_PROVIDER=ollama",
      }),
    ]);
  });

  test("doctor --json reports configured but unreachable Ollama as unavailable", () => {
    const cwd = tempProjectDir("codetrap-cli-doctor-ollama-");
    const home = tempHome();
    const configDir = join(home, ".codetrap");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "config.json"), JSON.stringify({
      embeddings: {
        provider: "ollama",
        endpoint: "http://127.0.0.1:1",
        model: "qwen3-embedding:0.6b",
        dimensions: 1024,
      },
    }));

    const result = runCli(["doctor", "--json"], cwd, home);
    expect(result.exitCode).toBe(0);

    const doctor = JSON.parse(result.stdout);
    expect(doctor.hybrid_search).toMatchObject({
      semantic_available: false,
      fallback_reason: "semantic_unavailable",
    });
    expect(doctor.embeddings.project).toMatchObject({
      provider_available: true,
      provider: "ollama",
      model: "qwen3-embedding:0.6b",
      dimensions: 1024,
    });
    expect(doctor.next_actions).toEqual([
      expect.objectContaining({
        command: "ollama list",
      }),
    ]);
  });

  test("doctor --json reports pending session candidate review work", () => {
    const cwd = tempProjectDir("codetrap-cli-doctor-candidates-");
    const home = tempHome();
    const capture = runCli([
      "session",
      "capture",
      "--trap-json",
      JSON.stringify({
        title: "Review pending candidates from doctor",
        category: "bug",
        scope: "project",
        context: "When a post-flight candidate is captured in a closed session.",
        mistake: "Leaving proposed candidates hidden means they never become durable traps.",
        fix: "Surface pending candidate counts in doctor and review them through the session inbox.",
        severity: "error",
        tags: ["session", "review"],
        path_globs: ["src/lib/session-*.ts"],
        module: "session",
      }),
      "--kind",
      "review",
      "--json",
    ], cwd, home);
    expect(capture.exitCode).toBe(0);
    const captured = JSON.parse(capture.stdout);

    const doctor = JSON.parse(runCli(["doctor", "--json"], cwd, home).stdout);
    expect(doctor.candidate_review).toMatchObject({
      pending_count: 1,
      reviewed_count: 0,
      pending_session_count: 1,
      high_quality_pending_count: 1,
      next_session_id: captured.session_id,
    });
    expect(doctor.next_actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        command: `codetrap session candidates ${captured.session_id} --json`,
      }),
      expect.objectContaining({
        command: "codetrap web",
      }),
    ]));
  });

  test("embeddings management commands expose config and profile status JSON", () => {
    const cwd = tempProjectDir("codetrap-cli-embeddings-");
    const home = tempHome();
    const use = runCli([
      "embeddings",
      "use",
      "ollama",
      "--endpoint",
      "http://127.0.0.1:1",
      "--json",
    ], cwd, home);
    expect(use.exitCode).toBe(0);

    const configured = JSON.parse(use.stdout);
    expect(configured).toMatchObject({
      embeddings: {
        provider: "ollama",
        endpoint: "http://127.0.0.1:1",
        model: "qwen3-embedding:0.6b",
        dimensions: 1024,
      },
      next_action: {
        command: "codetrap embeddings reindex --scope project",
      },
    });
    expect(JSON.parse(readFileSync(join(home, ".codetrap", "config.json"), "utf-8"))).toMatchObject({
      embeddings: {
        provider: "ollama",
        endpoint: "http://127.0.0.1:1",
      },
    });

    const status = runCli(["embeddings", "status", "--scope", "project", "--json"], cwd, home);
    expect(status.exitCode).toBe(0);
    const statusJson = JSON.parse(status.stdout);
    expect(statusJson.runtime).toMatchObject({
      available: false,
      provider: "ollama",
      model: "qwen3-embedding:0.6b",
      profile_id: "ollama:qwen3-embedding:0.6b:1024:p1",
    });
    expect(statusJson.project).toMatchObject({
      total: 0,
      fresh: 0,
      stale: 0,
      missing: 0,
      profiles: [],
    });

    const list = runCli(["embeddings", "list", "--json"], cwd, home);
    expect(list.exitCode).toBe(0);
    expect(JSON.parse(list.stdout)).toMatchObject({
      active_profile_id: "ollama:qwen3-embedding:0.6b:1024:p1",
      project: [],
      global: [],
    });
  });

  test("doctor --json reports project-scoped traps stranded in the global database", () => {
    const cwd = tempProjectDir("codetrap-cli-doctor-misscoped-");
    const home = tempHome();
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
    const home = tempHome();
    const add = runCli([
      "add",
      "--input-json",
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
      "--input-json",
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

  test("unscoped mutations refuse ambiguous or wrong-scope trap ids", () => {
    const cwd = tempProjectDir("codetrap-cli-scope-guard-");
    const home = tempHome();

    const addTrap = (title: string, scope: string) => runCli([
      "add",
      "--input-json",
      JSON.stringify({
        title,
        category: "api",
        scope,
        context: "When mutating traps without an explicit scope.",
        mistake: "Unscoped ids silently resolve against whichever database matches.",
        fix: "Require --scope whenever an unqualified id is ambiguous.",
        severity: "error",
      }),
      "--output-json",
    ], cwd, home);

    expect(JSON.parse(addTrap("Project trap one", "project").stdout)).toEqual({ id: 1, scope: "project" });
    expect(JSON.parse(addTrap("Global trap one", "global").stdout)).toEqual({ id: 1, scope: "global" });
    expect(JSON.parse(addTrap("Global trap two", "global").stdout)).toEqual({ id: 2, scope: "global" });

    // Id 1 exists in both scopes: refuse instead of guessing.
    const ambiguous = runCli(["delete", "1", "--json"], cwd, home);
    expect(ambiguous.exitCode).toBe(1);
    expect(JSON.parse(ambiguous.stdout)).toMatchObject({
      id: 1,
      success: false,
      error: "Trap #1 exists in both project and global scope. Pass --scope to pick one.",
    });

    // Id 2 exists only in global: refuse instead of silently deleting the global trap.
    const wrongScope = runCli(["delete", "2", "--json"], cwd, home);
    expect(wrongScope.exitCode).toBe(1);
    expect(JSON.parse(wrongScope.stdout)).toMatchObject({
      id: 2,
      success: false,
      error: "Trap #2 not found in project scope; a different trap #2 exists in global scope. Pass --scope global to target it.",
    });

    // Both global traps must still exist.
    const globalList = JSON.parse(runCli(["list", "--scope", "global", "--json"], cwd, home).stdout);
    expect(globalList).toHaveLength(2);

    // Explicit scope still works.
    const explicit = runCli(["delete", "2", "--scope", "global", "--json"], cwd, home);
    expect(JSON.parse(explicit.stdout)).toMatchObject({ id: 2, scope: "global", success: true });
  });

  test("config defaults and applicability filters shape search results", () => {
    const cwd = tempProjectDir("codetrap-cli-config-");
    const home = tempHome();
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
      "--input-json",
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
      "--input-json",
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
    const cards = JSON.parse(search.stdout).results;
    expect(cards).toHaveLength(1);
    expect(cards[0].title).toBe("Use db transaction helper");
    expect(cards[0].ranking_signals.map((signal: { code: string }) => signal.code)).toContain("path_scope_match");
  });

  test("add/edit reject invalid enum values with a readable error, not a raw CHECK constraint (M7)", () => {
    const cwd = tempProjectDir("codetrap-cli-enum-");
    const home = tempHome();

    const add = runCli([
      "add",
      "--input-json",
      JSON.stringify({
        title: "Enum guard",
        category: "api",
        scope: "project",
        context: "c",
        mistake: "m",
        fix: "f",
      }),
      "--output-json",
    ], cwd, home);
    expect(add.exitCode).toBe(0);
    const id = JSON.parse(add.stdout).id as number;

    // edit with a bad category -> friendly message, no leaked SQLite error
    const badEdit = runCli([
      "edit",
      String(id),
      "--scope",
      "project",
      "--input-json",
      JSON.stringify({ category: "typo" }),
    ], cwd, home);
    expect(badEdit.exitCode).not.toBe(0);
    const editOut = badEdit.stdout + badEdit.stderr;
    expect(editOut).toContain("Invalid trap category: typo");
    expect(editOut).not.toContain("CHECK constraint");

    // add with a bad severity -> friendly message
    const badAdd = runCli([
      "add",
      "--input-json",
      JSON.stringify({
        title: "x",
        category: "api",
        scope: "project",
        context: "c",
        mistake: "m",
        fix: "f",
        severity: "meh",
      }),
    ], cwd, home);
    expect(badAdd.exitCode).not.toBe(0);
    const addOut = badAdd.stdout + badAdd.stderr;
    expect(addOut).toContain("Invalid trap severity: meh");
    expect(addOut).not.toContain("CHECK constraint");

    // JSON mode returns a structured error envelope (M25) with the friendly text
    const badJson = runCli([
      "edit",
      String(id),
      "--scope",
      "project",
      "--input-json",
      JSON.stringify({ severity: "nope" }),
      "--json",
    ], cwd, home);
    expect(badJson.exitCode).not.toBe(0);
    const parsed = JSON.parse(badJson.stdout);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain("Invalid trap severity: nope");
  });
});
