// Synthetic growth benchmark. Never writes to the current project's ledger.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const { openObservationLedger, openObservationLedgerReadOnly } = await import(process.env.CODETRAP_BENCH_LEDGER || new URL("../src/lib/observation-ledger.ts", import.meta.url).href) as typeof import("../src/lib/observation-ledger");
const root = mkdtempSync(join(tmpdir(), "codetrap-refresh-bench-"));
const median = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
async function measure(f: () => unknown) { const values: number[] = []; let first = 0; for (let i = 0; i < 6; i++) { const start = performance.now(); f(); const elapsed = performance.now() - start; if (i) values.push(elapsed); else first = elapsed; } return { first_ms: Number(first.toFixed(2)), warm_ms: Number(median(values).toFixed(2)) }; }
try {
  const writer = openObservationLedger(root);
  let inserted = 0;
  for (const count of [100, 1000, 10000]) {
    for (; inserted < count; inserted++) {
      const events = completeRun(writer.projectId).map(event => ({ ...event, id: `${event.id}-${inserted}`, run_id: `run-${String(inserted).padStart(5, "0")}` }));
      writer.appendMany(events);
    }
    const read = (f: (ledger: NonNullable<ReturnType<typeof openObservationLedgerReadOnly>>) => unknown) => { const ledger = openObservationLedgerReadOnly(root)!; try { return f(ledger); } finally { ledger.close(); } };
    const result = { runs: count, events: count * 6, overview_ms: await measure(() => read(l => l.overview())), recent_100_ms: await measure(() => read(l => l.listRuns(100))), evals_ms: await measure(() => read(l => l.evals())), refresh_ms: await measure(() => read(l => [l.overview(), l.listRuns(100)])) };
    console.log(JSON.stringify(result));
  }
  writer.close();
} finally { rmSync(root, { recursive: true, force: true }); }
function completeRun(projectId: string): Record<string, unknown>[] {
  return [
    event(projectId, "event-start", "run-1", 0, "run/started", {
      source_client: "codex",
      source_session_ref: "session-1",
      repository_revision: "abc123",
      branch: "main",
      model_provider: "openai",
      model_name: "gpt-5.x",
      completeness: "complete",
    }),
    event(projectId, "event-search", "run-1", 1, "trap/search-completed", {
      query_fingerprint: "sha256:query",
      mode: "hybrid",
      path_hint: null,
      module_hint: "http",
      results: [{ trap_id: 42, revision: "rev.3", rank: 1 }],
      diagnostics: [],
      duration_ms: 18.2,
    }),
    event(projectId, "event-exposure", "run-1", 2, "trap/exposed", {
      trap_id: 42,
      revision: "rev.3",
      rank: 1,
      query_fingerprint: "sha256:query",
    }),
    event(projectId, "event-validation", "run-1", 3, "validation/completed", {
      kind: "test",
      command_fingerprint: "sha256:command",
      status: "passed",
      passed: 4,
      failed: 0,
      duration_ms: 980,
    }),
    event(projectId, "event-feedback", "run-1", 4, "trap/feedback-recorded", {
      trap_id: 42,
      revision: "rev.3",
      feedback: "helpful",
      note_fingerprint: null,
    }, { evidence_class: "human_label", actor_ref: "local-user" }),
    event(projectId, "event-complete", "run-1", 5, "run/completed", {
      status: "completed",
      completeness: "complete",
      duration_ms: 4300,
      input_tokens: 1200,
      output_tokens: 320,
    }),
  ];
}

function event(
  projectId: string,
  id: string,
  runId: string,
  seq: number,
  type: string,
  attributes: Record<string, unknown>,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const time = `2026-08-30T10:00:0${seq}.000Z`;
  return {
    version: 1,
    id,
    project_id: projectId,
    run_id: runId,
    actor_ref: null,
    device_id: "device-local",
    seq,
    occurred_at: time,
    recorded_at: time,
    type,
    evidence_class: "observed_fact",
    sensitivity: "metadata",
    attributes,
    body_ref: null,
    source_ref: null,
    ...overrides,
  };
}
