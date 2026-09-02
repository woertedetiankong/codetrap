import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, test } from "bun:test";
import { ensureHuggingFaceModelWeight } from "../lib/huggingface-model-download";
import { LOCAL_EMBEDDING_MODELS } from "../lib/local-embedding-models";

describe("Hugging Face model download", () => {
  test("resumes a partial ranged download and reuses the completed cache offline", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "codetrap-hf-download-"));
    const content = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const model = {
      ...LOCAL_EMBEDDING_MODELS[0],
      onnxSizeBytes: content.byteLength,
      onnxSha256: sha256(content),
    };
    const target = join(cacheDir, model.repository, model.revision, "onnx", "model_quantized.onnx");
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(`${target}.part`, content.slice(0, 4));
    const ranges: string[] = [];
    const progress: number[] = [];

    const result = await ensureHuggingFaceModelWeight(model, cacheDir, {
      fetch: async (url, init) => {
        expect(String(url)).toBe(
          `https://huggingface.co/jinaai/jina-embeddings-v2-base-zh/resolve/${model.revision}/onnx/model_quantized.onnx`
        );
        const range = new Headers(init?.headers).get("range") ?? "";
        ranges.push(range);
        const match = range.match(/^bytes=(\d+)-(\d+)$/);
        if (!match) return new Response("missing range", { status: 400 });
        const start = Number(match[1]);
        const end = Number(match[2]);
        return new Response(content.slice(start, end + 1), {
          status: 206,
          headers: { "Content-Range": `bytes ${start}-${end}/${content.byteLength}` },
        });
      },
      onProgress: (value) => progress.push(value.percent),
    });

    expect(result).toBe(target);
    expect(ranges).toEqual(["bytes=4-9"]);
    expect(readFileSync(target)).toEqual(Buffer.from(content));
    expect(progress).toEqual([40, 100]);

    await ensureHuggingFaceModelWeight(model, cacheDir, {
      fetch: async () => {
        throw new Error("the completed cache must not use the network");
      },
    });
  });

  test("serializes concurrent downloads that share a resumable partial file", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "codetrap-hf-download-concurrent-"));
    const content = Uint8Array.from([10, 11, 12, 13]);
    const model = {
      ...LOCAL_EMBEDDING_MODELS[0],
      onnxSizeBytes: content.byteLength,
      onnxSha256: sha256(content),
    };
    let requests = 0;
    const fetchModel = async () => {
      requests += 1;
      await Bun.sleep(20);
      return new Response(content, {
        status: 206,
        headers: { "Content-Range": `bytes 0-3/${content.byteLength}` },
      });
    };

    const [first, second] = await Promise.all([
      ensureHuggingFaceModelWeight(model, cacheDir, { fetch: fetchModel }),
      ensureHuggingFaceModelWeight(model, cacheDir, { fetch: fetchModel }),
    ]);

    expect(second).toBe(first);
    expect(requests).toBe(1);
    expect(readFileSync(first)).toEqual(Buffer.from(content));
  });

  test("replaces a same-size corrupt cached weight instead of trusting its length", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "codetrap-hf-download-corrupt-cache-"));
    const content = Uint8Array.from([21, 22, 23, 24]);
    const model = {
      ...LOCAL_EMBEDDING_MODELS[0],
      onnxSizeBytes: content.byteLength,
      onnxSha256: sha256(content),
    };
    const target = join(cacheDir, model.repository, model.revision, "onnx", "model_quantized.onnx");
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, Uint8Array.from([99, 99, 99, 99]));
    let requests = 0;

    await ensureHuggingFaceModelWeight(model, cacheDir, {
      fetch: async () => {
        requests += 1;
        return rangedResponse(content, 0, content.byteLength - 1);
      },
    });

    expect(requests).toBe(1);
    expect(readFileSync(target)).toEqual(Buffer.from(content));
  });

  test("discards a corrupt completed partial and retries once from byte zero", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "codetrap-hf-download-corrupt-partial-"));
    const content = Uint8Array.from([31, 32, 33, 34]);
    const model = {
      ...LOCAL_EMBEDDING_MODELS[0],
      onnxSizeBytes: content.byteLength,
      onnxSha256: sha256(content),
    };
    const target = join(cacheDir, model.repository, model.revision, "onnx", "model_quantized.onnx");
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(`${target}.part`, Uint8Array.from([0, 0, 0, 0]));
    const ranges: string[] = [];

    await ensureHuggingFaceModelWeight(model, cacheDir, {
      fetch: async (_url, init) => {
        ranges.push(new Headers(init?.headers).get("range") ?? "");
        return rangedResponse(content, 0, content.byteLength - 1);
      },
    });

    expect(ranges).toEqual(["bytes=0-3"]);
    expect(readFileSync(target)).toEqual(Buffer.from(content));
  });

  test("rejects a ranged response whose total length does not match the pinned artifact", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "codetrap-hf-download-content-range-"));
    const content = Uint8Array.from([41, 42, 43, 44]);
    const model = {
      ...LOCAL_EMBEDDING_MODELS[0],
      onnxSizeBytes: content.byteLength,
      onnxSha256: sha256(content),
    };
    let requests = 0;

    await expect(ensureHuggingFaceModelWeight(model, cacheDir, {
      fetch: async () => {
        requests += 1;
        return new Response(content, {
          status: 206,
          headers: { "Content-Range": "bytes 0-3/999" },
        });
      },
    })).rejects.toThrow("unexpected content range");
    expect(requests).toBe(3);
  });
});

function sha256(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function rangedResponse(content: Uint8Array, start: number, end: number): Response {
  return new Response(content.slice(start, end + 1), {
    status: 206,
    headers: { "Content-Range": `bytes ${start}-${end}/${content.byteLength}` },
  });
}
