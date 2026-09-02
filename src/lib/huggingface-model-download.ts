import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createReadStream } from "node:fs";
import { dirname, join } from "node:path";
import {
  localEmbeddingModelIsReadyFromCacheDir,
  localEmbeddingModelWeightPathFromCacheDir,
  type LocalEmbeddingModelDefinition,
} from "./local-embedding-models";

const DOWNLOAD_CHUNK_BYTES = 8 * 1024 * 1024;
const DOWNLOAD_CHUNK_TIMEOUT_MS = 120_000;
const DOWNLOAD_RETRIES = 3;
const DOWNLOAD_LOCK_TIMEOUT_MS = 2 * 60 * 60 * 1_000;
const DOWNLOAD_LOCK_STALE_MS = 30_000;
const DOWNLOAD_LOCK_RETRY_MS = 250;

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type ModelDownloadProgress = {
  downloaded_bytes: number;
  total_bytes: number;
  percent: number;
};

export type ModelDownloadOptions = {
  fetch?: FetchLike;
  onProgress?: (progress: ModelDownloadProgress) => void;
};

/**
 * Download the large ONNX weight in resumable ranges before Transformers.js
 * initializes the pipeline. A single Hub fetch can exceed Bun's request
 * timeout on slower links; bounded chunks preserve partial progress instead.
 */
export async function ensureHuggingFaceModelWeight(
  model: LocalEmbeddingModelDefinition,
  cacheDir: string,
  options: ModelDownloadOptions = {}
): Promise<string> {
  const target = localEmbeddingModelWeightPathFromCacheDir(model, cacheDir);
  if (await cachedWeightMatches(model, cacheDir, target)) return target;

  mkdirSync(dirname(target), { recursive: true });
  const lockDir = `${target}.download-lock`;
  const lockToken = await acquireDownloadLock(lockDir);

  try {
    if (await cachedWeightMatches(model, cacheDir, target)) return target;
    removeInvalidCachedWeight(model, cacheDir, target);

    const partial = `${target}.part`;
    const fetchImpl = options.fetch ?? fetch;

    // One clean restart repairs a corrupt resumable prefix or a same-length
    // transport corruption without asking the user to delete cache files.
    for (let verificationAttempt = 0; verificationAttempt < 2; verificationAttempt += 1) {
      if (existsSync(partial) && statSync(partial).size > model.onnxSizeBytes) {
        unlinkSync(partial);
      }

      let offset = existsSync(partial) ? statSync(partial).size : 0;
      reportProgress(options.onProgress, offset, model.onnxSizeBytes);

      while (offset < model.onnxSizeBytes) {
        const end = Math.min(offset + DOWNLOAD_CHUNK_BYTES - 1, model.onnxSizeBytes - 1);
        const bytes = await fetchRangeWithRetry(
          huggingFaceResolveUrl(model),
          offset,
          end,
          model.onnxSizeBytes,
          fetchImpl
        );
        const expected = end - offset + 1;
        if (bytes.byteLength !== expected) {
          throw new Error(
            `Hugging Face returned ${bytes.byteLength} bytes for range ${offset}-${end}; expected ${expected}.`
          );
        }
        appendFileSync(partial, bytes);
        offset += bytes.byteLength;
        reportProgress(options.onProgress, offset, model.onnxSizeBytes);
      }

      if (!fileHasSize(partial, model.onnxSizeBytes)) {
        throw new Error(`Local model download is incomplete: ${partial}`);
      }
      const actualSha256 = await sha256File(partial);
      if (actualSha256 === model.onnxSha256) {
        if (existsSync(target)) unlinkSync(target);
        renameSync(partial, target);
        return target;
      }

      unlinkSync(partial);
      if (verificationAttempt === 1) {
        throw new Error(
          `Local model checksum mismatch for ${model.repository}@${model.revision}: ` +
          `expected ${model.onnxSha256}, received ${actualSha256}. The corrupt download was removed.`
        );
      }
    }

    throw new Error(`Could not verify local model download: ${target}`);
  } finally {
    releaseDownloadLock(lockDir, lockToken);
  }
}

async function acquireDownloadLock(
  lockDir: string
): Promise<string> {
  const started = Date.now();
  const token = `${process.pid}.${Math.random().toString(36).slice(2)}`;

  for (;;) {
    try {
      mkdirSync(lockDir);
      writeFileSync(join(lockDir, "owner"), token);
      return token;
    } catch (error) {
      if ((error as { code?: string } | null)?.code !== "EEXIST") throw error;
    }

    if (reclaimAbandonedDownloadLock(lockDir)) continue;
    if (Date.now() - started >= DOWNLOAD_LOCK_TIMEOUT_MS) {
      throw new Error(`Timed out waiting for the local model download lock at ${lockDir}.`);
    }
    await Bun.sleep(DOWNLOAD_LOCK_RETRY_MS);
  }
}

function reclaimAbandonedDownloadLock(lockDir: string): boolean {
  try {
    if (Date.now() - statSync(lockDir).mtimeMs <= DOWNLOAD_LOCK_STALE_MS) return false;
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "ENOENT") return false;
    throw error;
  }

  const ownerPid = readOwnerPid(lockDir);
  // Age never authorizes taking a lock from a live downloader: large model
  // downloads can legitimately spend minutes in one range request.
  if (ownerPid !== null && processIsAlive(ownerPid)) return false;

  const quarantine = `${lockDir}.reclaim-${process.pid}-${Math.random().toString(36).slice(2)}`;
  try {
    renameSync(lockDir, quarantine);
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "ENOENT" || code === "EEXIST") return false;
    throw error;
  }
  rmSync(quarantine, { recursive: true, force: true });
  return true;
}

function releaseDownloadLock(lockDir: string, token: string): void {
  try {
    if (readFileSync(join(lockDir, "owner"), "utf8") !== token) return;
  } catch {
    return;
  }
  rmSync(lockDir, { recursive: true, force: true });
}

function readOwnerPid(lockDir: string): number | null {
  try {
    const match = readFileSync(join(lockDir, "owner"), "utf8").match(/^(\d+)\./);
    if (!match) return null;
    const pid = Number(match[1]);
    return Number.isSafeInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as { code?: string } | null)?.code !== "ESRCH";
  }
}

function huggingFaceResolveUrl(model: LocalEmbeddingModelDefinition): string {
  const repository = model.repository.split("/").map(encodeURIComponent).join("/");
  const file = model.onnxFile.split("/").map(encodeURIComponent).join("/");
  return `https://huggingface.co/${repository}/resolve/${encodeURIComponent(model.revision)}/${file}`;
}

async function fetchRangeWithRetry(
  url: string,
  start: number,
  end: number,
  total: number,
  fetchImpl: FetchLike
): Promise<Uint8Array> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= DOWNLOAD_RETRIES; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: { Range: `bytes=${start}-${end}` },
        signal: AbortSignal.timeout(DOWNLOAD_CHUNK_TIMEOUT_MS),
      });
      if (response.status !== 206) {
        throw new Error(`Hugging Face model download failed (${response.status} ${response.statusText}).`);
      }
      const contentRange = response.headers.get("content-range");
      if (contentRange !== `bytes ${start}-${end}/${total}`) {
        throw new Error(`Hugging Face returned an unexpected content range: ${contentRange}.`);
      }
      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Could not download local model range ${start}-${end} after ${DOWNLOAD_RETRIES} attempts: ${message}`);
}

async function cachedWeightMatches(
  model: LocalEmbeddingModelDefinition,
  cacheDir: string,
  target: string
): Promise<boolean> {
  if (localEmbeddingModelIsReadyFromCacheDir(model, cacheDir)) return true;
  if (!fileHasSize(target, model.onnxSizeBytes)) return false;
  return await sha256File(target) === model.onnxSha256;
}

function removeInvalidCachedWeight(
  model: LocalEmbeddingModelDefinition,
  cacheDir: string,
  target: string
): void {
  if (existsSync(target)) unlinkSync(target);
  const marker = join(cacheDir, `.codetrap-${model.id}-${model.dtype}.ready.json`);
  if (existsSync(marker)) unlinkSync(marker);
}

function sha256File(path: string): Promise<string> {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const input = createReadStream(path);
    input.on("error", reject);
    input.on("data", (chunk) => hash.update(chunk));
    input.on("end", () => resolveHash(hash.digest("hex")));
  });
}

function reportProgress(
  callback: ModelDownloadOptions["onProgress"],
  downloaded: number,
  total: number
): void {
  callback?.({
    downloaded_bytes: downloaded,
    total_bytes: total,
    percent: Math.floor((downloaded / total) * 100),
  });
}

function fileHasSize(path: string, expected: number): boolean {
  return existsSync(path) && statSync(path).size === expected;
}
