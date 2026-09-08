import { test, expect } from "bun:test";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { revisionFixture } from "./experience-revision-fixture";
import { observationRunWebPayload } from "../web/observation-view";
import { runDisplayStatus, runEvidenceContent } from "../web/client-run-evidence";
import { RUN_EVIDENCE_TEXT } from "../web/client-run-evidence-text";
import { parseRun } from "../web/client-impact-data";

test("unfinished records are awaiting completion, not proof of process liveness", () => {
  expect(runDisplayStatus({ status: null, started_at: "2026-09-07", completed_at: null })).toBe("awaiting_completion");
  expect(runDisplayStatus({ status: null, started_at: null, completed_at: null })).toBe("unknown");
  expect(runDisplayStatus({ status: "cancelled", started_at: "2026-09-07", completed_at: "2026-09-07" })).toBe("cancelled");
});

test("run lineage connects tested revisions and exact-version later use without leaking draft text", async () => {
  const f = revisionFixture();
  const draft = f.draft();
  const evaluated = await f.ops.evaluate(draft.draft.id, draft.draft.digest);
  const accepted = f.ops.accept(evaluated.draft.id, evaluated.draft.digest);
  f.recorder.search({ ...f.call, run_id: "later-task" }, { query: "transaction", mode: "fts", path: null, module: null, duration_ms: 1, diagnostics: [], results: [{ trap_id: 1, revision: `project:${accepted.current!.updated_at}`, rank: 1 }] });
  const payload = observationRunWebPayload(f.project, f.call.run_id, f.home);
  expect(payload.improvements).toMatchObject({ unavailable: false, items: [{ id: draft.draft.id, evaluation: "passed", status: "accepted", later_runs: 1 }] });
  expect(observationRunWebPayload(f.project, "later-task", f.home).improvements?.items).toEqual([]);
  const json = JSON.stringify(payload.improvements);
  expect(json).not.toContain("PRIVATE_REASON"); expect(json).not.toContain("PRIVATE_QUERY"); expect(json).not.toContain("corpus");
  expect(parseRun(payload, f.project, f.call.run_id)).toBe(payload);
  const copy = structuredClone(payload); copy.improvements!.items[0].scope = "invalid" as never;
  expect(() => parseRun(copy, f.project, f.call.run_id)).toThrow();
  const html = runEvidenceContent(payload, k => RUN_EVIDENCE_TEXT.en[k as keyof typeof RUN_EVIDENCE_TEXT.en] || k, s => String(s));
  expect(html).toContain('data-evidence-revision="' + draft.draft.id + '"');
  expect(html).toContain('data-experience-review=');
});

test("missing revision data stays read-only and corrupt dossiers preserve available evidence", () => {
  const f = revisionFixture();
  const dir = join(f.project, ".codetrap", "experience-revisions");
  expect(f.ops.forRun(f.call.run_id)).toEqual({ items: [], unavailable: false });
  expect(existsSync(dir)).toBe(false);
  const draft = f.draft();
  mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, "rev-corrupted123.json"), "broken");
  const result = f.ops.forRun(f.call.run_id);
  expect(result.unavailable).toBe(true); expect(result.items[0]?.id).toBe(draft.draft.id);
});

test("registered Run API carries lineage with the configured home and leaves dossiers unchanged", async () => {
  const { createWebHandler } = await import("../web/server");
  const { readFileSync } = await import("node:fs");
  const f = revisionFixture("global");
  const d = f.draft();
  const file = join(f.project, ".codetrap", "experience-revisions", d.draft.id + ".json");
  const before = readFileSync(file, "utf8");
  const handler = createWebHandler({ token: "lineage-read-test", cwd: f.project, currentProjectRoot: f.project, home: f.home });
  const response = await handler(new Request("http://localhost/api/observations/run?" + new URLSearchParams({ project: f.project, id: f.call.run_id }), { headers: { "X-Codetrap-Token": "lineage-read-test" } }));
  expect(response.status).toBe(200);
  const payload = await response.json();
  expect(payload.improvements).toMatchObject({ unavailable: false, items: [{ scope: "global", trap_id: 1, status: "draft", later_runs: null }] });
  expect(readFileSync(file, "utf8")).toBe(before);
  expect(JSON.stringify(payload)).not.toContain("PRIVATE_REASON");
});

test("feedback cards offer quick judgments only when the displayed title matches the observed version", () => {
  const f = revisionFixture();
  const t = (k: string) => RUN_EVIDENCE_TEXT.en[k as keyof typeof RUN_EVIDENCE_TEXT.en] || k;
  const payload = observationRunWebPayload(f.project, f.call.run_id, f.home);
  const html = runEvidenceContent(payload, t, s => String(s));
  expect(html).toContain("Animation timing"); expect(html).toContain('data-quick-feedback="helpful"');
  expect(html).not.toContain("run-evidence-steps");
  expect(html).not.toContain("No linked revision yet");
  const historical = { ...payload, lesson_titles: {} };
  expect(runEvidenceContent(historical, t, s => String(s))).not.toContain("data-quick-feedback");
  expect(runEvidenceContent(historical, t, s => String(s))).toContain("data-experience-review");
});

test("quick feedback retries reuse their request identity and refresh only after success", async () => {
  const { createRevisionUI } = await import("../web/client-revisions");
  const calls: any[] = [], changed: string[] = [];
  let fail = true;
  const ui = createRevisionUI({ api: async (_path, options) => {
    calls.push(JSON.parse(String(options?.body)));
    if (fail) { fail = false; throw new Error("lost response"); }
    return {} as any;
  }, text: k => k, changed: p => { changed.push(p); }, openRun: () => {} });
  await expect(ui.recordFeedback("project-A", "event-one", "helpful")).rejects.toThrow("lost response");
  expect(changed).toEqual([]);
  await ui.recordFeedback("project-A", "event-one", "helpful");
  expect(calls[0].requestId).toBe(calls[1].requestId);
  expect(calls[1]).toMatchObject({ projectRoot: "project-A", eventId: "event-one", feedback: "helpful", executor: "user" });
  await ui.recordFeedback("project-B", "event-one", "helpful");
  expect(calls[2].requestId).not.toBe(calls[1].requestId);
  expect(changed).toEqual(["project-A", "project-B"]);
});
