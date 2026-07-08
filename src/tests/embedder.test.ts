import { afterEach, describe, expect, test } from "bun:test";
import {
  cosineSimilarity,
  EmbeddingDimensionMismatchError,
  JinaEmbedder,
} from "../lib/embedder";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("JinaEmbedder dimension validation (M11)", () => {
  test("requests its configured dimensions and accepts matching vectors", async () => {
    let capturedBody: Record<string, unknown> = {};
    globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ data: [{ index: 0, embedding: new Array(1024).fill(0.1) }] }));
    }) as unknown as typeof fetch;

    const embedder = new JinaEmbedder("test-key");
    const [vector] = await embedder.embed(["query"], "retrieval.query");

    expect(capturedBody.dimensions).toBe(1024);
    expect(vector).toHaveLength(1024);
  });

  test("rejects a response whose vector length does not match the declared dimensions", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ data: [{ index: 0, embedding: [1, 2, 3] }] }))) as unknown as typeof fetch;

    const embedder = new JinaEmbedder("test-key");
    await expect(embedder.embed(["query"], "retrieval.query")).rejects.toThrow(
      "Jina embeddings returned 3 dimensions, expected 1024."
    );
  });
});

describe("cosineSimilarity (M11)", () => {
  test("throws on a dimension mismatch instead of silently returning 0", () => {
    expect(() => cosineSimilarity(new Float32Array([1, 0]), new Float32Array([1, 0, 0]))).toThrow(
      EmbeddingDimensionMismatchError
    );
  });

  test("returns 0 for a zero vector of matching length", () => {
    expect(cosineSimilarity(new Float32Array([0, 0, 0]), new Float32Array([1, 1, 1]))).toBe(0);
  });

  test("computes similarity for aligned vectors", () => {
    expect(cosineSimilarity(new Float32Array([1, 0]), new Float32Array([1, 0]))).toBeCloseTo(1);
  });
});
