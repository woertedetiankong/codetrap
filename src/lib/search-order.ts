import type { TrapSearchResult } from "../domain/trap";

type SearchGroup = { results: TrapSearchResult[]; scope: string };

/** Flatten the transport groups in the same order shown to the agent. */
export function orderedSearchResults(groups: SearchGroup[]) {
  return groups.flatMap(({ results, scope }) => results.map(result => ({ result, scope })))
    .sort((a, b) => (a.result.position ?? Infinity) - (b.result.position ?? Infinity));
}

/** Keep scope identity without letting transport grouping change relevance order. */
export function mergeSearchGroups(groups: SearchGroup[], limit: number, comparableScores: boolean): SearchGroup[] {
  const ordered = groups.flatMap(({ results, scope }, groupIndex) =>
    results.map((result, localIndex) => ({ result, scope, groupIndex, localIndex })));
  ordered.sort((a, b) => {
    // BM25 depends on each database's corpus; hybrid fallback also changes scale.
    const difference = comparableScores
      ? (b.result.score ?? b.result.rank) - (a.result.score ?? a.result.rank)
      : a.localIndex - b.localIndex;
    return difference || a.groupIndex - b.groupIndex || a.localIndex - b.localIndex;
  });
  const selected = ordered.slice(0, Math.max(0, limit));
  return groups.flatMap(({ scope }, groupIndex) => {
    const results = selected.flatMap((entry, index) => entry.groupIndex === groupIndex
      ? [{ ...entry.result, position: index + 1 }] : []);
    return results.length ? [{ scope, results }] : [];
  });
}
