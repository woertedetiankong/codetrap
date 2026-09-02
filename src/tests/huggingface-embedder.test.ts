import { existsSync, mkdirSync, mkdtempSync, readFileSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, test } from "bun:test";
import { HuggingFaceEmbedder } from "../lib/huggingface-embedder";
import {
  localEmbeddingModelChoices,
  localEmbeddingModelReadyMarker,
  localEmbeddingModelWeightPath,
  QWEN3_LOCAL_QUERY_INSTRUCTION,
  resolveLocalEmbeddingModel,
} from "../lib/local-embedding-models";

describe("local Hugging Face embedder", () => {
  test("uses mean pooling for the balanced model and writes a ready marker", async () => {
    const home = mkdtempSync(join(tmpdir(), "codetrap-hf-default-"));
    preparePinnedWeight(home, "default");
    const calls: { texts: string[]; pooling: string; normalize: boolean }[] = [];
    const embedder = new HuggingFaceEmbedder({
      model: "default",
      home,
      pipelineFactory: async (model, cacheDir) => {
        expect(model.repository).toBe("jinaai/jina-embeddings-v2-base-zh");
        expect(cacheDir).toBe(join(home, ".codetrap", "models", "huggingface"));
        return async (texts, options) => {
          calls.push({ texts, ...options });
          return {
            data: new Float32Array(texts.length * model.dimensions).fill(0.25),
            dims: [texts.length, model.dimensions],
          };
        };
      },
    });

    const vectors = await embedder.embed(["中文陷阱", "TypeScript pitfall"], "retrieval.query");

    expect(embedder.model).toBe("jinaai/jina-embeddings-v2-base-zh@q8");
    expect(vectors).toHaveLength(2);
    expect(vectors[0]).toHaveLength(768);
    expect(calls).toEqual([{
      texts: ["中文陷阱", "TypeScript pitfall"],
      pooling: "mean",
      normalize: true,
    }]);
    expect(existsSync(localEmbeddingModelReadyMarker(embedder.definition, home))).toBe(true);
    expect(JSON.parse(readFileSync(localEmbeddingModelReadyMarker(embedder.definition, home), "utf8"))).toMatchObject({
      revision: embedder.definition.revision,
      sha256: embedder.definition.onnxSha256,
      weight_size_bytes: embedder.definition.onnxSizeBytes,
    });
    expect(localEmbeddingModelChoices(home, "default")[0]).toMatchObject({
      cached: true,
      selected: true,
    });
  });

  test("adds the Qwen query instruction and uses last-token pooling only for queries", async () => {
    const home = mkdtempSync(join(tmpdir(), "codetrap-hf-quality-"));
    preparePinnedWeight(home, "quality");
    const calls: { texts: string[]; pooling: string; normalize: boolean }[] = [];
    const embedder = new HuggingFaceEmbedder({
      model: "quality",
      home,
      pipelineFactory: async (model) => async (texts, options) => {
        calls.push({ texts, ...options });
        return {
          data: new Float32Array(texts.length * model.dimensions).fill(0.5),
          dims: [texts.length, model.dimensions],
        };
      },
    });

    await embedder.embed(["timeout bug"], "retrieval.query");
    await embedder.embed(["passage body"], "retrieval.passage");

    expect(embedder.model).toBe("onnx-community/Qwen3-Embedding-0.6B-ONNX@q8");
    expect(calls).toEqual([
      {
        texts: [`${QWEN3_LOCAL_QUERY_INSTRUCTION}timeout bug`],
        pooling: "last_token",
        normalize: true,
      },
      {
        texts: ["passage body"],
        pooling: "last_token",
        normalize: true,
      },
    ]);
  });

  test("rejects output with the wrong shape instead of storing incompatible vectors", async () => {
    const embedder = new HuggingFaceEmbedder({
      model: "default",
      home: mkdtempSync(join(tmpdir(), "codetrap-hf-shape-")),
      pipelineFactory: async () => async () => ({
        data: new Float32Array(10),
        dims: [1, 10],
      }),
    });

    await expect(embedder.embed(["text"], "retrieval.passage")).rejects.toThrow(
      "expected 768"
    );
  });
});

function preparePinnedWeight(home: string, modelId: "default" | "quality"): void {
  const model = resolveLocalEmbeddingModel(modelId);
  const path = localEmbeddingModelWeightPath(model, home);
  mkdirSync(dirname(path), { recursive: true });
  // The injected test pipeline never reads the ONNX file. A sparse file keeps
  // the production ready-marker invariant without allocating the real model.
  writeFileSync(path, "");
  truncateSync(path, model.onnxSizeBytes);
}
