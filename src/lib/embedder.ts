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
  profile_id: string;
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

const EMBED_QUERY_TIMEOUT_MS = 10_000;
const EMBED_BATCH_TIMEOUT_MS = 60_000;
const HEALTH_TIMEOUT_MS = 3_000;

function embedTimeoutMs(textCount: number): number {
  return textCount === 1 ? EMBED_QUERY_TIMEOUT_MS : EMBED_BATCH_TIMEOUT_MS;
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
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

    const timeoutMs = embedTimeoutMs(texts.length);
    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/embeddings`, {
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
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new Error(`Jina embeddings request timed out after ${timeoutMs / 1000}s.`);
      }
      throw error;
    }

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

export type OllamaEmbedderOptions = {
  endpoint?: string;
  model?: string;
  dimensions?: number;
  fetch?: FetchLike;
};

export type OllamaProviderHealth = {
  ok: boolean;
  message?: string;
  command?: string;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export const DEFAULT_OLLAMA_ENDPOINT = "http://127.0.0.1:11434";
export const DEFAULT_OLLAMA_MODEL = "qwen3-embedding:0.6b";
export const DEFAULT_OLLAMA_DIMENSIONS = 1024;

export class OllamaEmbedder implements EmbeddingProvider {
  readonly provider = "ollama";
  readonly model: string;
  readonly dimensions: number;
  private readonly endpoint: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: OllamaEmbedderOptions = {}) {
    this.endpoint = normalizeOllamaEndpoint(options.endpoint ?? DEFAULT_OLLAMA_ENDPOINT);
    this.model = options.model ?? DEFAULT_OLLAMA_MODEL;
    this.dimensions = options.dimensions ?? DEFAULT_OLLAMA_DIMENSIONS;
    this.fetchImpl = options.fetch ?? fetch;
  }

  async embed(texts: string[], _task: EmbeddingTask): Promise<Float32Array[]> {
    if (texts.length === 0) return [];

    const timeoutMs = embedTimeoutMs(texts.length);
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.endpoint}/api/embed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          input: texts,
          dimensions: this.dimensions,
          truncate: true,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new Error(`Ollama embeddings request timed out after ${timeoutMs / 1000}s at ${this.endpoint}.`);
      }
      throw error;
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama embeddings request failed (${response.status}): ${body}`);
    }

    const payload = (await response.json()) as {
      embeddings?: number[][];
    };
    const rows = payload.embeddings ?? [];
    if (rows.length !== texts.length) {
      throw new Error(`Ollama embeddings returned ${rows.length} vectors for ${texts.length} inputs.`);
    }

    return rows.map((embedding) => {
      if (!Array.isArray(embedding)) {
        throw new Error("Ollama embeddings response is missing an embedding vector.");
      }
      if (embedding.length !== this.dimensions) {
        throw new Error(
          `Ollama embeddings returned ${embedding.length} dimensions, expected ${this.dimensions}.`
        );
      }
      return Float32Array.from(embedding);
    });
  }

  async health(): Promise<OllamaProviderHealth> {
    try {
      const response = await this.fetchImpl(`${this.endpoint}/api/tags`, {
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });
      if (!response.ok) {
        return {
          ok: false,
          message: `Ollama is not reachable at ${this.endpoint} (${response.status}).`,
          command: "ollama list",
        };
      }

      const payload = (await response.json()) as {
        models?: { name?: string; model?: string }[];
      };
      const models = payload.models ?? [];
      const installed = models.some((model) => model.name === this.model || model.model === this.model);
      if (!installed) {
        return {
          ok: false,
          message: `Ollama model ${this.model} is not installed.`,
          command: `ollama pull ${this.model}`,
        };
      }

      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        message: `Ollama is not reachable at ${this.endpoint}: ${message}`,
        command: "ollama list",
      };
    }
  }
}

function normalizeOllamaEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, "");
}

export function embeddingConfig(provider: EmbeddingProvider): EmbeddingConfig {
  return {
    provider: provider.provider,
    model: provider.model,
    dimensions: provider.dimensions,
    passageVersion: PASSAGE_VERSION,
  };
}

export function embeddingProfileId(config: EmbeddingConfig): string {
  return `${config.provider}:${config.model}:${config.dimensions}:p${config.passageVersion}`;
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
