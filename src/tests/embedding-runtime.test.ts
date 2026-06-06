import { describe, expect, test } from "bun:test";
import type { EmbeddingProvider, EmbeddingTask } from "../lib/embedder";
import { EmbeddingProviderUnavailableError } from "../lib/embedder";
import { EmbeddingRuntime, defaultEmbeddingRuntime } from "../lib/embedding-runtime";

class RuntimeTestEmbedder implements EmbeddingProvider {
  readonly provider = "runtime-test";
  readonly model = "runtime-test-model";
  readonly dimensions = 3;

  async embed(texts: string[], _task: EmbeddingTask): Promise<Float32Array[]> {
    return texts.map(() => new Float32Array([1, 0, 0]));
  }
}

describe("embedding runtime", () => {
  test("summarizes an available provider behind one interface", () => {
    const runtime = new EmbeddingRuntime(new RuntimeTestEmbedder());

    expect(runtime.available()).toBe(true);
    expect(runtime.config()).toMatchObject({
      provider: "runtime-test",
      model: "runtime-test-model",
      dimensions: 3,
    });
    expect(runtime.status()).toMatchObject({
      available: true,
      provider: "runtime-test",
      setup_action: null,
    });
  });

  test("owns unavailable provider errors and setup action", () => {
    const runtime = new EmbeddingRuntime();

    expect(runtime.available()).toBe(false);
    expect(() => runtime.requireProvider()).toThrow(EmbeddingProviderUnavailableError);
    expect(runtime.setupAction()).toMatchObject({
      command: "export JINA_API_KEY=<your-jina-api-key>",
    });
  });

  test("creates the default Jina adapter from environment", () => {
    const runtime = defaultEmbeddingRuntime({ JINA_API_KEY: "test-key" } as NodeJS.ProcessEnv);

    expect(runtime.status()).toMatchObject({
      available: true,
      provider: "jina",
      model: "jina-embeddings-v5-text-small",
      dimensions: 1024,
    });
  });
});
