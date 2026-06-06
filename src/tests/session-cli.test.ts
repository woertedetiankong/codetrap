import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
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
    expect(inactive.candidate_review).toMatchObject({
      pending_count: 1,
      reviewed_count: 0,
      pending_session_count: 1,
      next_session_id: started.id,
    });
    const inactiveText = runCli(["session", "status"], cwd, home);
    expect(inactiveText.stdout).toContain("Pending candidate review: 1 candidate(s) across 1 session(s).");
    expect(inactiveText.stdout).toContain(`codetrap session candidates ${started.id}`);

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
      pending_count: 0,
      reviewed_count: 1,
      rejected_count: 0,
      high_quality_pending_count: 0,
      needs_edit_count: 0,
      candidate_review: {
        session_id: started.id,
        pending_count: 0,
        reviewed_count: 1,
      },
    });
    expect(runCli(["session", "list"], cwd, home).stdout).toContain("(0 pending, 1 reviewed)");
  });

  test("keeps raw test failures as notes instead of fallback candidate traps", () => {
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

    const close = JSON.parse(runCli(["session", "close", "--propose-traps", "--json"], cwd, home).stdout);
    expect(close).toMatchObject({
      id: started.id,
      status: "closed",
      candidate_count: 0,
      traps_written: 0,
    });

    const candidates = JSON.parse(runCli(["session", "candidates", started.id, "--json"], cwd, home).stdout);
    expect(candidates.candidates).toEqual([]);
  });

  test("captures a post-flight candidate in the active session", () => {
    const cwd = tempProjectDir("codetrap-session-capture-active-");
    const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));
    const started = JSON.parse(runCli([
      "session",
      "start",
      "update web pane controls",
      "--module",
      "web",
      "--json",
    ], cwd, home).stdout);

    const capture = runCli([
      "session",
      "capture",
      "--trap-json",
      JSON.stringify({
        title: "Keep pane toggle semantics aligned after layout swaps",
        context: "When changing web console pane order or shell layout.",
        mistake: "Updating visual pane order without updating collapse target semantics.",
        fix: "Update the shell toggle target to match the current rightmost pane and add regression coverage.",
        tags: ["web", "pane"],
        path_globs: ["src/web/**"],
        module: "",
        owner: "",
      }),
      "--kind",
      "review",
      "--source-ref",
      "manual-review",
      "--related-files",
      "src/web/client-script.ts",
      "--json",
    ], cwd, home);
    expect(capture.exitCode).toBe(0);
    const payload = JSON.parse(capture.stdout);
    expect(payload).toMatchObject({
      success: true,
      session_id: started.id,
      candidate_id: "cand-001",
      created_session: false,
      closed_session: false,
      duplicate: false,
    });
    expect(payload.next_action.command).toContain("codetrap session candidate cand-001");

    const status = JSON.parse(runCli(["session", "status", "--json"], cwd, home).stdout);
    expect(status.active_session_id).toBe(started.id);

    const candidates = JSON.parse(runCli(["session", "candidates", started.id, "--json"], cwd, home).stdout);
    expect(candidates.candidates).toHaveLength(1);
    expect(candidates.candidates[0]).toMatchObject({
      id: "cand-001",
      status: "proposed",
      trap: {
        title: "Keep pane toggle semantics aligned after layout swaps",
        category: "other",
        scope: "project",
        severity: "warning",
        module: null,
        owner: null,
      },
      evidence: [
        expect.objectContaining({
          source_type: "conversation",
          source_ref: "manual-review",
          related_files: ["src/web/client-script.ts"],
        }),
      ],
    });
  });

  test("captures a markdown candidate from stdin in the active session", () => {
    const cwd = tempProjectDir("codetrap-session-capture-markdown-stdin-");
    const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));
    const started = JSON.parse(runCli([
      "session",
      "start",
      "capture markdown trap drafts",
      "--module",
      "session",
      "--json",
    ], cwd, home).stdout);
    const markdown = [
      "Title: Keep Markdown trap capture explicit",
      "Context:",
      "When an AI agent records a post-flight lesson after a repeated test failure.",
      "Mistake:",
      "Passing raw failure logs directly to codetrap creates noisy candidate memory.",
      "Fix:",
      "Have the agent summarize the durable lesson into explicit trap fields first.",
      "Severity: error",
      "Tags:",
      "- session",
      "- markdown",
      "Path globs:",
      "- src/lib/session-capture.ts",
      "Related files:",
      "- src/lib/session-capture.ts",
      "- src/tests/session-cli.test.ts",
      "Module:",
      "Owner:",
      "Evidence:",
      "The Markdown draft came from a review of agent capture workflow quality.",
    ].join("\n");

    const capture = runCli([
      "session",
      "capture",
      "--trap-markdown",
      "-",
      "--kind",
      "review",
      "--source-ref",
      "markdown-review",
      "--related-files",
      "src/commands/workflow.ts",
      "--json",
    ], cwd, home, markdown);
    expect(capture.exitCode).toBe(0);
    const payload = JSON.parse(capture.stdout);
    expect(payload).toMatchObject({
      success: true,
      session_id: started.id,
      candidate_id: "cand-001",
      created_session: false,
      closed_session: false,
    });

    const candidates = JSON.parse(runCli(["session", "candidates", started.id, "--json"], cwd, home).stdout);
    expect(candidates.candidates[0]).toMatchObject({
      trap: {
        title: "Keep Markdown trap capture explicit",
        category: "other",
        scope: "project",
        severity: "error",
        tags: ["session", "markdown"],
        path_globs: ["src/lib/session-capture.ts"],
        module: null,
        owner: null,
      },
      evidence: [
        expect.objectContaining({
          source_type: "conversation",
          source_ref: "markdown-review",
          related_files: [
            "src/commands/workflow.ts",
            "src/lib/session-capture.ts",
            "src/tests/session-cli.test.ts",
          ],
          note: "The Markdown draft came from a review of agent capture workflow quality.",
        }),
      ],
    });
  });

  test("captures a markdown file into a closed post-flight session without confirming it", () => {
    const cwd = tempProjectDir("codetrap-session-capture-markdown-file-");
    const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));
    const markdownPath = join(cwd, "candidate.md");
    writeFileSync(markdownPath, [
      "Title: Do not search pending Markdown candidates as confirmed traps",
      "Context: When capturing a post-flight lesson without an active session.",
      "Mistake: Treating a proposed candidate as confirmed memory can affect future searches before review.",
      "Fix: Keep Markdown-captured candidates in the session inbox until explicit accept.",
      "Category: bug",
      "Severity: error",
      "Tags: session,markdown",
      "Evidence: This verifies the candidate inbox boundary.",
    ].join("\n"));

    const capture = runCli([
      "session",
      "capture",
      "--goal",
      "post-flight markdown capture",
      "--trap-markdown-file",
      markdownPath,
      "--kind",
      "test_failure",
      "--json",
    ], cwd, home);
    expect(capture.exitCode).toBe(0);
    const payload = JSON.parse(capture.stdout);
    expect(payload).toMatchObject({
      success: true,
      candidate_id: "cand-001",
      created_session: true,
      closed_session: true,
      candidate_count: 1,
    });

    const search = JSON.parse(runCli([
      "search",
      "pending Markdown candidates",
      "--scope",
      "project",
      "--mode",
      "fts",
      "--json",
    ], cwd, home).stdout);
    expect(search).toEqual([]);

    const accept = JSON.parse(runCli([
      "session",
      "accept",
      "cand-001",
      "--session",
      payload.session_id,
      "--json",
    ], cwd, home).stdout);
    expect(accept).toMatchObject({
      success: true,
      candidate_id: "cand-001",
      trap_id: 1,
      scope: "project",
    });

    const searchAfterAccept = JSON.parse(runCli([
      "search",
      "pending Markdown candidates",
      "--scope",
      "project",
      "--mode",
      "fts",
      "--json",
    ], cwd, home).stdout);
    expect(searchAfterAccept[0]).toMatchObject({
      trap_id: 1,
      title: "Do not search pending Markdown candidates as confirmed traps",
    });
  });

  test("validates markdown capture input selection and content", () => {
    const cwd = tempProjectDir("codetrap-session-capture-markdown-validation-");
    const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));
    const trapJson = JSON.stringify({
      title: "JSON trap",
      context: "When validating mixed capture inputs.",
      mistake: "Accepting multiple capture sources.",
      fix: "Require exactly one capture source.",
    });
    const markdown = [
      "Title: Markdown trap",
      "Context: When validating mixed capture inputs.",
      "Mistake: Accepting multiple capture sources.",
      "Fix: Require exactly one capture source.",
    ].join("\n");

    const mixed = runCli([
      "session",
      "capture",
      "--trap-json",
      trapJson,
      "--trap-markdown",
      markdown,
      "--json",
    ], cwd, home);
    expect(mixed.exitCode).toBe(1);
    expect(mixed.stderr).toContain("Choose only one of --trap-json, --trap-markdown, or --trap-markdown-file");

    const emptyStdin = runCli([
      "session",
      "capture",
      "--trap-markdown",
      "-",
      "--json",
    ], cwd, home, "");
    expect(emptyStdin.exitCode).toBe(1);
    expect(emptyStdin.stderr).toContain("Markdown trap input is required");

    const missingFile = runCli([
      "session",
      "capture",
      "--trap-markdown-file",
      join(cwd, "missing.md"),
      "--json",
    ], cwd, home);
    expect(missingFile.exitCode).toBe(1);
    expect(missingFile.stderr).toContain("missing.md");

    const missingFix = runCli([
      "session",
      "capture",
      "--trap-markdown",
      [
        "Title: Missing fix",
        "Context: When capturing incomplete Markdown.",
        "Mistake: Missing required fields.",
      ].join("\n"),
      "--json",
    ], cwd, home);
    expect(missingFix.exitCode).toBe(1);
    expect(missingFix.stderr).toContain("trap fix is required");

    const invalidSeverity = runCli([
      "session",
      "capture",
      "--trap-markdown",
      [
        "Title: Invalid severity",
        "Context: When capturing invalid Markdown enums.",
        "Mistake: Unsupported severity labels are accepted.",
        "Fix: Reject unsupported severity labels before writing candidates.",
        "Severity: fatal",
      ].join("\n"),
      "--json",
    ], cwd, home);
    expect(invalidSeverity.exitCode).toBe(1);
    expect(invalidSeverity.stderr).toContain("Invalid trap severity");
  });

  test("captures into a closed post-flight session when no session is active", () => {
    const cwd = tempProjectDir("codetrap-session-capture-postflight-");
    const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));

    const capture = runCli([
      "session",
      "capture",
      "--goal",
      "post-flight web pane capture",
      "--trap-json",
      JSON.stringify({
        title: "Keep web pane capture visible in the review inbox",
        category: "bug",
        scope: "project",
        context: "When capturing a post-flight lesson after a web console task.",
        mistake: "Leaving the candidate outside a session makes it invisible to the review inbox.",
        fix: "Create a post-flight session, write the candidate, generate a recap, and close the session.",
        severity: "error",
        tags: ["session", "capture"],
      }),
      "--kind",
      "test_failure",
      "--json",
    ], cwd, home);
    expect(capture.exitCode).toBe(0);
    const payload = JSON.parse(capture.stdout);
    expect(payload).toMatchObject({
      success: true,
      candidate_id: "cand-001",
      created_session: true,
      closed_session: true,
      candidate_count: 1,
    });
    expect(payload.recap_path).toContain("recap.md");

    const status = JSON.parse(runCli(["session", "status", "--json"], cwd, home).stdout);
    expect(status.active_session_id).toBeNull();

    const list = JSON.parse(runCli(["session", "list", "--json"], cwd, home).stdout);
    expect(list[0]).toMatchObject({
      id: payload.session_id,
      goal: "post-flight web pane capture",
      status: "closed",
      candidate_count: 1,
    });

    const candidates = JSON.parse(runCli(["session", "candidates", payload.session_id, "--json"], cwd, home).stdout);
    expect(candidates.candidates[0].evidence[0]).toMatchObject({
      source_type: "test_failure",
      source_ref: `session:${payload.session_id}`,
    });
  });

  test("close propose-traps merges capture candidates without overwriting reviewed status", () => {
    const cwd = tempProjectDir("codetrap-session-capture-dedupe-");
    const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));
    const started = JSON.parse(runCli([
      "session",
      "start",
      "dedupe capture candidates",
      "--module",
      "session",
      "--json",
    ], cwd, home).stdout);
    const trap = {
      title: "Keep captured candidates from being duplicated on close",
      category: "bug",
      scope: "project",
      context: "When closing a session after a candidate was captured directly.",
      mistake: "Regenerating candidates from notes can duplicate the same lesson or reset review status.",
      fix: "Merge proposed note candidates into the existing candidate document and preserve existing candidate status.",
      severity: "error",
      tags: ["session", "capture"],
    };

    expect(runCli([
      "session",
      "capture",
      "--trap-json",
      JSON.stringify(trap),
      "--json",
    ], cwd, home).exitCode).toBe(0);
    expect(runCli([
      "session",
      "reject",
      "cand-001",
      "--session",
      started.id,
      "--reason",
      "Already covered elsewhere.",
      "--json",
    ], cwd, home).exitCode).toBe(0);
    expect(runCli([
      "session",
      "note",
      "--kind",
      "review",
      "--text",
      [
        `Title: ${trap.title}`,
        `Category: ${trap.category}`,
        `Context: ${trap.context}`,
        `Mistake: ${trap.mistake}`,
        `Fix: ${trap.fix}`,
        `Severity: ${trap.severity}`,
        "Tags: session,capture",
      ].join("\n"),
    ], cwd, home).exitCode).toBe(0);

    const close = JSON.parse(runCli(["session", "close", "--propose-traps", "--json"], cwd, home).stdout);
    expect(close).toMatchObject({
      id: started.id,
      candidate_count: 1,
    });
    const candidates = JSON.parse(runCli(["session", "candidates", started.id, "--json"], cwd, home).stdout);
    expect(candidates.candidates).toHaveLength(1);
    expect(candidates.candidates[0]).toMatchObject({
      id: "cand-001",
      status: "rejected",
      rejection_reason: "Already covered elsewhere.",
    });
  });

  test("validates capture trap json before creating candidates", () => {
    const cwd = tempProjectDir("codetrap-session-capture-validation-");
    const home = mkdtempSync(join(tmpdir(), "codetrap-home-"));

    const invalidJson = runCli(["session", "capture", "--trap-json", "{bad", "--json"], cwd, home);
    expect(invalidJson.exitCode).toBe(1);
    expect(invalidJson.stdout).toBe("");
    expect(invalidJson.stderr).toContain("Invalid --trap-json");

    const missingFix = runCli([
      "session",
      "capture",
      "--trap-json",
      JSON.stringify({
        title: "Missing fix",
        context: "When capturing incomplete lessons.",
        mistake: "Saving candidates without actionable fixes.",
      }),
      "--json",
    ], cwd, home);
    expect(missingFix.exitCode).toBe(1);
    expect(missingFix.stdout).toBe("");
    expect(missingFix.stderr).toContain("trap fix is required");

    const invalidSeverity = runCli([
      "session",
      "capture",
      "--trap-json",
      JSON.stringify({
        title: "Invalid severity",
        context: "When validating capture input.",
        mistake: "Accepting unsupported severity labels.",
        fix: "Reject unsupported severity labels before writing candidates.",
        severity: "fatal",
      }),
      "--json",
    ], cwd, home);
    expect(invalidSeverity.exitCode).toBe(1);
    expect(invalidSeverity.stdout).toBe("");
    expect(invalidSeverity.stderr).toContain("Invalid trap severity");
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
      CODETRAP_EMBEDDING_PROVIDER: "",
      CODETRAP_OLLAMA_MODEL: "",
      CODETRAP_OLLAMA_ENDPOINT: "",
      CODETRAP_OLLAMA_DIMENSIONS: "",
      OLLAMA_HOST: "",
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
