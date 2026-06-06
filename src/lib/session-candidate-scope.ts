import type { CandidateTrap } from "../domain/session";
import type { Scope } from "./constants";

export function candidateAcceptedScope(candidate: CandidateTrap): Scope {
  return candidate.accepted_scope ?? (candidate.trap.scope === "global" ? "global" : "project");
}
