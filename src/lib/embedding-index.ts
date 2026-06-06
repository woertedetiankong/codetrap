import type { Database } from "bun:sqlite";
import * as embeddingQueries from "../db/embedding-queries";
import type { Trap } from "../domain/trap";
import type { TrapStatus } from "./constants";
import type {
  EmbeddingConfig,
  FreshEmbedding,
  StoredEmbedding,
} from "./embedder";
import type { EmbeddingStateCounts } from "./embedding-health";
import type { EmbeddingProfileSummary } from "../db/embedding-queries";

export type EmbeddingIndexFilter = {
  scope?: string;
  category?: string;
  status?: TrapStatus | "all";
};

export type EmbeddingRefreshFilter = EmbeddingIndexFilter & {
  force?: boolean;
  limit?: number;
};

export class DatabaseEmbeddingIndex {
  constructor(private readonly db: Database) {}

  get(trapId: number, config?: EmbeddingConfig): StoredEmbedding | null {
    return embeddingQueries.getEmbedding(this.db, trapId, config);
  }

  save(record: StoredEmbedding): void {
    embeddingQueries.upsertEmbedding(this.db, record);
  }

  delete(trapId: number): void {
    embeddingQueries.deleteEmbedding(this.db, trapId);
  }

  freshEmbeddings(config: EmbeddingConfig, filter: EmbeddingIndexFilter = {}): FreshEmbedding[] {
    return embeddingQueries.getAllFreshEmbeddings(this.db, config, filter);
  }

  trapsNeedingEmbeddings(config: EmbeddingConfig, filter: EmbeddingRefreshFilter = {}): Trap[] {
    return embeddingQueries.getTrapsNeedingEmbeddings(this.db, config, filter);
  }

  countEmbeddable(filter: EmbeddingIndexFilter = {}): number {
    return embeddingQueries.countEmbeddableTraps(this.db, filter);
  }

  stateCounts(config: EmbeddingConfig | null, filter: EmbeddingIndexFilter = {}): EmbeddingStateCounts {
    return embeddingQueries.getEmbeddingStateCounts(this.db, config, filter);
  }

  profiles(filter: EmbeddingIndexFilter = {}): EmbeddingProfileSummary[] {
    return embeddingQueries.listEmbeddingProfiles(this.db, filter);
  }
}
