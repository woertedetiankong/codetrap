import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Filesystem-backed Cache API subset used by the Transformers.js web build. */
export class HuggingFaceFileCache {
  constructor(private readonly cacheDir: string) {}

  async match(request: string): Promise<Response | undefined> {
    const path = this.pathFor(request);
    if (!existsSync(path)) return undefined;
    const file = Bun.file(path);
    return new Response(file, {
      headers: { "Content-Length": String(file.size) },
    });
  }

  async put(
    request: string,
    response: Response,
    progress?: (value: { progress: number; loaded: number; total: number }) => void
  ): Promise<void> {
    const path = this.pathFor(request);
    mkdirSync(dirname(path), { recursive: true });
    const bytes = new Uint8Array(await response.arrayBuffer());
    const partial = `${path}.cache-part-${process.pid}-${randomUUID()}`;
    writeFileSync(partial, bytes);
    if (existsSync(path)) {
      unlinkSync(partial);
      progress?.({ progress: 100, loaded: bytes.byteLength, total: bytes.byteLength });
      return;
    }
    try {
      renameSync(partial, path);
    } catch (error) {
      // Another process may have won the atomic publish race after our
      // existsSync check. Its complete file is equivalent to this response.
      if (existsSync(path)) {
        if (existsSync(partial)) unlinkSync(partial);
      } else {
        if (existsSync(partial)) unlinkSync(partial);
        throw error;
      }
    }
    progress?.({ progress: 100, loaded: bytes.byteLength, total: bytes.byteLength });
  }

  pathFor(request: string): string {
    const modelPath = huggingFaceModelPath(request);
    if (modelPath) return join(this.cacheDir, ...modelPath);
    const url = String(request);
    const extension = new URL(url).pathname.endsWith(".mjs") ? ".mjs" :
      new URL(url).pathname.endsWith(".wasm") ? ".wasm" : ".bin";
    const digest = createHash("sha256").update(url).digest("hex");
    return join(this.cacheDir, "runtime", `${digest}${extension}`);
  }
}

function huggingFaceModelPath(request: string): string[] | null {
  const value = String(request);
  if (value.startsWith("/models/")) {
    return safePathParts(value.slice("/models/".length));
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.hostname !== "huggingface.co") return null;
  const parts = safePathParts(url.pathname);
  const resolveIndex = parts.indexOf("resolve");
  if (resolveIndex < 2 || parts.length <= resolveIndex + 2) return null;
  return [
    ...parts.slice(0, resolveIndex),
    parts[resolveIndex + 1],
    ...parts.slice(resolveIndex + 2),
  ];
}

function safePathParts(value: string): string[] {
  return value
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent)
    .filter((part) => part !== "." && part !== ".." && !part.includes("\\"));
}
