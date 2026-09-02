import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { loadCodetrapConfig, setCodetrapEmbeddingSettings } from "../lib/config";

describe("codetrap config", () => {
  test("loads embedding provider settings", () => {
    const home = mkdtempSync(join(tmpdir(), "codetrap-config-"));
    const configDir = join(home, ".codetrap");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "config.json"), JSON.stringify({
      embeddings: {
        provider: "ollama",
        endpoint: "http://127.0.0.1:11434",
        model: "qwen3-embedding:0.6b",
        dimensions: 1024,
      },
    }));

    expect(loadCodetrapConfig(home)).toEqual({
      embeddings: {
        provider: "ollama",
        endpoint: "http://127.0.0.1:11434",
        model: "qwen3-embedding:0.6b",
        dimensions: 1024,
      },
    });
  });

  test("writes embedding provider settings while preserving search config", () => {
    const home = mkdtempSync(join(tmpdir(), "codetrap-config-"));
    const configDir = join(home, ".codetrap");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "config.json"), JSON.stringify({
      search: {
        mode: "fts",
        limit: 5,
      },
    }));

    const result = setCodetrapEmbeddingSettings({
      provider: "ollama",
      endpoint: "http://127.0.0.1:11434",
      model: "qwen3-embedding:0.6b",
      dimensions: 1024,
    }, home);

    expect(result.config).toMatchObject({
      search: {
        mode: "fts",
        limit: 5,
      },
      embeddings: {
        provider: "ollama",
        endpoint: "http://127.0.0.1:11434",
        model: "qwen3-embedding:0.6b",
        dimensions: 1024,
      },
    });
  });

  test("round trips a built-in Hugging Face model selection", () => {
    const home = mkdtempSync(join(tmpdir(), "codetrap-config-hf-"));

    setCodetrapEmbeddingSettings({
      provider: "huggingface",
      model: "quality",
    }, home);

    expect(loadCodetrapConfig(home).embeddings).toEqual({
      provider: "huggingface",
      model: "quality",
    });
  });
});
