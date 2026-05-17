import type { EmbeddingConfig } from "./embedder";

export type EmbeddingStateCounts = {
  total: number;
  fresh: number;
  stale: number;
  missing: number;
};

export type EmbeddingStateSummary = EmbeddingStateCounts & {
  provider_available: boolean;
  provider: string | null;
  model: string | null;
  dimensions: number | null;
  passage_version: number | null;
};

export type EmbeddingStatsResult = {
  project: EmbeddingStateSummary | null;
  global: EmbeddingStateSummary;
};

export type HybridFallbackReason = "semantic_unavailable" | "semantic_no_candidates";

export function summarizeEmbeddingState(
  counts: EmbeddingStateCounts,
  config: EmbeddingConfig | null
): EmbeddingStateSummary {
  return {
    ...counts,
    provider_available: config !== null,
    provider: config?.provider ?? null,
    model: config?.model ?? null,
    dimensions: config?.dimensions ?? null,
    passage_version: config?.passageVersion ?? null,
  };
}

export function hybridFallbackReason(
  providerAvailable: boolean,
  embeddings: EmbeddingStatsResult
): HybridFallbackReason | null {
  if (!providerAvailable) return "semantic_unavailable";

  const fresh = (embeddings.project?.fresh ?? 0) + embeddings.global.fresh;
  const total = (embeddings.project?.total ?? 0) + embeddings.global.total;
  if (total > 0 && fresh === 0) return "semantic_no_candidates";
  return null;
}
