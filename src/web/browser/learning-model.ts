import type { LearningImpactState } from "../../domain/learning-impact";
import { draftFields, draftPayload, learningKey, parseCreation, parseImpact, parsePreview, type LearningFields, type LearningTarget } from "./learning-data";

interface Draft<T> { value: T; version: number }
interface Entry { practice?: Draft<string>; proposal?: Draft<LearningFields>; error: string; validatedVersion?: number }
type Action = "practice" | "status" | "feedback" | "run" | "begin" | "preview" | "create";
export function createLearningModel(deps: {
  api(path: string, options?: RequestInit): Promise<unknown>;
  blocked(): boolean;
  changed(target: LearningTarget, part: "draft" | "render" | "busy"): void;
  applyImpact(target: LearningTarget, impact: LearningImpactState): void;
  created(target: LearningTarget, result: ReturnType<typeof parseCreation>): Promise<void>;
  notify(key: string, target: LearningTarget, error?: boolean): void;
}) {
  const entries = new Map<string, Entry>();
  let operation: { target: LearningTarget; action: Action } | null = null, version = 0, revision = 0;
  const entry = (target: LearningTarget): Entry => {
    const key = learningKey(target); let value = entries.get(key);
    if (!value) { value = { error: "" }; entries.set(key, value); } return value;
  };
  function editPractice(target: LearningTarget, value: string, saved: string) {
    const e = entry(target);
    const pending = operation?.action === "practice" && learningKey(operation.target) === learningKey(target);
    e.practice = value === saved && !pending ? undefined : { value, version: ++version };
    e.error = ""; deps.changed(target, "draft");
  }
  function editProposal(target: LearningTarget, fields: LearningFields) {
    const e = entry(target);
    if (e.proposal && JSON.stringify(e.proposal.value) === JSON.stringify(fields)) return;
    e.proposal = { value: { ...fields }, version: ++version }; e.error = ""; e.validatedVersion = undefined;
    deps.changed(target, "draft");
  }
  function discard(target: LearningTarget, kind: "practice" | "proposal") {
    if (operation) return;
    const e = entry(target); delete e[kind]; e.error = ""; e.validatedVersion = undefined;
    deps.changed(target, "render");
  }
  async function act(target: LearningTarget, action: Action, value?: string) {
    if (operation || deps.blocked()) return;
    const t = { ...target }, e = entry(t), practice = e.practice, proposal = e.proposal;
    if (action === "practice" && !practice || ["preview", "create"].includes(action) && !proposal || action === "begin" && proposal) return;
    operation = { target: t, action }; revision++; e.error = ""; deps.changed(t, "busy");
    try {
      const common = { projectRoot: t.project, id: t.id };
      if (["begin", "preview", "create"].includes(action)) {
        const body = { ...common, ...(proposal ? { draft: draftPayload(proposal.value) } : {}) };
        const raw = await deps.api("/api/learning/candidate/" + (action === "create" ? "create" : "preview"), { method: "POST", body: JSON.stringify(body) });
        if (action === "create") {
          const result = parseCreation(raw, t);
          if (e.proposal === proposal) { e.proposal = undefined; e.validatedVersion = undefined; }
          revision++;
          await deps.created(t, result);
        } else {
          const normalized = parsePreview(raw, t);
          // Keep raw field text while checking it; validation must not reformat
          // tags/path rules or erase newer typing while the request was pending.
          if (e.proposal === proposal) {
            if (!proposal) e.proposal = { value: draftFields(normalized), version: ++version };
            e.validatedVersion = e.proposal!.version;
          }
        }
      } else {
        const paths = { practice: "practice-note", status: "progress/status", feedback: "feedback", run: "run-link" };
        const key = action as keyof typeof paths;
        const update = action === "practice" ? { practiceNote: practice!.value || null }
          : action === "status" ? { status: value } : action === "feedback" ? { feedback: value } : { linkedRunId: value || null };
        const raw = await deps.api("/api/learning/" + paths[key], { method: "POST", body: JSON.stringify({ ...common, ...update }) });
        const impact = parseImpact(raw, t);
        if (action === "practice" && e.practice === practice) e.practice = undefined;
        revision++; deps.applyImpact(t, impact);
      }
      const messages: Record<Action, string> = { practice: "experience.practiceSaved", status: "status.learningProgressUpdated", feedback: "status.learningFeedbackUpdated", run: "status.learningRunUpdated", begin: "learningFlow.draftReady", preview: "status.agentCandidatePreviewed", create: "status.agentCandidateCreated" };
      deps.notify(action === "preview" && e.proposal && e.validatedVersion !== e.proposal.version ? "learningFlow.earlierValidated" : messages[action], t);
    } catch (error) {
      e.error = error instanceof Error ? error.message : "";
      deps.notify("learningFlow.actionFailed", t, true);
    } finally { operation = null; revision++; deps.changed(t, "render"); deps.changed(t, "busy"); }
  }
  return { entry: (target: LearningTarget) => entries.get(learningKey(target)), editPractice, editProposal, discard, act,
    get busy() { return Boolean(operation); }, get operation() { return operation; }, get revision() { return revision; },
    hasDrafts: () => [...entries.values()].some(e => Boolean(e.practice || e.proposal)),
  };
}
