import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LearningImpactOperations, LearningImpactStore } from "../lib/learning-impact";
import { ObservationRunRecorder } from "../lib/observation-recorder";
import { openObservationLedgerReadOnly } from "../lib/observation-ledger";
import { SessionOperations } from "../lib/session-operations";
import { SessionStore } from "../lib/session-store";
import { TrapOperations } from "../lib/trap-operations";
import { TrapStore } from "../lib/store";
import { addWebProject } from "../web/project-registry";
import { createWebHandler } from "../web/server";
import { tempHome, tempProjectDir } from "./helpers";

const TOKEN = "learning-impact-token";

describe("Learning Impact", () => {
  test("keeps explicit personal progress separate and lazily reads legacy learned state", () => {
    const project = learningProject(true);
    const original = readFileSync(insightsPath(project), "utf8");
    const insight = JSON.parse(original).insights[0];
    const store = new LearningImpactStore(project);

    expect(store.progress(insight)).toMatchObject({ status: "learned", legacy_derived: true });
    expect(existsSync(store.path())).toBe(false);

    const operations = learningOperations(project);
    const changed = operations.updateStatus(insight.id, "in_progress");
    expect(changed.progress).toMatchObject({ status: "in_progress", legacy_derived: false });
    expect(readFileSync(insightsPath(project), "utf8")).toBe(original);

    const feedback = operations.updateFeedback(insight.id, "helpful");
    expect(feedback.progress).toMatchObject({ status: "in_progress", feedback: "helpful" });
    const document = JSON.parse(readFileSync(store.path(), "utf8"));
    expect(document.progress).toHaveLength(1);
    expect(document.progress[0]).toMatchObject({ actor_ref: "local-user", insight_id: insight.id });
  });

  test("previews without writes and stages one idempotent governed candidate without confirmed memory", () => {
    const project = learningProject(false);
    const operations = learningOperations(project);
    const insightId = "insight-learning-impact";

    const preview = operations.preview(insightId);
    expect(preview).toMatchObject({ destination: "candidate_inbox", model_calls: 0, confirmed_memory_writes: 0 });
    expect(preview.draft.context).toContain("Learning Impact");
    expect(new SessionStore(project).listSessions({ status: "all" })).toHaveLength(0);
    expect(new TrapOperations(new TrapStore(project)).listTraps({ scope: "project" }).flatMap((group) => group.traps)).toHaveLength(0);

    const created = operations.createCandidate(insightId, {
      ...preview.draft,
      mistake: "Treating shared Insight content as if it were personal progress.",
      fix: "Store personal progress separately and require Inbox review before confirmed memory changes.",
    });
    expect(created).toMatchObject({ destination: "candidate_inbox", duplicate: false, model_calls: 0, confirmed_memory_writes: 0 });
    const candidate = new SessionStore(project).getCandidate(created.candidate.id, created.session_id).candidate;
    expect(candidate).toMatchObject({ status: "proposed", candidate_kind: "pitfall_trap" });
    expect(candidate.evidence[0].source_ref).toBe(`learning-insight:${insightId}`);
    expect(new TrapOperations(new TrapStore(project)).listTraps({ scope: "project" }).flatMap((group) => group.traps)).toHaveLength(0);

    const repeated = operations.createCandidate(insightId, {
      ...preview.draft,
      mistake: "Treating shared Insight content as if it were personal progress.",
      fix: "Store personal progress separately and require Inbox review before confirmed memory changes.",
    });
    expect(repeated).toMatchObject({ duplicate: true, session_id: created.session_id });
    expect(new SessionStore(project).listSessions({ status: "all" })).toHaveLength(1);
    expect(operations.state(JSON.parse(readFileSync(insightsPath(project), "utf8")).insights[0]).promotion).toMatchObject({
      status: "proposed",
      session_id: created.session_id,
      candidate_id: created.candidate.id,
    });
  });

  test("validates Run links and records metadata only when Observation is already configured", () => {
    const project = learningProject(false);
    const operations = learningOperations(project);
    expect(() => operations.linkRun("insight-learning-impact", "missing-run")).toThrow("Observation is not configured");
    expect(existsSync(join(project, ".codetrap", "observations", "ledger.sqlite"))).toBe(false);

    const recorder = new ObservationRunRecorder(project, () => new Date("2026-08-31T10:00:00.000Z"), () => "run-start-event");
    expect(recorder.start({
      run_id: "run-learning",
      device_id: "test-device",
      source_client: "codex",
      source_session_ref: null,
      repository_revision: null,
      branch: null,
      model_provider: null,
      model_name: null,
      completeness: "complete",
    }).success).toBe(true);

    const linked = operations.linkRun("insight-learning-impact", "run-learning");
    expect(linked.progress.linked_run_id).toBe("run-learning");
    operations.updateFeedback("insight-learning-impact", "unclear");

    const ledger = openObservationLedgerReadOnly(project)!;
    try {
      expect(ledger.listRunEvents("run-learning").map((event) => event.type)).toEqual([
        "run/started",
        "learning/linked-to-run",
        "learning/feedback-recorded",
      ]);
      expect(ledger.listRunEvents("run-learning").every((event) => event.sensitivity === "metadata")).toBe(true);
    } finally {
      ledger.close();
    }
  });

  test("exposes progress, preview, and Candidate Inbox staging through token-authenticated Web routes", async () => {
    const project = learningProject(false);
    const home = tempHome("codetrap-learning-impact-home-", { realpath: true, initCodetrap: true });
    addWebProject(project, home);
    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });

    const listed = await api(handler, `/api/insights?project=${encodeURIComponent(project)}&scope=project`);
    expect(listed.status).toBe(200);
    const insight = (await listed.json()).insights[0];
    expect(insight.learning_impact.progress.status).toBe("not_started");

    const status = await api(handler, "/api/learning/progress/status", {
      projectRoot: project, id: insight.id, status: "in_progress",
    });
    expect(status.status).toBe(200);
    expect((await status.json()).progress.status).toBe("in_progress");

    const previewResponse = await api(handler, "/api/learning/candidate/preview", {
      projectRoot: project, id: insight.id,
    });
    expect(previewResponse.status).toBe(200);
    const preview = await previewResponse.json();
    expect(preview.confirmed_memory_writes).toBe(0);

    const created = await api(handler, "/api/learning/candidate/create", {
      projectRoot: project,
      id: insight.id,
      draft: preview.draft,
    });
    expect(created.status).toBe(200);
    const result = await created.json();
    expect(result.candidate.status).toBe("proposed");

    const sessions = await api(handler, `/api/sessions?project=${encodeURIComponent(project)}`);
    expect((await sessions.json()).candidate_review.pending_count).toBe(1);
    expect(new TrapOperations(new TrapStore(project, undefined, home)).listTraps({ scope: "project" }).flatMap((group) => group.traps)).toHaveLength(0);
  });
});

function learningOperations(project: string): LearningImpactOperations {
  const traps = new TrapOperations(new TrapStore(project));
  return new LearningImpactOperations(
    project,
    new SessionOperations(new SessionStore(project), traps),
    () => new Date("2026-08-31T12:00:00.000Z"),
    (() => {
      let index = 0;
      return () => `learning-event-${++index}`;
    })()
  );
}

function learningProject(legacyLearned: boolean): string {
  const project = tempProjectDir("codetrap-learning-impact-", { realpath: true });
  const path = insightsPath(project);
  mkdirSync(join(project, ".codetrap", "phase2"), { recursive: true });
  writeFileSync(path, `${JSON.stringify({
    version: 1,
    insights: [{
      id: "insight-learning-impact",
      title: "Separate Learning Impact from shared content",
      summary: "Personal progress and Agent memory have different owners.",
      body: "Insight content -> personal progress -> reviewed candidate -> confirmed Agent memory",
      tags: ["learning", "governance"],
      source_refs: ["docs/impact-evals-design.zh-CN.md"],
      source_type: "documentation",
      topics: ["Learning Impact"],
      shelved_at: "2026-08-30T00:00:00.000Z",
      consulted_count: legacyLearned ? 1 : 0,
      last_consulted_at: legacyLearned ? "2026-08-30T01:00:00.000Z" : null,
    }],
  }, null, 2)}\n`);
  return project;
}

function insightsPath(project: string): string {
  return join(project, ".codetrap", "phase2", "insights.json");
}

function api(handler: ReturnType<typeof createWebHandler>, path: string, body?: Record<string, unknown>): Promise<Response> {
  return handler(new Request(`http://codetrap.local${path}`, {
    method: body ? "POST" : "GET",
    headers: { "X-Codetrap-Token": TOKEN, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }));
}
