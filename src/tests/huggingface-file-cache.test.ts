import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { HuggingFaceFileCache } from "../lib/huggingface-file-cache";

describe("standalone Hugging Face file cache", () => {
  test("keeps Hub revisions isolated and stores runtime assets by digest", async () => {
    const root = mkdtempSync(join(tmpdir(), "codetrap-hf-file-cache-"));
    const cache = new HuggingFaceFileCache(root);
    const modelUrl = "https://huggingface.co/jinaai/jina-embeddings-v2-base-zh/resolve/main/config.json";
    const modelPath = join(root, "jinaai", "jina-embeddings-v2-base-zh", "main", "config.json");

    await cache.put(modelUrl, new Response('{"model_type":"bert"}'));

    expect(cache.pathFor(modelUrl)).toBe(modelPath);
    expect(cache.pathFor(modelUrl.replace("/main/", "/pinned-revision/"))).not.toBe(modelPath);
    expect(cache.pathFor("/models/jinaai/jina-embeddings-v2-base-zh/config.json")).toBe(
      join(root, "jinaai", "jina-embeddings-v2-base-zh", "config.json")
    );
    expect(await (await cache.match(modelUrl))?.text()).toBe('{"model_type":"bert"}');

    const wasmUrl = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.2.3/dist/runtime.wasm";
    await cache.put(wasmUrl, new Response(Uint8Array.from([1, 2, 3])));
    const wasmPath = cache.pathFor(wasmUrl);
    expect(wasmPath).toStartWith(join(root, "runtime"));
    expect(wasmPath).toEndWith(".wasm");
    expect(readFileSync(wasmPath)).toEqual(Buffer.from([1, 2, 3]));
  });

  test("publishes concurrent writes atomically without leaving shared partial files", async () => {
    const root = mkdtempSync(join(tmpdir(), "codetrap-hf-file-cache-race-"));
    const cache = new HuggingFaceFileCache(root);
    const modelUrl = "https://huggingface.co/org/model/resolve/revision/tokenizer.json";
    const content = '{"version":"1.0"}';

    await Promise.all([
      cache.put(modelUrl, new Response(content)),
      cache.put(modelUrl, new Response(content)),
    ]);

    expect(await (await cache.match(modelUrl))?.text()).toBe(content);
    expect(allFiles(root).some((path) => path.includes(".cache-part-"))).toBe(false);
  });
});

function allFiles(root: string): string[] {
  return readdirSync(root, { recursive: true }).map(String);
}
