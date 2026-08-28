import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runCli, runCliAsync, tempHome, tempProjectDir } from "./helpers";
import { ImproverStore } from "../lib/improver-store";

function runJson(args: string[], cwd: string, home: string, stdin?: string): any {
  const result = runCli([...args, "--json"], cwd, home, stdin);
  expect(result.exitCode, `${result.stderr}\n${result.stdout}`).toBe(0);
  return JSON.parse(result.stdout);
}

describe("feedback improver loop", () => {
  test("captures redacted bounded feedback idempotently through stdin", () => {
    const cwd = tempProjectDir("codetrap-improver-capture-");
    const home = tempHome();
    const input = feedback({
      external_id: "github-review-17",
      source_ref: "https://example.com/org/repo/pull/17?access_token=secret-value",
      agent_output: `const token = "sk-${"a".repeat(30)}"; ${"x".repeat(800)}`,
      human_feedback: "This external request needs an explicit timeout because the dependency can hang indefinitely.",
      final_change: "Added AbortSignal.timeout(5000).",
    });

    const first = runJson(["improver", "capture", "--input-json", "-"], cwd, home, JSON.stringify(input));
    expect(first.duplicate).toBe(false);
    expect(first.durable_destination_writes).toBe(0);
    expect(first.event.agent_output.length).toBeLessThanOrEqual(500);
    expect(first.event.agent_output).toContain("[REDACTED:api-key]");
    expect(first.event.source_ref).not.toContain("secret-value");
    expect(first.event.redactions.total).toBeGreaterThanOrEqual(2);

    const second = runJson(["improver", "capture", "--input-json", "-"], cwd, home, JSON.stringify(input));
    expect(second.duplicate).toBe(true);
    expect(runJson(["improver", "events", "--status", "all"], cwd, home).count).toBe(1);
    expect(runJson(["list", "--scope", "project"], cwd, home)).toEqual([]);
  });

  test("dry-runs by default and applies an eligible pitfall only to the candidate inbox", () => {
    const cwd = tempProjectDir("codetrap-improver-stage-");
    const home = tempHome();
    runJson(["improver", "capture", "--input-json", JSON.stringify(feedback())], cwd, home);

    const dryRun = runJson(["improver", "run"], cwd, home);
    expect(dryRun).toMatchObject({ applied: false, pending_event_count: 1, durable_destination_writes: 0 });
    expect(dryRun.groups[0]).toMatchObject({
      pattern_key: "external-http-timeout",
      signal_weight: 4,
      candidate_kind: "pitfall_trap",
      eligible: true,
    });
    expect(runJson(["improver", "events"], cwd, home).events[0].resolution).toBeNull();

    const applied = runJson(["improver", "run", "--apply"], cwd, home);
    expect(applied.staged).toHaveLength(1);
    expect(applied.durable_destination_writes).toBe(0);
    const staged = applied.staged[0];
    const candidate = runJson([
      "session", "candidate", staged.candidate_id, "--session", staged.session_id,
    ], cwd, home);
    expect(candidate.candidate).toMatchObject({
      candidate_kind: "pitfall_trap",
      review_decision: "pending",
      delivery_state: "draft",
    });
    expect(candidate.candidate.source_manifest_refs).toEqual(["https://example.com/pull/1"]);
    expect(runJson(["list", "--scope", "project"], cwd, home)).toEqual([]);
    expect(runJson(["improver", "events"], cwd, home).count).toBe(0);
    expect(runJson(["improver", "events", "--status", "handled"], cwd, home).count).toBe(1);
    expect(runJson(["improver", "run"], cwd, home).groups).toEqual([]);
  }, 15_000);

  test("requires recurrence for workflows and generates a valid reviewable skill candidate", () => {
    const cwd = tempProjectDir("codetrap-improver-workflow-");
    const home = tempHome();
    const workflow = {
      shape: "workflow",
      key: "external-http-safety",
      title: "Review external HTTP safety before merging",
      trigger: "Adding or changing an external HTTP request.",
      mistake: "Checking only the happy path misses timeout, retry, status, and secret-handling failures.",
      fix: "Apply one external-request safety workflow instead of remembering isolated rules.",
      why: "External dependencies fail independently and need a consistent safety boundary.",
      steps: [
        "Set a request-specific timeout.",
        "Retry only retryable failures with backoff.",
        "Check status and keep secrets out of logs.",
        "Test timeout and retry exhaustion.",
      ],
      tags: ["http", "safety"],
    };
    runJson(["improver", "capture", "--input-json", JSON.stringify(feedback({
      external_id: "review-1", source_ref: "https://example.com/pull/1", lesson: workflow,
    }))], cwd, home);

    const oneSignal = runJson(["improver", "run"], cwd, home);
    expect(oneSignal.groups[0].eligible).toBe(false);
    expect(oneSignal.groups[0].blockers.join(" ")).toContain("at least 2 feedback events");

    runJson(["improver", "capture", "--input-json", JSON.stringify(feedback({
      external_id: "review-2", source_ref: "https://example.com/pull/2", lesson: workflow,
    }))], cwd, home);
    const preview = runJson(["improver", "run"], cwd, home);
    expect(preview.groups[0]).toMatchObject({
      event_count: 2,
      distinct_source_refs: 2,
      candidate_kind: "skill_candidate",
      eligible: true,
    });
    expect(preview.groups[0].candidate_preview.destination_payload.files["SKILL.md"])
      .toContain("## Why");

    const applied = runJson(["improver", "run", "--apply"], cwd, home);
    const staged = applied.staged[0];
    const codexHome = tempHome("codetrap-improver-codex-");
    const claudeHome = tempHome("codetrap-improver-claude-");
    const phase3 = runJson([
      "phase3", "preview", staged.candidate_id, "--session", staged.session_id,
      "--codex-home", codexHome, "--claude-home", claudeHome,
    ], cwd, home);
    expect(phase3.skill_name).toBe("external-http-safety");
    expect(phase3.targets).toHaveLength(2);
    expect(existsSync(join(codexHome, "skills", "external-http-safety"))).toBe(false);
    expect(existsSync(join(claudeHome, "skills", "external-http-safety"))).toBe(false);
  }, 15_000);

  test("blocks incompatible feedback shapes instead of guessing a destination", () => {
    const cwd = tempProjectDir("codetrap-improver-conflict-");
    const home = tempHome();
    runJson(["improver", "capture", "--input-json", JSON.stringify(feedback({
      external_id: "shape-1",
      lesson: { ...feedback().lesson as object, key: "shared-pattern", shape: "pitfall" },
    }))], cwd, home);
    runJson(["improver", "capture", "--input-json", JSON.stringify(feedback({
      external_id: "shape-2",
      source_ref: "https://example.com/pull/2",
      lesson: { ...feedback().lesson as object, key: "shared-pattern", shape: "convention" },
    }))], cwd, home);

    const result = runJson(["improver", "run", "--apply"], cwd, home);
    expect(result.groups[0].eligible).toBe(false);
    expect(result.groups[0].blockers.join(" ")).toContain("incompatible feedback shapes");
    expect(result.staged).toEqual([]);
    expect(runJson(["improver", "events"], cwd, home).count).toBe(2);
  });

  test("routes conventions, docs, evaluations, and insights to existing governed destinations", () => {
    const cwd = tempProjectDir("codetrap-improver-routing-");
    const home = tempHome();
    const cases = [
      {
        id: "route-convention", key: "global-name-style", shape: "convention",
        extra: {}, expected: "project_convention",
      },
      {
        id: "route-docs", key: "http-client-guide", shape: "docs",
        extra: { destination_payload: { path: "docs/http-client.md" } }, expected: "docs_guidance",
      },
      {
        id: "route-eval", key: "timeout-recall-eval", shape: "evaluation",
        extra: { destination_payload: { case: { query: "external request timeout", minRecallAt5: 1 } } },
        expected: "search_eval_case",
      },
      {
        id: "route-insight", key: "external-dependency-boundary", shape: "insight",
        extra: {}, expected: "insight",
      },
    ];
    for (const [index, item] of cases.entries()) {
      runJson(["improver", "capture", "--input-json", JSON.stringify(feedback({
        external_id: item.id,
        source_ref: `https://example.com/pull/${index + 1}`,
        lesson: { ...feedback().lesson, key: item.key, shape: item.shape, ...item.extra },
      }))], cwd, home);
    }
    const groups = runJson(["improver", "run"], cwd, home).groups;
    expect(Object.fromEntries(groups.map((group: any) => [group.pattern_key, group.candidate_kind])))
      .toEqual(Object.fromEntries(cases.map((item) => [item.key, item.expected])));
    expect(groups.every((group: any) => group.eligible)).toBe(true);
  }, 15_000);

  test("records directional behavior outcomes separately from retrieval hits", () => {
    const cwd = tempProjectDir("codetrap-improver-outcome-");
    const home = tempHome();
    const input = {
      pattern_key: "external-http-timeout",
      metric: "manual_edit_rate",
      direction: "lower_is_better",
      before_value: 0.4,
      after_value: 0.08,
      before_samples: 50,
      after_samples: 50,
      source_ref: "eval:pull-requests-2026-08",
      note: "Timeout-related edits dropped after the candidate was installed.",
    };
    expect(runJson(["improver", "outcome", "--input-json", JSON.stringify(input)], cwd, home))
      .toMatchObject({ duplicate: false, outcome: { result: "improved" } });
    expect(runJson(["improver", "outcome", "--input-json", JSON.stringify(input)], cwd, home).duplicate).toBe(true);
    expect(runJson(["improver", "metrics"], cwd, home).behavior_outcomes)
      .toMatchObject({ total: 1, improved: 1, unchanged: 0, regressed: 0 });

    for (const [field, value] of [
      ["before_value", null],
      ["before_value", true],
      ["before_value", "0.4"],
      ["before_samples", "5.5"],
    ] as const) {
      const refused = runCli([
        "improver", "outcome", "--input-json", JSON.stringify({ ...input, [field]: value }), "--json",
      ], cwd, home);
      expect(refused.exitCode).toBe(1);
      expect(JSON.parse(refused.stdout).error).toContain("JSON");
    }
    const decimalOption = runCli(["improver", "metrics", "--min-signal-weight", "5.5", "--json"], cwd, home);
    expect(decimalOption.exitCode).toBe(1);
    expect(JSON.parse(decimalOption.stdout).error).toContain("positive integer");
  });

  test("deletes stored feedback excerpts through a dry-run and idempotent tombstone", () => {
    const cwd = tempProjectDir("codetrap-improver-delete-");
    const home = tempHome();
    const captured = runJson(["improver", "capture", "--input-json", JSON.stringify(feedback())], cwd, home);
    const eventId = captured.event.id;

    expect(runJson(["improver", "delete", eventId], cwd, home)).toMatchObject({
      applied: false, duplicate: false, event: { id: eventId }, tombstone: null,
    });
    expect(runJson(["improver", "events", "--status", "all"], cwd, home).count).toBe(1);

    const deleted = runJson(["improver", "delete", eventId, "--apply"], cwd, home);
    expect(deleted).toMatchObject({
      applied: true,
      duplicate: false,
      event: null,
      tombstone: { event_id: eventId, pattern_key: "external-http-timeout" },
      durable_destination_writes: 0,
    });
    expect(runJson(["improver", "events", "--status", "all"], cwd, home).count).toBe(0);
    expect(runJson(["improver", "metrics"], cwd, home).feedback.deleted).toBe(1);
    expect(runJson(["improver", "delete", eventId, "--apply"], cwd, home).duplicate).toBe(true);

    const retry = runJson(["improver", "capture", "--input-json", JSON.stringify(feedback())], cwd, home);
    expect(retry).toMatchObject({ duplicate: true, deleted: true, event: null, tombstone: { event_id: eventId } });
    expect(runJson(["improver", "events", "--status", "all"], cwd, home).count).toBe(0);
    expect(runJson(["improver", "metrics"], cwd, home).feedback.deleted).toBe(1);

    const state = readFileSync(join(cwd, ".codetrap", "improver", "state.json"), "utf-8");
    expect(state).not.toContain("const response = await fetch");
    expect(state).not.toContain("External requests need a timeout");
    expect(state).not.toContain("AbortSignal.timeout(5000)");
  }, 15_000);

  test("resolves surviving events when a staged batch races with tombstone deletion", () => {
    const cwd = tempProjectDir("codetrap-improver-delete-race-");
    const home = tempHome();
    const first = runJson(["improver", "capture", "--input-json", JSON.stringify(feedback({
      external_id: "race-1",
    }))], cwd, home).event;
    const second = runJson(["improver", "capture", "--input-json", JSON.stringify(feedback({
      external_id: "race-2",
      source_ref: "https://example.com/pull/2",
    }))], cwd, home).event;
    const store = new ImproverStore(cwd);
    store.deleteFeedback(first.id, true);

    const resolution = store.resolveFeedback([{
      event_ids: [first.id, second.id],
      resolution: {
        status: "staged",
        session_id: "session-race",
        candidate_id: "cand-race",
        candidate_kind: "pitfall_trap",
        note: "Simulated candidate staging before concurrent deletion.",
      },
    }]);
    expect(resolution.tombstoned_event_ids).toEqual([first.id]);
    expect(resolution.events.map((event) => event.id)).toEqual([second.id]);
    expect(runJson(["improver", "events", "--status", "pending"], cwd, home).count).toBe(0);
    expect(runJson(["improver", "events", "--status", "handled"], cwd, home).count).toBe(1);
  });

  test("blocks Windows-reserved workflow Skill names before Phase 3", () => {
    const cwd = tempProjectDir("codetrap-improver-reserved-skill-");
    const home = tempHome();
    const lesson = {
      ...feedback().lesson,
      shape: "workflow",
      key: "reserved-workflow-pattern",
      skill_name: "nul",
      steps: ["Check the reviewed workflow."],
    };
    for (const index of [1, 2]) {
      runJson(["improver", "capture", "--input-json", JSON.stringify(feedback({
        external_id: `reserved-${index}`,
        source_ref: `https://example.com/pull/${index}`,
        lesson,
      }))], cwd, home);
    }
    const group = runJson(["improver", "run"], cwd, home).groups[0];
    expect(group.eligible).toBe(false);
    expect(group.blockers.join(" ")).toContain("Windows-reserved");
  });

  test("concurrent feedback captures lose no events", async () => {
    const cwd = tempProjectDir("codetrap-improver-concurrency-");
    const home = tempHome();
    const results = await Promise.all(Array.from({ length: 6 }, (_, index) => runCliAsync([
      "improver", "capture", "--input-json", JSON.stringify(feedback({
        external_id: `parallel-${index}`,
        source_ref: `https://example.com/pull/${index}`,
        lesson: { ...feedback().lesson as object, key: `parallel-pattern-${index}` },
      })), "--json",
    ], cwd, home, { timeoutMs: 15_000 })));
    expect(results.map((result) => result.exitCode)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(runJson(["improver", "events", "--status", "all"], cwd, home).count).toBe(6);
  });

  test("concurrent apply runs converge on one staged candidate", async () => {
    const cwd = tempProjectDir("codetrap-improver-apply-concurrency-");
    const home = tempHome();
    runJson(["improver", "capture", "--input-json", JSON.stringify(feedback())], cwd, home);

    const results = await Promise.all([
      runCliAsync(["improver", "run", "--apply", "--json"], cwd, home, { timeoutMs: 15_000 }),
      runCliAsync(["improver", "run", "--apply", "--json"], cwd, home, { timeoutMs: 15_000 }),
    ]);
    expect(results.map((result) => result.exitCode)).toEqual([0, 0]);
    expect(runJson(["improver", "events", "--status", "handled"], cwd, home).count).toBe(1);
    expect(runJson(["improver", "metrics"], cwd, home).improver.staged_candidates).toBe(1);
  }, 20_000);
});

function feedback(overrides: Record<string, unknown> = {}): Record<string, any> {
  return {
    external_id: "github-review-1",
    source: "github_pr",
    source_ref: "https://example.com/pull/1",
    run_id: "agent-run-1",
    source_agent: "codex",
    reviewer_role: "maintainer",
    feedback_detail: "reasoned",
    outcome: "corrected",
    agent_output: "const response = await fetch(url);",
    human_feedback: "External requests need a timeout because the dependency can hang indefinitely.",
    final_change: "Added AbortSignal.timeout(5000).",
    lesson: {
      shape: "pitfall",
      key: "external-http-timeout",
      title: "Set an explicit timeout on external HTTP requests",
      trigger: "Calling an external HTTP service from Node or Bun.",
      mistake: "Using bare fetch leaves the request able to hang indefinitely.",
      fix: "Use the project timeout policy, such as AbortSignal.timeout(5000).",
      why: "External dependencies can stall independently of this process.",
      tags: ["http", "timeout"],
      related_files: ["src/api/client.ts"],
    },
    ...overrides,
  };
}
