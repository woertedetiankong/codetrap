import type { Trap } from "../domain/trap";
import { PASSAGE_VERSION } from "./trap-search-document";

export type EmbeddingTask = "retrieval.query" | "retrieval.passage";

export interface EmbeddingProvider {
  provider: string;
  model: string;
  dimensions: number;
  embed(texts: string[], task: EmbeddingTask): Promise<Float32Array[]>;
}

export interface EmbeddingConfig {
  provider: string;
  model: string;
  dimensions: number;
  passageVersion: number;
}

export interface StoredEmbedding {
  trap_id: number;
  provider: string;
  model: string;
  dimensions: number;
  passage_version: number;
  passage_hash: string;
  embedding: Float32Array;
  updated_at?: string;
}

export interface FreshEmbedding {
  trap: Trap;
  embedding: Float32Array;
}

export class EmbeddingProviderUnavailableError extends Error {
  constructor(message = "Embedding provider is unavailable. Set JINA_API_KEY or use --mode fts.") {
    super(message);
    this.name = "EmbeddingProviderUnavailableError";
  }
}

export class JinaEmbedder implements EmbeddingProvider {
  readonly provider = "jina";
  readonly model = "jina-embeddings-v5-text-small";
  readonly dimensions = 1024;

  constructor(
    private readonly apiKey: string,
    private readonly baseURL = "https://api.jina.ai/v1"
  ) {}

  async embed(texts: string[], task: EmbeddingTask): Promise<Float32Array[]> {
    if (texts.length === 0) return [];

    const response = await fetch(`${this.baseURL}/embeddings`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        task,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Jina embeddings request failed (${response.status}): ${body}`);
    }

    const payload = (await response.json()) as {
      data?: { embedding?: number[]; index?: number }[];
    };
    const rows = payload.data ?? [];
    if (rows.length !== texts.length) {
      throw new Error(`Jina embeddings returned ${rows.length} vectors for ${texts.length} inputs.`);
    }

    return rows
      .slice()
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((row) => {
        if (!Array.isArray(row.embedding)) {
          throw new Error("Jina embeddings response is missing an embedding vector.");
        }
        return Float32Array.from(row.embedding);
      });
  }
}

export function embeddingConfig(provider: EmbeddingProvider): EmbeddingConfig {
  return {
    provider: provider.provider,
    model: provider.model,
    dimensions: provider.dimensions,
    passageVersion: PASSAGE_VERSION,
  };
}

export function encodeEmbedding(embedding: Float32Array): Buffer {
  return Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);
}

export function decodeEmbedding(blob: Uint8Array | ArrayBuffer): Float32Array {
  const bytes = blob instanceof Uint8Array ? blob : new Uint8Array(blob);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Float32Array(copy.buffer);
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
