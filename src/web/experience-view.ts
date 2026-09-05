import type { LearningImpactOperations } from "../lib/learning-impact";
import { openObservationLedgerReadOnly } from "../lib/observation-ledger";
import { emptyTrapExperienceObservations, type TrapExperienceObservations } from "../lib/trap-experience";

import type { TrapExperienceWebPayload } from "./client-library-contract";
export type { TrapExperienceWebPayload } from "./client-library-contract";

/** Project-local, independently recoverable sources. Personal notes are never included. */
export function trapExperienceWebPayload(
  projectRoot: string, id: number, scope: "project" | "global", revision: string,
  learning: LearningImpactOperations, offset = 0,
): TrapExperienceWebPayload {
  let sources: TrapExperienceWebPayload["sources"];
  try { sources = { availability: "ready", insights: learning.sourcesForTrap(id, scope) }; }
  catch { sources = { availability: "unavailable", insights: [] }; }
  let observations: TrapExperienceObservations;
  try {
    const ledger = openObservationLedgerReadOnly(projectRoot);
    try { observations = ledger?.trapExperience(id, scope, revision, offset) ?? emptyTrapExperienceObservations("not_configured", offset); }
    finally { ledger?.close(); }
  } catch { observations = emptyTrapExperienceObservations("unavailable", offset); }
  return { project_root: projectRoot, trap: { id, scope }, sources, observations };
}
