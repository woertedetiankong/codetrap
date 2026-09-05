import { revisionFields } from "../domain/experience-revision";
import type { ExperienceRevisions } from "../lib/experience-revisions";

// Frozen corpora and other lessons never cross this API boundary.
export function revisionView(value: ReturnType<ExperienceRevisions["get"]>) {
  const { draft, commit, current } = value;
  return { id: draft.id, source: draft.source, base: revisionFields(draft.base), fields: draft.fields,
    reason: draft.reason, cases: draft.cases, digest: draft.digest, evaluation: draft.evaluation,
    corpus_count: draft.corpus.length, created_at: draft.created_at, status: value.status,
    base_current: value.base_current, current: current ? revisionFields(current) : null,
    commit: commit ? { accepted_at: commit.accepted_at, rolled_back_at: commit.rolled_back_at,
      revision: `${commit.scope}:${commit.after.updated_at}`, rollback_revision: commit.rollback_revision } : null,
    activity: value.activity };
}
export function revisionContext(value: ReturnType<ExperienceRevisions["context"]>) {
  return { ...value, current: value.current ? revisionFields(value.current) : null,
    editable: Boolean(value.current?.status === "active" && !value.current.graduated_at) };
}
export type RevisionView = ReturnType<typeof revisionView>;
export type RevisionContext = ReturnType<typeof revisionContext>;
export type RevisionList = ReturnType<ExperienceRevisions["list"]>;
