import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { revisionFields, revisionInput, revisionHash, trapRevisionHash, draftRevisionDigest,
  type RevisionDraft, type RevisionSource, type RevisionCase, type ExperienceScope } from "../domain/experience-revision";
import { openObservationLedgerReadOnly } from "./observation-ledger";
import { observationTrapScope, foldObservationFeedback } from "./observation-feedback";
import { ObservationRunRecorder } from "./observation-recorder";
import { TRAP_FEEDBACK_VALUES, type TrapExposurePayload, type TrapFeedbackPayload, type TrapFeedback } from "../domain/observation";
import { TrapStore } from "./store";
import { withAdvisoryLock } from "./advisory-lock";
import { readJsonFile, writeFileAtomic } from "./fs-json";
import { evaluateSearchFixtureCases, type EvalFixture } from "./search-eval";
import { resolveScopePath } from "./scope-path";

export class ExperienceRevisions {
  private readonly store: TrapStore;
  private readonly dir: string;
  private readonly owner: string;
  constructor(private readonly project: string, home?: string) {
    this.store = new TrapStore(project, undefined, home);
    this.dir = join(project, ".codetrap", "experience-revisions");
    this.owner = revisionHash(resolveScopePath(project));
  }

  context(eventId: string) {
    const ledger = openObservationLedgerReadOnly(this.project);
    if (!ledger) throw new Error("No observation ledger exists for this project.");
    try {
      const event = ledger.getEvent(eventId);
      if (!event?.run_id || !["trap/exposed", "trap/feedback-recorded"].includes(event.type)) throw new Error("Select a real scoped lesson exposure or feedback event.");
      const value = event.attributes as TrapExposurePayload | TrapFeedbackPayload;
      const scope = observationTrapScope(value.revision);
      if (!scope || !value.trap_id || !value.revision) throw new Error("This historical event has no explicit lesson identity.");
      const source: RevisionSource = { event_id: event.id, run_id: event.run_id, trap_id: value.trap_id, scope, revision: value.revision,
        feedback: event.type === "trap/feedback-recorded" ? (value as TrapFeedbackPayload).feedback : null };
      const current = this.store.getDetails(value.trap_id, scope)?.trap ?? null;
      const events = ledger.listRunEvents(event.run_id).filter((item) => {
        const attributes = item.attributes as TrapFeedbackPayload;
        return item.type === "trap/feedback-recorded" && attributes.trap_id === value.trap_id && observationTrapScope(attributes.revision) === scope;
      });
      return { source, source_type: event.type, current, feedback: foldObservationFeedback(events).current[0]?.attributes.feedback ?? null,
        same_revision: current ? `${scope}:${current.updated_at}` === source.revision : false };
    } finally { ledger.close(); }
  }

  feedback(eventId: string, feedback: string, requestId: string) {
    if (!(TRAP_FEEDBACK_VALUES as readonly string[]).includes(feedback)) throw new Error("Invalid feedback value.");
    const source = this.context(eventId).source;
    const id = "web-feedback-" + safeId(requestId);
    mkdirSync(this.dir, { recursive: true });
    return withAdvisoryLock(join(this.dir, "feedback.lock"), () => {
    const ledger = openObservationLedgerReadOnly(this.project)!;
    try {
      const prior = ledger.getEvent(id);
      if (prior) {
        const value = prior.attributes as TrapFeedbackPayload;
        if (prior.type !== "trap/feedback-recorded" || prior.run_id !== source.run_id || value.trap_id !== source.trap_id || value.revision !== source.revision || value.feedback !== feedback) throw new Error("The feedback request ID was already used for another judgment.");
        return { event_id: id, duplicate: true };
      }
    } finally { ledger.close(); }
    const result = new ObservationRunRecorder(this.project).feedback({ run_id: source.run_id, device_id: "web-review", actor_ref: "user",
      event_id: id, source_ref: source.event_id, trap_id: source.trap_id, revision: source.revision, feedback: feedback as TrapFeedback, note: null });
    if (!result.success) throw new Error(result.warning || "Feedback could not be recorded.");
    return { event_id: id, duplicate: result.duplicates > 0 };
    }).value;
  }

  get(id: string) {
    const draft = this.read(id);
    const commit = this.store.revisionCommit(id, this.owner, draft.source.scope);
    const current = this.store.getDetails(draft.source.trap_id, draft.source.scope)?.trap ?? null;
    return { draft, commit, current, status: commit?.status ?? draft.status,
      base_current: Boolean(current && trapRevisionHash(current) === draft.base_hash),
      activity: commit ? this.activity(draft.source, commit.after.updated_at) : null };
  }

  list(scope: ExperienceScope, trapId: number) {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir).filter((name) => /^rev-[a-zA-Z0-9_-]{8,64}\.json$/.test(name)).map((name) => this.read(name.slice(0, -5)))
      .filter((draft) => draft.source.scope === scope && draft.source.trap_id === trapId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50).map((draft) => {
        const commit = this.store.revisionCommit(draft.id, this.owner, scope);
        return { id: draft.id, title: draft.fields.title, created_at: draft.created_at, status: commit?.status ?? draft.status, source: draft.source };
      });
  }

  save(id: string, eventId: string, input: Record<string, unknown>, expectedDigest?: string) {
    return this.lock(id, () => {
      let draft: RevisionDraft;
      let previousDigest: string | undefined;
      if (existsSync(this.path(id))) {
        draft = this.read(id);
        this.editable(draft);
        if (draft.source.event_id !== eventId) throw new Error("The draft changed. Reload it before saving.");
        previousDigest = draft.digest;
      } else {
        const { source, source_type, current } = this.context(eventId);
        if (source_type !== "trap/feedback-recorded") throw new Error("Record feedback before drafting a revision.");
        if (!current || current.status !== "active" || current.graduated_at) throw new Error("Only a current active lesson can be revised.");
        const corpus = this.store.list({ status: "active", limit: 501 }).flatMap((group) => {
          if (group.traps.length > 500) throw new Error("This first revision evaluator supports at most 500 active lessons per scope.");
          return group.traps.map((trap) => ({ scope: group.scope as ExperienceScope, id: trap.id, revision: `${group.scope}:${trap.updated_at}`, trap: revisionInput(trap) }));
        });
        draft = { version: 1, id, owner: this.owner, source, base: current, base_hash: trapRevisionHash(current), fields: revisionFields(current),
          corpus, reason: "", cases: [], digest: "", evaluation: null, status: "draft", created_at: new Date().toISOString() };
      }
      draft.fields = { title: text(input.title, "title", 240), context: text(input.context, "context", 6000),
        mistake: text(input.mistake, "mistake", 6000), fix: text(input.fix, "fix", 12000), tags: tags(input.tags) };
      draft.reason = text(input.reason, "reason", 2000);
      draft.cases = cases(input.cases);
      const digest = draftRevisionDigest(draft);
      // Retrying an identical save after a lost response is safe; a stale edit is not.
      if (previousDigest && previousDigest !== expectedDigest && digest !== previousDigest) throw new Error("The draft changed. Reload it before saving.");
      if (digest !== draft.digest) draft.evaluation = null;
      draft.digest = digest;
      this.write(draft);
      return this.get(id);
    });
  }

  async evaluate(id: string, expectedDigest: string) {
    const draft = this.read(id);
    this.editable(draft);
    if (draft.digest !== expectedDigest) throw new Error("The draft changed before evaluation.");
    if (!draft.cases.some((c) => c.expectation === "include") || !draft.cases.some((c) => c.expectation === "exclude")) throw new Error("Add at least one positive query and one negative query.");
    const targetIndex = draft.corpus.findIndex((entry) => entry.id === draft.source.trap_id && entry.scope === draft.source.scope);
    if (targetIndex < 0) throw new Error("The selected lesson is absent from the frozen corpus.");
    const fixture: EvalFixture = { traps: draft.corpus.map((entry) => entry.trap), queries: draft.cases.map((c) => ({
      query: c.query, mode: "fts", phaseGate: "dogfood", goldTrapIds: [targetIndex + 1], minRecallAt5: 1,
    })) };
    const baseline = await evaluateSearchFixtureCases(fixture, undefined);
    const revised: EvalFixture = { ...fixture, traps: fixture.traps.map((trap, i) => i === targetIndex ? { ...trap, ...draft.fields } : trap) };
    const candidate = await evaluateSearchFixtureCases(revised, undefined);
    const results = draft.cases.map((item, i) => {
      const before = baseline.cases[i]!;
      const after = candidate.cases[i]!;
      const expected = item.expectation === "include";
      return { ...item, baseline: !before.error && before.topResults.some((r) => r.id === targetIndex + 1) === expected,
        candidate: !after.error && after.topResults.some((r) => r.id === targetIndex + 1) === expected, error: after.error || before.error || null };
    });
    return this.lock(id, () => {
      const latest = this.read(id);
      this.editable(latest);
      if (latest.digest !== draft.digest) throw new Error("The draft changed during evaluation. Test the latest content again.");
      latest.evaluation = { digest: draft.digest, corpus_hash: revisionHash(draft.corpus), evaluated_at: new Date().toISOString(),
        passed: results.every((r) => r.candidate && !r.error), cases: results };
      this.write(latest);
      return this.get(id);
    });
  }

  accept(id: string, expectedDigest: string) {
    return this.lock(id, () => {
      const draft = this.read(id);
      if (draft.digest !== expectedDigest || draft.status !== "draft") throw new Error("This review no longer matches the saved draft.");
      if (!draft.evaluation?.passed || draft.evaluation.digest !== draft.digest) throw new Error("All positive and negative checks must pass for this exact draft before acceptance.");
      if (revisionHash(revisionFields(draft.base)) === revisionHash(draft.fields)) throw new Error("The proposed lesson is unchanged.");
      this.store.acceptRevision(draft);
      return this.get(id);
    });
  }
  reject(id: string, expectedDigest: string) {
    return this.lock(id, () => {
      const draft = this.read(id);
      this.editable(draft);
      if (draft.digest !== expectedDigest) throw new Error("The draft changed before rejection.");
      draft.status = "rejected";
      this.write(draft);
      return this.get(id);
    });
  }
  rollback(id: string, expectedDigest: string) {
    return this.lock(id, () => {
      const draft = this.read(id);
      if (draft.digest !== expectedDigest) throw new Error("The revision changed before rollback.");
      this.store.rollbackRevision(id, this.owner, draft.source.scope);
      return this.get(id);
    });
  }
  private activity(source: RevisionSource, after: string) {
    try {
    const ledger = openObservationLedgerReadOnly(this.project);
    if (!ledger) return { availability: "not_configured", runs: [] };
    try {
      const revision = `${source.scope}:${after}`;
      const matching = ledger.lessonRevisionEvents(source.trap_id, revision);
      const ratings = foldObservationFeedback(matching).current;
      return { availability: "ready", runs: [...new Set(matching.map((e) => e.run_id).filter(Boolean))].slice(-20).map((id) => ({
        id, exposures: matching.filter((e) => e.run_id === id && e.type === "trap/exposed").length,
        feedback: ratings.find((e) => e.run_id === id)?.attributes.feedback ?? null,
      })) };
    } finally { ledger.close(); }
    } catch { return { availability: "unavailable", runs: [] }; }
  }
  private read(id: string): RevisionDraft {
    const draft = readJsonFile<RevisionDraft>(this.path(id), "experience revision");
    if (draft.version !== 1 || draft.id !== id || draft.owner !== this.owner || draft.digest !== draftRevisionDigest(draft)) throw new Error("Invalid or changed revision dossier.");
    return draft;
  }
  private editable(draft: RevisionDraft) {
    if (draft.status !== "draft" || this.store.revisionCommit(draft.id, this.owner, draft.source.scope)) throw new Error("This revision is finalized. Start a new revision to make further changes.");
  }
  private path(id: string) {
    if (!/^rev-[a-zA-Z0-9_-]{8,64}$/.test(id)) throw new Error("Invalid revision ID.");
    return join(this.dir, id + ".json");
  }
  private write(draft: RevisionDraft) { writeFileAtomic(this.path(draft.id), JSON.stringify(draft, null, 2) + "\n"); }
  private lock<T>(id: string, fn: () => T): T {
    this.path(id);
    mkdirSync(this.dir, { recursive: true });
    return withAdvisoryLock(join(this.dir, id + ".lock"), fn).value;
  }
}

function safeId(value: string) {
  if (!/^[a-zA-Z0-9_-]{8,72}$/.test(value)) throw new Error("Invalid request ID.");
  return value;
}
function text(value: unknown, name: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${name} must contain 1–${max} characters.`);
  return value.trim();
}
function tags(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 30) throw new Error("tags must be a list of at most 30 entries.");
  return [...new Set(value.map((v) => text(v, "tag", 80)))];
}
function cases(value: unknown): RevisionCase[] {
  if (!Array.isArray(value) || value.length > 20) throw new Error("cases must be a list of at most 20 entries.");
  return value.map((v) => {
    if (!v || (v.expectation !== "include" && v.expectation !== "exclude")) throw new Error("Each case must say include or exclude.");
    return { query: text(v.query, "query", 500), expectation: v.expectation };
  });
}
