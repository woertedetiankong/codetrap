import type { Trap } from "../domain/trap";
import {
  embeddingConfig,
  embeddingProfileId,
  type EmbeddingConfig,
  type EmbeddingProvider,
  type StoredEmbedding,
} from "./embedder";
import { buildTrapPassage, hashTrapPassage } from "./trap-search-document";

export interface EmbeddingJobOptions {
  scope?: string;
  category?: string;
  limit?: number;
  force?: boolean;
  batchSize?: number;
}

export interface EmbeddingJobResult {
  generated: number;
  skipped: number;
  batches: number;
}

export interface EmbeddingJobAdapter {
  countEmbeddable(opts: { scope?: string; category?: string }): number;
  trapsNeedingEmbeddings(config: EmbeddingConfig, opts: EmbeddingJobOptions): Trap[];
  saveEmbedding(record: StoredEmbedding): void;
}

const DEFAULT_BATCH_SIZE = 16;

export async function runEmbeddingJob(
  adapter: EmbeddingJobAdapter,
  provider: EmbeddingProvider,
  opts: EmbeddingJobOptions = {}
): Promise<EmbeddingJobResult> {
  const config = embeddingConfig(provider);
  const profileId = embeddingProfileId(config);
  const total = adapter.countEmbeddable({ scope: opts.scope, category: opts.category });
  const traps = adapter.trapsNeedingEmbeddings(config, opts);
  if (traps.length === 0) return { generated: 0, skipped: total, batches: 0 };

  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;
  let batches = 0;

  for (let start = 0; start < traps.length; start += batchSize) {
    const batch = traps.slice(start, start + batchSize);
    const passages = batch.map(buildTrapPassage);
    const embeddings = await provider.embed(passages, "retrieval.passage");
    if (embeddings.length !== batch.length) {
      throw new Error(`Embedding provider returned ${embeddings.length} vectors for ${batch.length} traps.`);
    }

    for (let i = 0; i < batch.length; i++) {
      adapter.saveEmbedding({
        trap_id: batch[i].id,
        profile_id: profileId,
        provider: config.provider,
        model: config.model,
        dimensions: config.dimensions,
        passage_version: config.passageVersion,
        passage_hash: hashTrapPassage(passages[i]),
        embedding: embeddings[i],
      });
    }
    batches++;
  }

  return { generated: traps.length, skipped: Math.max(0, total - traps.length), batches };
}
