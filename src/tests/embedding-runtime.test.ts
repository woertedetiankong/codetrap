import { describe, expect, test } from "bun:test";
import type { EmbeddingProvider, EmbeddingTask } from "../lib/embedder";
import { EmbeddingProviderUnavailableError, OllamaEmbedder } from "../lib/embedder";
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
      command: "codetrap embeddings use huggingface --model default",
    });
  });

  test("creates the high-quality local Hugging Face adapter from config without Ollama", () => {
    const runtime = defaultEmbeddingRuntime({} as NodeJS.ProcessEnv, {
      embeddings: {
        provider: "huggingface",
        model: "quality",
      },
    });

    expect(runtime.status()).toMatchObject({
      available: true,
      provider: "huggingface",
      model: "onnx-community/Qwen3-Embedding-0.6B-ONNX@q8",
      dimensions: 1024,
      profile_id: "huggingface:onnx-community/Qwen3-Embedding-0.6B-ONNX@q8:1024:p1",
      setup_action: null,
    });
  });

  test("turns an invalid configured Hugging Face model into repair guidance", () => {
    const runtime = defaultEmbeddingRuntime({} as NodeJS.ProcessEnv, {
      embeddings: {
        provider: "huggingface",
        model: "removed-model-id",
      },
    });

    expect(runtime.available()).toBe(false);
    expect(runtime.setupAction()).toMatchObject({
      command: "codetrap embeddings use huggingface --model default",
    });
    expect(runtime.setupAction()?.reason).toContain("Invalid local embedding model: removed-model-id");
  });

  test("does not initialize a local model when no provider is configured", () => {
    const runtime = defaultEmbeddingRuntime({} as NodeJS.ProcessEnv, {});

    expect(runtime.available()).toBe(false);
    expect(runtime.provider()).toBeUndefined();
    expect(runtime.status().provider).toBeNull();
  });

  test("creates the default Jina adapter from environment", () => {
    const runtime = defaultEmbeddingRuntime({ JINA_API_KEY: "test-key" } as NodeJS.ProcessEnv, {});

    expect(runtime.status()).toMatchObject({
      available: true,
      provider: "jina",
      model: "jina-embeddings-v5-text-small",
      dimensions: 1024,
    });
  });

  test("creates an Ollama adapter from environment", () => {
    const runtime = defaultEmbeddingRuntime({
      CODETRAP_EMBEDDING_PROVIDER: "ollama",
      CODETRAP_OLLAMA_MODEL: "qwen3-embedding:0.6b",
      CODETRAP_OLLAMA_DIMENSIONS: "1024",
    } as NodeJS.ProcessEnv, {});

    expect(runtime.status()).toMatchObject({
      available: true,
      provider: "ollama",
      model: "qwen3-embedding:0.6b",
      dimensions: 1024,
    });
  });

  test("creates an Ollama adapter from config", () => {
    const runtime = defaultEmbeddingRuntime({} as NodeJS.ProcessEnv, {
      embeddings: {
        provider: "ollama",
        endpoint: "http://127.0.0.1:11434",
        model: "qwen3-embedding:0.6b",
        dimensions: 1024,
      },
    });

    expect(runtime.status()).toMatchObject({
      available: true,
      provider: "ollama",
      model: "qwen3-embedding:0.6b",
      dimensions: 1024,
    });
  });

  test("keeps Jina setup guidance when Jina is explicitly configured without a key", () => {
    const runtime = defaultEmbeddingRuntime({ CODETRAP_EMBEDDING_PROVIDER: "jina" } as NodeJS.ProcessEnv, {});

    expect(runtime.available()).toBe(false);
    expect(runtime.status()).toMatchObject({
      available: false,
      provider: "jina",
      model: "jina-embeddings-v5-text-small",
      dimensions: 1024,
      profile_id: "jina:jina-embeddings-v5-text-small:1024:p1",
    });
    expect(runtime.setupAction()).toMatchObject({
      command: "export JINA_API_KEY=<your-jina-api-key>",
    });
  });

  test("health reports configured Ollama as unavailable when its model is missing", async () => {
    const fetcher = async () => new Response(JSON.stringify({
      models: [{ name: "embeddinggemma" }],
    }));
    const runtime = new EmbeddingRuntime(new OllamaEmbedder({
      model: "qwen3-embedding:0.6b",
      fetch: fetcher,
    }));

    expect(await runtime.health()).toMatchObject({
      available: false,
      provider: "ollama",
      model: "qwen3-embedding:0.6b",
      setup_action: {
        command: "ollama pull qwen3-embedding:0.6b",
      },
    });
  });
});
