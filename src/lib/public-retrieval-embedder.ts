import type { EmbeddingProvider, EmbeddingTask } from "./embedder";

/**
 * Public-only deterministic category proxy.
 *
 * These categories are intentionally generic and self-contained. The public
 * benchmark must not inherit internal dogfood vocabulary because unrelated
 * substring matches would make the released score depend on private-shaped
 * project terms rather than the released dataset and method.
 */
export class PublicRetrievalEmbedder implements EmbeddingProvider {
  readonly provider = "public-benchmark";
  readonly model = "generic-category-proxy-v1";
  readonly dimensions = 7;

  async embed(texts: string[], _task: EmbeddingTask): Promise<Float32Array[]> {
    return texts.map(publicCategoryVector);
  }
}

function publicCategoryVector(text: string): Float32Array {
  const lower = text.toLowerCase();
  const vector = new Float32Array(7);
  if (/(http|https|fetch|request|api|remote|network|endpoint)/.test(lower)) vector[0] = 1;
  if (/(auth|authentication|login|session|principal|cookie)/.test(lower)) vector[1] = 1;
  if (/(db|database|sqlite|sql|migration|schema|table|record)/.test(lower)) vector[2] = 1;
  if (/(config|environment|process\.env|setting)/.test(lower)) vector[3] = 1;
  if (/(cache|redis|stale|ttl)/.test(lower)) vector[4] = 1;
  if (/(cli|flag|argument|parseargs|positionals)/.test(lower)) vector[5] = 1;
  if (vector.every((value) => value === 0)) vector[6] = 1;
  return vector;
}
