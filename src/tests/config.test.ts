import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { loadCodetrapConfig } from "../lib/config";

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
});
