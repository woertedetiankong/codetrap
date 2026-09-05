import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildTrapInput } from "../domain/trap";
import { LearningImpactOperations } from "../lib/learning-impact";
import { ObservationRunRecorder } from "../lib/observation-recorder";
import { openObservationLedgerReadOnly } from "../lib/observation-ledger";
import { SessionOperations } from "../lib/session-operations";
import { SessionStore } from "../lib/session-store";
import { TrapOperations } from "../lib/trap-operations";
import { TrapStore } from "../lib/store";
import { trapExperienceWebPayload } from "../web/experience-view";
import { createWebHandler } from "../web/server";
import { addWebProject } from "../web/project-registry";
import { tempHome, tempProjectDir } from "./helpers";

function project() { return tempProjectDir("codetrap-experience-", { realpath: true }); }
function learning(root: string) { return new LearningImpactOperations(root, new SessionOperations(new SessionStore(root), new TrapOperations(new TrapStore(root)))); }
function record(root: string, run = "run-1") {
  const recorder = new ObservationRunRecorder(root);
  const context = { run_id: run, device_id: "experience-test", source_ref: null };
  recorder.start({ ...context, source_client: "codex", source_session_ref: null, repository_revision: null, branch: null, model_provider: null, model_name: null, completeness: "complete" });
  return { recorder, context };
}
function expose(recorder: ObservationRunRecorder, context: ReturnType<typeof record>["context"], revision: string, id = 1) {
  recorder.search(context, { query: "RAW_PRIVATE_QUERY", mode: "fts", path: "/private/path", module: null,
    results: [{ trap_id: id, revision, rank: 1 }], diagnostics: [], duration_ms: 1 });
}

describe("scoped trap experience", () => {
  test("separates scopes, revisions, IDs and corrected ratings without rewriting history", () => {
    const root = project();
    const { recorder, context } = record(root);
    expose(recorder, context, "project:current");
    expose(recorder, context, "project:other");
    expose(recorder, context, "global:current");
    expose(recorder, context, "unqualified");
    expose(recorder, context, "project:current", 2);
    recorder.feedback({ ...context, trap_id: 1, revision: "project:other", feedback: "harmful", note: "PRIVATE_NOTE" });
    recorder.feedback({ ...context, trap_id: 1, revision: "project:current", feedback: "helpful", note: null });
    recorder.feedback({ ...context, trap_id: 1, revision: "global:current", feedback: "harmful", note: null });
    recorder.feedback({ ...context, trap_id: 1, revision: null, feedback: "irrelevant", note: null });
    recorder.feedback({ ...context, trap_id: 1, revision: "project:current", feedback: "should_have_matched", note: null });
    recorder.validation({ ...context, kind: "test", command: "private command", status: "passed", passed: 2, failed: 0, duration_ms: 3 });
    const ledger = openObservationLedgerReadOnly(root)!;
    try {
      const before = ledger.listRunEvents(context.run_id);
      const result = ledger.trapExperience(1, "project", "project:current");
      expect(result).toMatchObject({ availability: "ready", exposure_count: 2, current_revision_exposures: 1, other_revision_exposures: 1,
        run_count: 1, helpful: 1, harmful: 0, irrelevant: 0, superseded_feedback: 1, miss_reports: 1 });
      expect(result.runs[0]).toMatchObject({ id: context.run_id, feedback: "helpful", latest_validation_status: "passed", exposure_count: 2, miss_reports: 1 });
      expect(ledger.trapExperience(1, "global", "global:current")).toMatchObject({ exposure_count: 1, helpful: 0, harmful: 1, superseded_feedback: 0 });
      expect(ledger.trapExperience(2, "project", "project:current")).toMatchObject({ exposure_count: 1, helpful: 0, harmful: 0 });
      expect(ledger.listRunEvents(context.run_id)).toEqual(before);
      for (const secret of ["PRIVATE", "private command", "query_fingerprint", "note_fingerprint"]) expect(JSON.stringify(result)).not.toContain(secret);
    } finally { ledger.close(); }
  });

  test("paginates all matching runs and includes feedback-only tasks", () => {
    const root = project();
    for (let i = 0; i < 23; i++) {
      const { recorder, context } = record(root, "run-" + i);
      if (i === 0) recorder.feedback({ ...context, trap_id: 1, revision: "project:v1", feedback: "helpful", note: null });
      else expose(recorder, context, "project:v1");
    }
    const ledger = openObservationLedgerReadOnly(root)!;
    try {
      const first = ledger.trapExperience(1, "project", "project:v1");
      const second = ledger.trapExperience(1, "project", "project:v1", 20);
      expect(first).toMatchObject({ run_count: 23, exposure_count: 22, helpful: 1, has_more: true });
      expect(first.runs).toHaveLength(20);
      expect(second.runs).toHaveLength(3);
      expect(second.has_more).toBe(false);
      expect(new Set([...first.runs, ...second.runs].map((run) => run.id)).size).toBe(23);
      expect(second.runs.find((run) => run.id === "run-0")).toMatchObject({ exposure_count: 0, feedback: "helpful" });
      expect(ledger.trapExperience(1, "project", "project:v1", 100).runs).toEqual([]);
    } finally { ledger.close(); }
  });

  test("isolates identical local identities across projects and never initializes observation on read", () => {
    const first = project(); const second = project();
    const { recorder, context } = record(first);
    expose(recorder, context, "global:current");
    const data = trapExperienceWebPayload(second, 1, "global", "global:current", learning(second));
    expect(data.observations.availability).toBe("not_configured");
    expect(data.sources).toEqual({ availability: "ready", insights: [] });
    expect(existsSync(join(second, ".codetrap", "observations", "ledger.sqlite"))).toBe(false);
    const other = record(second);
    other.recorder.feedback({ ...other.context, trap_id: 1, revision: "global:current", feedback: "irrelevant", note: null });
    expect(trapExperienceWebPayload(second, 1, "global", "global:current", learning(second)).observations).toMatchObject({ exposure_count: 0, irrelevant: 1 });
  });

  test("degrades Learning and observation sources independently", () => {
    const root = project();
    const { recorder, context } = record(root);
    expose(recorder, context, "project:v1");
    mkdirSync(join(root, ".codetrap", "phase2"), { recursive: true });
    writeFileSync(join(root, ".codetrap", "phase2", "insights.json"), "broken json");
    const result = trapExperienceWebPayload(root, 1, "project", "project:v1", learning(root));
    expect(result.sources.availability).toBe("unavailable");
    expect(result.observations).toMatchObject({ availability: "ready", exposure_count: 1 });
    const other = project();
    record(other);
    writeFileSync(join(other, ".codetrap", "observations", "ledger.sqlite"), "broken database");
    const unavailable = trapExperienceWebPayload(other, 1, "project", "project:v1", learning(other));
    expect(unavailable.observations.availability).toBe("unavailable");
    expect(unavailable.sources.availability).toBe("ready");
  });

  test("Web requires authorized projects and explicit valid identities, keeps healthy details available", async () => {
    const root = project();
    const home = tempHome("codetrap-experience-home-", { realpath: true, initCodetrap: true });
    const traps = new TrapOperations(new TrapStore(root, undefined, home));
    for (const scope of ["project", "global"] as const) traps.addTrap({ ...buildTrapInput({ title: scope + " lesson", context: "When testing", mistake: "Mixing identity", fix: "Require explicit scope", category: "api", scope }) });
    addWebProject(root, home);
    const handler = createWebHandler({ token: "test", cwd: root, home, currentProjectRoot: root });
    const request = (query: string, token = "test") => handler(new Request("http://local/api/trap/experience?" + new URLSearchParams({ project: root }) + "&" + query, { headers: { "X-Codetrap-Token": token } }));
    expect((await request("id=1&scope=project", "wrong")).status).toBe(401);
    for (const query of ["id=1", "id=0&scope=project", "id=1.2&scope=project", "id=1&scope=all", "id=1&scope=global&offset=-1", "id=1&scope=global&offset=NaN"]) expect((await request(query)).status).toBe(400);
    expect((await request("id=999&scope=project")).status).toBe(404);
    const data = await (await request("id=1&scope=global")).json();
    expect(data.trap).toEqual({ id: 1, scope: "global" });
    expect(data.observations.availability).toBe("not_configured");
    const unregistered = project();
    expect((await handler(new Request("http://local/api/trap/experience?" + new URLSearchParams({ project: unregistered, id: "1", scope: "global" }), { headers: { "X-Codetrap-Token": "test" } }))).status).toBe(403);
    mkdirSync(join(root, ".codetrap", "phase2"), { recursive: true });
    writeFileSync(join(root, ".codetrap", "phase2", "insights.json"), "broken");
    expect((await (await request("id=1&scope=project")).json()).sources.availability).toBe("unavailable");
    const details = await handler(new Request("http://local/api/trap?" + new URLSearchParams({ project: root, id: "1", scope: "project" }), { headers: { "X-Codetrap-Token": "test" } }));
    expect(details.status).toBe(200);
  });
});
