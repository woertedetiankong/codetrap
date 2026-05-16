import type { TrapActionCard, TrapSearchResult } from "../domain/trap";
import type { Scope } from "./constants";

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
    next_action: {
      details_tool: "get_trap",
      details_args: {
        id: trap.id,
        scope,
      },
    },
  };
}

export function toTrapActionCards(groups: { results: TrapSearchResult[]; scope: string }[]): TrapActionCard[] {
  return groups.flatMap((group) =>
    group.results.map((result) => toTrapActionCard(result, group.scope as Scope))
  );
}

function compact(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_CARD_FIELD_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_CARD_FIELD_LENGTH - 3).trimEnd()}...`;
}
