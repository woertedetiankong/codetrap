import { embeddingProfileId, type EmbeddingConfig } from "./embedder";

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
  profile_id: string | null;
};

export type EmbeddingStatsResult = {
  project: EmbeddingStateSummary | null;
  global: EmbeddingStateSummary | null;
};

export type HybridFallbackReason = "semantic_unavailable" | "semantic_no_candidates";

export function summarizeEmbeddingState(
  counts: EmbeddingStateCounts,
  config: EmbeddingConfig | null,
  // L12: whether the provider can actually embed (e.g. Jina has an API key,
  // Ollama adapter is constructed). A configured-but-keyless Jina yields a
  // non-null config yet must report provider_available: false, matching the
  // doctor's semantic_available. Defaults to config presence for callers that
  // don't know runtime availability.
  providerAvailable: boolean = config !== null
): EmbeddingStateSummary {
  return {
    ...counts,
    provider_available: providerAvailable,
    provider: config?.provider ?? null,
    model: config?.model ?? null,
    dimensions: config?.dimensions ?? null,
    passage_version: config?.passageVersion ?? null,
    profile_id: config ? embeddingProfileId(config) : null,
  };
}

export function hybridFallbackReason(
  providerAvailable: boolean,
  embeddings: EmbeddingStatsResult
): HybridFallbackReason | null {
  if (!providerAvailable) return "semantic_unavailable";

  const fresh = (embeddings.project?.fresh ?? 0) + (embeddings.global?.fresh ?? 0);
  const total = (embeddings.project?.total ?? 0) + (embeddings.global?.total ?? 0);
  if (total > 0 && fresh === 0) return "semantic_no_candidates";
  return null;
}
