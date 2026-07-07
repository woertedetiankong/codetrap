import type { CandidateTrap } from "../domain/session";
import type { Trap } from "../domain/trap";
import type { Scope } from "./constants";
import type { TrapOperations } from "./trap-operations";
import { parseTrapPathGlobs, parseTrapTags } from "./trap-json-fields";
import { globMatchesPath, normalizePath, trapAppliesToPath } from "./trap-scope-match";

export interface CandidateConflict {
  trap_id: number;
  scope: Scope;
  title: string;
  context: string;
  fix: string;
  reason: string;
}

export async function findCandidateConflicts(
  candidate: CandidateTrap,
  operations: TrapOperations
): Promise<CandidateConflict[]> {
  const query = conflictQuery(candidate);
  if (!query) return [];

  // Search both scopes: a project candidate can duplicate a global trap
  // (and vice versa), and accepting it with conflict_status "none" hides
  // the duplication forever.
  const { cards } = await operations.searchTrapCards({
    query,
    scope: undefined,
    status: "active",
    limit: 3,
    mode: "fts",
  });

  const conflicts: CandidateConflict[] = [];
  for (const card of cards) {
    const details = operations.getTrapDetails(card.trap_id, card.scope);
    if (!details || details.trap.status !== "active") continue;
    const reason = conflictReason(candidate, details.trap);
    if (!reason) continue;
    conflicts.push({
      trap_id: details.trap.id,
      scope: details.scope,
      title: details.trap.title,
      context: details.trap.context,
      fix: details.trap.fix,
      reason,
    });
  }
  return conflicts;
}

function conflictQuery(candidate: CandidateTrap): string {
  return [
    candidate.trap.title,
    ...(candidate.trap.tags ?? []),
    candidate.trap.module,
  ].filter(Boolean).join(" ").trim();
}

function conflictReason(candidate: CandidateTrap, existing: Trap): string | null {
  const candidateTags = candidate.trap.tags ?? [];
  const existingTags = parseTrapTags(existing.tags);
  const tagsIntersect = intersects(candidateTags, existingTags);
  const sharedTitleTokens = titleOverlap(candidate.trap.title, existing.title);

  // A bare module match fires on every trap in the module regardless of
  // topic, which trains reviewers to reflexively --accept-anyway. Require
  // topical overlap on top of the module match.
  const sameModule = Boolean(candidate.trap.module && existing.module === candidate.trap.module);
  if (sameModule && (tagsIntersect || sharedTitleTokens >= 2)) {
    return "same module and overlapping topic";
  }

  if (pathScopesOverlap(candidate, existing)) return "overlapping path scope";

  if (tagsIntersect && sharedTitleTokens >= 2) {
    return "similar title and tags";
  }

  return null;
}

function intersects(left: string[], right: string[]): boolean {
  const rightSet = new Set(right.map((value) => value.toLowerCase()));
  return left.some((value) => rightSet.has(value.toLowerCase()));
}

function pathScopesOverlap(candidate: CandidateTrap, existing: Trap): boolean {
  const candidatePaths = candidate.trap.path_globs ?? [];
  const existingPaths = parseTrapPathGlobs(existing.path_globs);
  if (candidatePaths.length === 0 || existingPaths.length === 0) return false;

  return candidatePaths.some((candidatePath) =>
    trapAppliesToPath(existing, candidatePath)
      || existingPaths.some((existingPath) => pathGlobsMayOverlap(candidatePath, existingPath))
  );
}

function pathGlobsMayOverlap(left: string, right: string): boolean {
  const normalizedLeft = normalizePath(left);
  const normalizedRight = normalizePath(right);
  return normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    || globMatchesPath(normalizedLeft, normalizedRight)
    || globMatchesPath(normalizedRight, normalizedLeft);
}

function titleOverlap(left: string, right: string): number {
  const leftTokens = new Set(tokens(left));
  return tokens(right).filter((token) => leftTokens.has(token)).length;
}

function tokens(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9_]+/g) ?? [];
}
