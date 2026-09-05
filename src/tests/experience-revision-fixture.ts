import { TrapStore } from "../lib/store";
import { ExperienceRevisions } from "../lib/experience-revisions";
import { ObservationRunRecorder } from "../lib/observation-recorder";
import { openObservationLedgerReadOnly } from "../lib/observation-ledger";
import { addWebProject } from "../web/project-registry";
import { createWebHandler } from "../web/server";
import { tempHome, tempProjectDir, trap } from "./helpers";
import type { ExperienceScope } from "../domain/experience-revision";

export const revisionInput = { title: "Transaction retry boundaries", context: "Handle transaction conflicts", mistake: "Retrying without a limit", fix: "Bound transaction retries and return an explicit failure", tags: ["transaction"], reason: "PRIVATE_REASON: animation advice appeared during a transaction task", cases: [ { query: "transaction", expectation: "include" }, { query: "animation", expectation: "exclude" } ] };
export function revisionFixture(scope: ExperienceScope = "project", sharedHome?: string) {
  const home = sharedHome ?? tempHome("revision-home-", { realpath: true, initCodetrap: true });
  const project = tempProjectDir("revision-project-", { realpath: true });
  addWebProject(project, home);
  const store = new TrapStore(project, undefined, home);
  if (!store.getDetails(1, scope)) store.add(trap({ scope, title: "Animation timing", context: "Animation frames", mistake: "Animation slowdown", fix: "Adjust animation speed", tags: ["animation"] }));
  const before = store.getDetails(1, scope)!.trap;
  const recorder = new ObservationRunRecorder(project);
  const call = { run_id: "revision-run", device_id: "test", source_ref: null };
  recorder.start({ ...call, source_client: "codex", source_session_ref: null, repository_revision: null, branch: null, model_provider: null, model_name: null, completeness: "complete" });
  recorder.search(call, { query: "PRIVATE_QUERY", mode: "fts", path: null, module: null, duration_ms: 1, diagnostics: [], results: [{ trap_id: 1, revision: `${scope}:${before.updated_at}`, rank: 1 }] });
  const ledger = openObservationLedgerReadOnly(project)!;
  const exposure = ledger.listRunEvents(call.run_id).find(e => e.type === "trap/exposed")!;
  ledger.close();
  const ops = new ExperienceRevisions(project, home);
  const handler = createWebHandler({ token: "revision-test-token", cwd: project, currentProjectRoot: project, home });
  const api = (path: string, body?: Record<string, unknown>) => handler(new Request("http://localhost/api/experience-revisions" + path + (body ? "" : (path.includes("?") ? "&" : "?") + "project=" + encodeURIComponent(project)), {
    method: body ? "POST" : "GET", headers: { "X-Codetrap-Token": "revision-test-token", "Content-Type": "application/json" },
    body: body ? JSON.stringify({ projectRoot: project, ...body }) : undefined,
  }));
  const feedback = () => ops.feedback(exposure.id, "irrelevant", "request-12345678").event_id;
  const draft = (id = "rev-test-12345678", input = revisionInput) => ops.save(id, feedback(), input);
  return { project, home, store, before, recorder, call, ops, exposure, api, feedback, draft };
}
