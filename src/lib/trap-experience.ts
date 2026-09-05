import type { ObservationEvent, RunObservationProjection, TrapExposurePayload, TrapFeedbackPayload } from "../domain/observation";
import { foldObservationFeedback } from "./observation-feedback";

import type { TrapExperienceObservations } from "../domain/trap-experience";
export type { TrapExperienceRun, TrapExperienceObservations } from "../domain/trap-experience";

export function emptyTrapExperienceObservations(
  availability: TrapExperienceObservations["availability"], offset = 0, limit = 20,
): TrapExperienceObservations {
  return { availability, exposure_count: 0, current_revision_exposures: 0, other_revision_exposures: 0,
    run_count: 0, helpful: 0, irrelevant: 0, harmful: 0, miss_reports: 0, superseded_feedback: 0,
    runs: [], offset, limit, has_more: false };
}

/** Input is already restricted to the exact (project, scope, trap ID). */
export function projectTrapExperience(
  events: ObservationEvent[], currentRevision: string,
  readRun: (id: string) => RunObservationProjection | null,
  offset = 0, limit = 20,
): TrapExperienceObservations {
  const summary = emptyTrapExperienceObservations("ready", offset, limit);
  const byRun = new Map<string, ObservationEvent[]>();
  for (const event of events) {
    if (event.run_id !== null) {
      const entries = byRun.get(event.run_id) ?? [];
      entries.push(event);
      byRun.set(event.run_id, entries);
    }
    if (event.type === "trap/exposed") {
      summary.exposure_count += 1;
      if ((event.attributes as TrapExposurePayload).revision === currentRevision) summary.current_revision_exposures += 1;
      else summary.other_revision_exposures += 1;
    }
    if (event.type === "trap/feedback-recorded" && (event.attributes as TrapFeedbackPayload).feedback === "should_have_matched") summary.miss_reports += 1;
  }
  const folded = foldObservationFeedback(events);
  for (const event of folded.current) {
    const feedback = event.attributes.feedback;
    if (feedback !== "should_have_matched") summary[feedback] += 1;
  }
  summary.superseded_feedback = folded.superseded;
  summary.run_count = byRun.size;
  // recorded_at reflects when the ledger received evidence; timestamps supplied
  // by clients need not be synchronized. Tie-breaking keeps pages deterministic.
  const ordered = [...byRun.entries()].map(([id, entries]) => ({ id, entries,
    last: entries.reduce((last, event) => event.recorded_at > last ? event.recorded_at : last, "")
  })).sort((a, b) => b.last.localeCompare(a.last) || a.id.localeCompare(b.id));
  summary.runs = ordered.slice(offset, offset + limit).map(({ id, entries }) => {
    const run = readRun(id);
    const exposures = entries.filter((event) => event.type === "trap/exposed");
    const current = exposures.filter((event) => (event.attributes as TrapExposurePayload).revision === currentRevision).length;
    return {
      id, source_client: run?.source_client ?? null, started_at: run?.started_at ?? null,
      status: run?.status ?? null, completeness: run?.completeness ?? "unknown",
      latest_validation_status: run?.latest_validation_status ?? null,
      exposure_count: exposures.length, current_revision_exposures: current,
      other_revision_exposures: exposures.length - current,
      feedback: foldObservationFeedback(entries).current[0]?.attributes.feedback ?? null,
      miss_reports: entries.filter((event) => event.type === "trap/feedback-recorded" && (event.attributes as TrapFeedbackPayload).feedback === "should_have_matched").length,
    };
  });
  summary.has_more = offset + summary.runs.length < summary.run_count;
  return summary;
}
