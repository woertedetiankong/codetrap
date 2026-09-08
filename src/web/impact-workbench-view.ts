import type { GovernedEvalOperations } from "../lib/governed-eval-operations";
import { ExperienceRevisions } from "../lib/experience-revisions";
import { openObservationLedgerReadOnly } from "../lib/observation-ledger";
import { foldObservationFeedback, observationTrapScope } from "../lib/observation-feedback";
import type { TrapExposurePayload, TrapFeedbackPayload } from "../domain/observation";

export interface ImpactIssue {
  id: string; event_id: string; run_id: string; scope: "project" | "global" | null; trap_id: number | null;
  candidate_id?: string; revision: string | null; title: string | null; kind: "feedback" | "miss"; occurred_at: string;
  sources: Array<{ event_id: string; run_id: string; feedback: string }>;
}
export function impactWorkbenchWebPayload(projectRoot: string, home?: string, governed?: GovernedEvalOperations) {
  const revisions = new ExperienceRevisions(projectRoot, home).workbench();
  const issues: ImpactIssue[] = [];
  let availability: "ready" | "not_configured" | "unavailable" = "not_configured";
  let pending: { event_id: string; run_id: string } | null = null;
  let pending_run_ids: string[] = [];
  try {
    const ledger = openObservationLedgerReadOnly(projectRoot);
    if (ledger) {
      try {
        availability = "ready";
        const events = ledger.reviewEvidence(), ratings = foldObservationFeedback(events).current;
        const identities = new Set(ratings.map(e => JSON.stringify([e.run_id, observationTrapScope(e.attributes.revision), e.attributes.trap_id])));
        const unreviewedEvents = [...events].reverse().filter(e => e.run_id && e.type === "trap/exposed"
          && observationTrapScope((e.attributes as TrapExposurePayload).revision)
          && !identities.has(JSON.stringify([e.run_id, observationTrapScope((e.attributes as TrapExposurePayload).revision), (e.attributes as TrapExposurePayload).trap_id])));
        const unreviewed = unreviewedEvents[0];
        pending_run_ids = [...new Set(unreviewedEvents.map(e => e.run_id!))];
        if (unreviewed?.run_id) pending = { event_id: unreviewed.id, run_id: unreviewed.run_id };
        const signals = ledger.evals();
        const closedSignals = new Set<string>();
        if (governed) for (const group of signals.candidate_groups) {
          const reviewed = group.member_ids.map(id => ({id,status:governed.reviewState(id).review_status})).find(r=>r.status!=="review_required");
          if (reviewed && ["accepted","rejected"].includes(reviewed.status)) for(const id of group.member_ids) closedSignals.add(id);
        }
        const groups = new Map<string, ImpactIssue>();
        for (const event of ratings) {
          const v = event.attributes, scope = observationTrapScope(v.revision);
          if (!event.run_id || !scope || !v.trap_id || !v.revision || !["irrelevant", "harmful"].includes(v.feedback)) continue;
          const key = JSON.stringify([scope, v.trap_id, v.revision]);
          if (revisions.items.some(r => r.source.scope === scope && r.source.trap_id === v.trap_id && r.source.revision === v.revision && !["rejected", "rolled_back"].includes(r.status))) continue;
          let issue = groups.get(key);
          if (!issue) {
            let title: string | null = null;
            try { const c = new ExperienceRevisions(projectRoot, home).context(event.id); if (c.same_revision) title = c.current?.title ?? null; } catch { /* Historical content can be unavailable. */ }
            issue = { id: "event:" + event.id, event_id: event.id, run_id: event.run_id, scope, trap_id: v.trap_id,
              revision: v.revision, title, kind: "feedback", occurred_at: event.occurred_at, sources: [] };
            groups.set(key, issue);
          }
          if(event.occurred_at>issue.occurred_at)issue.occurred_at=event.occurred_at;
          issue.sources.push({ event_id: event.id, run_id: event.run_id, feedback: v.feedback });
        }
        issues.push(...groups.values());
        for (const event of events) {
          if (!event.run_id || !(event.type === "trap/missed-reported" || event.type === "trap/feedback-recorded" && (event.attributes as TrapFeedbackPayload).feedback === "should_have_matched")) continue;
          const candidate = signals.candidates.find(c => c.run_id===event.run_id && c.event_seq===event.seq && ["reported_miss","should_have_matched"].includes(c.reason));
          if(candidate && closedSignals.has(candidate.id))continue;
          issues.push({ candidate_id: candidate?.id, id: "miss:" + event.id, event_id: event.id, run_id: event.run_id, scope: null, trap_id: null,
            revision: null, title: null, kind: "miss", occurred_at: event.occurred_at, sources: [{ event_id: event.id, run_id: event.run_id, feedback: "should_have_matched" }] });
        }
      } finally { ledger.close(); }
    }
  } catch { availability = "unavailable"; }
  return { project_root: projectRoot, availability, revisions, issues: issues.sort((a,b) => b.occurred_at.localeCompare(a.occurred_at)), pending, pending_run_ids };
}
export type ImpactWorkbenchPayload = ReturnType<typeof impactWorkbenchWebPayload>;
