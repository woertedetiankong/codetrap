import type { TrapActionCard, TrapSearchResult } from "../domain/trap";
import type { Scope } from "./constants";
import { orderedSearchResults } from "./search-order";

const MAX_CARD_FIELD_LENGTH = 220;

export function toTrapActionCard(result: TrapSearchResult, scope: Scope): TrapActionCard {
  const trap = result.trap;
  return {
    trap_id: trap.id,
    scope,
    title: trap.title,
    why_relevant: compact(trap.context),
    avoid: compact(trap.mistake),
    do_instead: compact(trap.fix),
    severity: trap.severity,
    score: result.score ?? null,
    sources: result.sources ?? [],
    ...(result.diagnostics ? { diagnostics: result.diagnostics } : {}),
    ...(result.ranking_signals ? { ranking_signals: result.ranking_signals } : {}),
  };
}

export function toTrapActionCards(groups: { results: TrapSearchResult[]; scope: string }[]): TrapActionCard[] {
  return orderedSearchResults(groups).map(({ result, scope }) => toTrapActionCard(result, scope as Scope));
}

function compact(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_CARD_FIELD_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_CARD_FIELD_LENGTH - 3).trimEnd()}...`;
}
