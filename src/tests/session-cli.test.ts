import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("session CLI", () => {
  test("records a session, proposes candidates, and only writes traps after accept", () => {
    const cwd = tempProjectDir("codetrap-session-cli-");
    const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));

    const start = runCli([
      "session",
      "start",
      "implement",
      "session",
      "capture",
      "--spec",
      "docs/session-mode-capture-spec.zh-CN.md",
      "--module",
      "session",
      "--owner",
      "local",
      "--json",
    ], cwd, home);
    expect(start.exitCode).toBe(0);
    const started = JSON.parse(start.stdout);
    expect(started).toMatchObject({
      goal: "implement session capture",
      status: "active",
      module: "session",
      owner: "local",
      spec_ref: "docs/session-mode-capture-spec.zh-CN.md",
    });
    expect(existsSync(join(cwd, ".codetrap", "sessions", started.id, "implementation-notes.md"))).toBe(true);

    const duplicate = runCli(["session", "start", "another", "goal"], cwd, home);
    expect(duplicate.exitCode).toBe(1);
    expect(duplicate.stderr).toContain("already active");

    const noteText = [
      "Title: Keep session persistence in SessionStore",
      "Category: convention",
      "Context: When implementing codetrap session CLI commands.",
      "Mistake: Writing session JSON directly in command adapters duplicates active/index/notes policy.",
      "Fix: Use SessionStore so active, index, notes, recap, and candidate files stay consistent.",
      "Severity: error",
      "Tags: session,cli",
      "Path globs: src/commands/**,src/lib/session-*",
    ].join("\n");
    const note = runCli([
      "session",
      "note",
      "--kind",
      "failure",
      "--text",
      noteText,
      "--related_files",
      "src/commands/workflow.ts,src/lib/session-store.ts",
      "--source_ref",
      "manual-test",
      "--json",
    ], cwd, home);
    expect(note.exitCode).toBe(0);
    const noted = JSON.parse(note.stdout);
    expect(noted).toMatchObject({
      session_id: started.id,
      kind: "failure",
    });

    const close = runCli(["session", "close", "--propose-traps", "--json"], cwd, home);
    expect(close.exitCode).toBe(0);
    const closed = JSON.parse(close.stdout);
    expect(closed).toMatchObject({
      id: started.id,
      status: "closed",
      candidate_count: 1,
      traps_written: 0,
    });
    expect(existsSync(join(cwd, ".codetrap", "sessions", started.id, "recap.md"))).toBe(true);
    expect(existsSync(join(cwd, ".codetrap", "sessions", started.id, "candidate-traps.json"))).toBe(true);

    const inactive = JSON.parse(runCli(["session", "status", "--json"], cwd, home).stdout);
    expect(inactive.active_session_id).toBeNull();

    const candidates = JSON.parse(runCli(["session", "candidates", started.id, "--json"], cwd, home).stdout);
    expect(candidates.session_id).toBe(started.id);
    expect(candidates.candidates).toHaveLength(1);
    expect(candidates.candidates[0]).toMatchObject({
      id: "cand-001",
      status: "proposed",
      trap: {
        title: "Keep session persistence in SessionStore",
        category: "convention",
        severity: "error",
        path_globs: ["src/commands/**", "src/lib/session-*"],
      },
      evidence: [
        expect.objectContaining({
          source_type: "conversation",
          source_ref: "manual-test",
        }),
      ],
    });
    expect(candidates.candidates[0].quality_score).toBeGreaterThanOrEqual(0.9);

    const trapsBeforeAccept = JSON.parse(runCli(["list", "--scope", "project", "--json"], cwd, home).stdout);
    expect(trapsBeforeAccept).toEqual([]);

    const accept = runCli([
      "session",
      "accept",
      "cand-001",
      "--session",
      started.id,
      "--edit-json",
      JSON.stringify({ severity: "critical" }),
      "--json",
    ], cwd, home);
    expect(accept.exitCode).toBe(0);
    const accepted = JSON.parse(accept.stdout);
    expect(accepted).toMatchObject({
      success: true,
      session_id: started.id,
      candidate_id: "cand-001",
      status: "accepted",
      trap_id: 1,
      scope: "project",
    });

    const details = JSON.parse(runCli(["show", "1", "--scope", "project", "--json"], cwd, home).stdout);
    expect(details.trap).toMatchObject({
      title: "Keep session persistence in SessionStore",
      severity: "critical",
      module: "session",
      owner: "local",
    });
    expect(details.trap.tags).toEqual(["session", "cli"]);
    expect(details.trap.path_globs).toEqual(["src/commands/**", "src/lib/session-*"]);
    expect(details.evidence[0]).toMatchObject({
      source_type: "conversation",
      source_ref: `session:${started.id}`,
      note: "Accepted from session candidate cand-001",
    });
    expect(details.evidence[0].related_files).toEqual(["src/commands/workflow.ts", "src/lib/session-store.ts"]);

    const acceptedCandidates = JSON.parse(runCli(["session", "candidates", started.id, "--json"], cwd, home).stdout);
    expect(acceptedCandidates.candidates[0].trap.severity).toBe("critical");

    const list = JSON.parse(runCli(["session", "list", "--json"], cwd, home).stdout);
    expect(list[0]).toMatchObject({
      id: started.id,
      status: "closed",
      candidate_count: 1,
      accepted_count: 1,
    });
  });

  test("captures piped test failures as fallback candidate traps", () => {
    const cwd = tempProjectDir("codetrap-session-stdin-");
    const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));
    const started = JSON.parse(runCli([
      "session",
      "start",
      "fix parser regression",
      "--module",
      "parser",
      "--json",
    ], cwd, home).stdout);

    const note = runCli([
      "session",
      "note",
      "--kind",
      "test_failure",
      "--stdin",
      "--related_files",
      "src/parser.ts",
      "--json",
    ], cwd, home, "Parser test failed because nested calls were split with a regex instead of tokenized.");
    expect(note.exitCode).toBe(0);

    const notes = JSON.parse(runCli(["session", "notes", "--json"], cwd, home).stdout);
    expect(notes.note_counts).toMatchObject({ test_failure: 1 });

    runCli(["session", "close", "--propose-traps"], cwd, home);
    const candidates = JSON.parse(runCli(["session", "candidates", started.id, "--json"], cwd, home).stdout);
    expect(candidates.candidates[0]).toMatchObject({
      id: "cand-001",
      status: "proposed",
      trap: {
        category: "bug",
        scope: "project",
        module: "parser",
        path_globs: ["src/parser.ts"],
      },
      evidence: [
        expect.objectContaining({
          source_type: "test_failure",
          related_files: ["src/parser.ts"],
        }),
      ],
    });
  });

  test("blocks possible conflicts unless the user accepts lifecycle handling", () => {
    const cwd = tempProjectDir("codetrap-session-conflict-");
    const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));

    const existing = runCli([
      "add",
      "--json",
      JSON.stringify({
        title: "Use fetchWrapper for API calls",
        category: "api",
        scope: "project",
        context: "When making API requests in this project.",
        mistake: "Calling fetch directly bypasses project retry behavior.",
        fix: "Use the legacy fetchWrapper import.",
        tags: ["api", "fetch"],
        severity: "warning",
        module: "api",
        path_globs: ["src/api/**"],
      }),
      "--output-json",
    ], cwd, home);
    expect(existing.exitCode).toBe(0);

    const started = JSON.parse(runCli([
      "session",
      "start",
      "update api request convention",
      "--module",
      "api",
      "--json",
    ], cwd, home).stdout);

    runCli([
      "session",
      "note",
      "--kind",
      "review",
      "--text",
      [
        "Title: Use fetchWrapper for API calls",
        "Category: api",
        "Context: When making API requests in this project.",
        "Mistake: Importing fetchWrapper from the old module leaves calls on the deprecated path.",
        "Fix: Use the new apiClient.fetchWrapper helper and update affected request tests.",
        "Severity: error",
        "Tags: api,fetch",
        "Path globs: src/api/**",
      ].join("\n"),
    ], cwd, home);
    runCli(["session", "close", "--propose-traps"], cwd, home);

    const blocked = runCli([
      "session",
      "accept",
      "cand-001",
      "--session",
      started.id,
      "--json",
    ], cwd, home);
    expect(blocked.exitCode).toBe(1);
    const conflict = JSON.parse(blocked.stdout);
    expect(conflict).toMatchObject({
      success: false,
      candidate_id: "cand-001",
      possible_conflicts: [
        expect.objectContaining({
          trap_id: 1,
          scope: "project",
          reason: "same module",
        }),
      ],
    });
    expect(conflict.next_actions.join(" ")).toContain("--supersedes <trap-id>");

    const accepted = runCli([
      "session",
      "accept",
      "cand-001",
      "--session",
      started.id,
      "--supersedes",
      "1",
      "--json",
    ], cwd, home);
    expect(accepted.exitCode).toBe(0);
    expect(JSON.parse(accepted.stdout)).toMatchObject({
      success: true,
      trap_id: 2,
      superseded_id: 1,
    });

    const oldTrap = JSON.parse(runCli(["show", "1", "--scope", "project", "--json"], cwd, home).stdout);
    expect(oldTrap.trap.status).toBe("superseded");
    const newTrap = JSON.parse(runCli(["show", "2", "--scope", "project", "--json"], cwd, home).stdout);
    expect(newTrap.trap.supersedes_id).toBe(1);

    const candidates = JSON.parse(runCli(["session", "candidates", started.id, "--json"], cwd, home).stdout);
    expect(candidates.candidates[0].quality).toMatchObject({
      conflict_checked: true,
      conflict_status: "confirmed",
      suggested_action: "supersede",
    });
  });

  test("checks conflicts after accept edits and records diagnostics", () => {
    const cwd = tempProjectDir("codetrap-session-edited-conflict-");
    const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));

    runCli([
      "add",
      "--json",
      JSON.stringify({
        title: "Use stable API client",
        category: "api",
        scope: "global",
        context: "When making API requests across projects.",
        mistake: "Calling fetch directly bypasses retry behavior.",
        fix: "Use the stable API client helper.",
        tags: ["api"],
        severity: "warning",
        module: "api",
      }),
      "--output-json",
    ], cwd, home);

    const started = JSON.parse(runCli([
      "session",
      "start",
      "update api convention",
      "--module",
      "api",
      "--json",
    ], cwd, home).stdout);

    runCli([
      "session",
      "note",
      "--kind",
      "review",
      "--text",
      [
        "Title: Prefer new API client",
        "Category: api",
        "Context: When making API requests in this project.",
        "Mistake: Calling fetch directly skips the shared request wrapper.",
        "Fix: Use the new apiClient helper.",
        "Severity: error",
        "Tags: api",
      ].join("\n"),
    ], cwd, home);
    runCli(["session", "close", "--propose-traps"], cwd, home);

    const blocked = runCli([
      "session",
      "accept",
      "cand-001",
      "--session",
      started.id,
      "--edit-json",
      JSON.stringify({ scope: "global" }),
      "--json",
    ], cwd, home);
    expect(blocked.exitCode).toBe(1);
    expect(JSON.parse(blocked.stdout)).toMatchObject({
      success: false,
      possible_conflicts: [
        expect.objectContaining({
          trap_id: 1,
          scope: "global",
          reason: "same module",
        }),
      ],
    });

    const candidates = JSON.parse(runCli(["session", "candidates", started.id, "--json"], cwd, home).stdout);
    expect(candidates.candidates[0]).toMatchObject({
      status: "proposed",
      trap: {
        scope: "global",
      },
      quality: {
        conflict_checked: true,
        conflict_status: "possible",
        suggested_action: "supersede",
      },
    });
  });

  test("detects path glob conflicts when a candidate file is covered by an existing glob", () => {
    const cwd = tempProjectDir("codetrap-session-path-conflict-");
    const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));

    runCli([
      "add",
      "--json",
      JSON.stringify({
        title: "Keep request boundary scoped",
        category: "api",
        scope: "project",
        context: "When changing transport helpers.",
        mistake: "Changing request boundaries without checking the scoped helper can bypass local behavior.",
        fix: "Keep transport changes behind the scoped helper.",
        tags: ["transport"],
        severity: "warning",
        path_globs: ["src/api/**"],
      }),
      "--output-json",
    ], cwd, home);

    const started = JSON.parse(runCli([
      "session",
      "start",
      "update client wrapper",
      "--json",
    ], cwd, home).stdout);

    runCli([
      "session",
      "note",
      "--kind",
      "review",
      "--text",
      [
        "Title: Use api client wrapper",
        "Category: api",
        "Context: When updating request code in this project.",
        "Mistake: Editing src/api/client.ts without preserving the wrapper contract.",
        "Fix: Use the api client wrapper and keep request tests updated.",
        "Severity: error",
        "Tags: transport",
        "Path globs: src/api/client.ts",
      ].join("\n"),
    ], cwd, home);
    runCli(["session", "close", "--propose-traps"], cwd, home);

    const blocked = runCli([
      "session",
      "accept",
      "cand-001",
      "--session",
      started.id,
      "--json",
    ], cwd, home);
    expect(blocked.exitCode).toBe(1);
    expect(JSON.parse(blocked.stdout)).toMatchObject({
      possible_conflicts: [
        expect.objectContaining({
          trap_id: 1,
          scope: "project",
          reason: "overlapping path scope",
        }),
      ],
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
