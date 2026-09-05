import type { ObservationEvent, TrapFeedbackPayload } from "../domain/observation";

/** v1 writers encode scope in revision. Unqualified historical IDs stay unknown. */
export function observationTrapScope(revision: unknown): "project" | "global" | null {
  if (typeof revision !== "string") return null;
  if (revision.startsWith("project:")) return "project";
  if (revision.startsWith("global:")) return "global";
  return null;
}

/** Keep corrections within one Run and scoped trap; preserve the event history. */
export function foldObservationFeedback(events: ObservationEvent[]): {
  current: ObservationEvent<"trap/feedback-recorded">[];
  ratedExposures: number;
  superseded: number;
} {
  const ratings = new Map<string, ObservationEvent<"trap/feedback-recorded">>();
  const standalone: ObservationEvent<"trap/feedback-recorded">[] = [];
  let superseded = 0;
  const feedbackEvents = events.filter((event): event is ObservationEvent<"trap/feedback-recorded"> =>
    event.type === "trap/feedback-recorded"
  ).sort((a, b) => a.seq - b.seq || a.occurred_at.localeCompare(b.occurred_at) || a.id.localeCompare(b.id));
  for (const event of feedbackEvents) {
    const value: TrapFeedbackPayload = event.attributes;
    if (value.feedback === "should_have_matched") continue;
    if (event.run_id === null || value.trap_id === null) {
      standalone.push(event);
      continue;
    }
    // A revision update does not create a different trap. Scope does.
    const key = JSON.stringify([event.run_id, observationTrapScope(value.revision), value.trap_id]);
    if (ratings.has(key)) superseded += 1;
    ratings.set(key, event);
  }
  return { current: [...ratings.values(), ...standalone], ratedExposures: ratings.size, superseded };
}
