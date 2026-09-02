import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CODETRAP_DIR } from "./constants";

export type LocalEmbeddingModelId = "default" | "quality";
export type LocalEmbeddingPooling = "mean" | "last_token";

export type LocalEmbeddingModelDefinition = {
  id: LocalEmbeddingModelId;
  repository: string;
  revision: string;
  runtimeModel: string;
  dtype: "q8";
  dimensions: number;
  contextLength: number;
  pooling: LocalEmbeddingPooling;
  onnxFile: string;
  onnxSizeBytes: number;
  onnxSha256: string;
  queryInstruction?: string;
  approximateDownloadMb: number;
};

export type LocalEmbeddingModelChoice = {
  id: LocalEmbeddingModelId;
  repository: string;
  model: string;
  dtype: "q8";
  dimensions: number;
  context_length: number;
  approximate_download_mb: number;
  cached: boolean;
  selected: boolean;
};

export const QWEN3_LOCAL_QUERY_INSTRUCTION =
  "Instruct: Given a web search query, retrieve relevant passages that answer the query\nQuery: ";

export const LOCAL_EMBEDDING_MODELS: readonly LocalEmbeddingModelDefinition[] = [
  {
    id: "default",
    repository: "jinaai/jina-embeddings-v2-base-zh",
    revision: "c1ff9086a89a1123d7b5eff58055a665db4fb4b9",
    runtimeModel: "jinaai/jina-embeddings-v2-base-zh@q8",
    dtype: "q8",
    dimensions: 768,
    contextLength: 8192,
    pooling: "mean",
    onnxFile: "onnx/model_quantized.onnx",
    onnxSizeBytes: 161_565_239,
    onnxSha256: "0a221ee9e6a6647ccc59cee7bdd26a7b8cf0c0cd3481a65f358d9585a23f02f4",
    approximateDownloadMb: 162,
  },
  {
    id: "quality",
    repository: "onnx-community/Qwen3-Embedding-0.6B-ONNX",
    revision: "c25a394dd583836952667c12f008335071b3f43d",
    runtimeModel: "onnx-community/Qwen3-Embedding-0.6B-ONNX@q8",
    dtype: "q8",
    dimensions: 1024,
    contextLength: 32768,
    pooling: "last_token",
    onnxFile: "onnx/model_quantized.onnx",
    onnxSizeBytes: 613_527_631,
    onnxSha256: "87cd124e0ef1fd1f223ebc283efccbaeac386d0b08344701c46975d0657b591f",
    queryInstruction: QWEN3_LOCAL_QUERY_INSTRUCTION,
    approximateDownloadMb: 614,
  },
] as const;

export const DEFAULT_LOCAL_EMBEDDING_MODEL_ID: LocalEmbeddingModelId = "default";

export function resolveLocalEmbeddingModel(
  value?: string
): LocalEmbeddingModelDefinition {
  const requested = value?.trim() || DEFAULT_LOCAL_EMBEDDING_MODEL_ID;
  const alias = requested === "balanced" ? "default" : requested === "high-quality" ? "quality" : requested;
  const definition = LOCAL_EMBEDDING_MODELS.find((model) =>
    model.id === alias || model.repository === requested || model.runtimeModel === requested
  );
  if (definition) return definition;
  throw new Error(
    `Invalid local embedding model: ${requested}. Expected one of: default, quality.`
  );
}

export function localEmbeddingModelCacheDir(home = homedir()): string {
  return join(home, CODETRAP_DIR, "models", "huggingface");
}

export function localEmbeddingModelReadyMarker(
  model: LocalEmbeddingModelDefinition,
  home = homedir()
): string {
  return join(localEmbeddingModelCacheDir(home), `.codetrap-${model.id}-${model.dtype}.ready.json`);
}

export function localEmbeddingModelWeightPathFromCacheDir(
  model: LocalEmbeddingModelDefinition,
  cacheDir: string
): string {
  return join(
    cacheDir,
    ...model.repository.split("/"),
    model.revision,
    ...model.onnxFile.split("/")
  );
}

export function localEmbeddingModelWeightPath(
  model: LocalEmbeddingModelDefinition,
  home = homedir()
): string {
  return localEmbeddingModelWeightPathFromCacheDir(model, localEmbeddingModelCacheDir(home));
}

export function localEmbeddingModelIsReadyFromCacheDir(
  model: LocalEmbeddingModelDefinition,
  cacheDir: string
): boolean {
  const markerPath = join(cacheDir, `.codetrap-${model.id}-${model.dtype}.ready.json`);
  const weightPath = localEmbeddingModelWeightPathFromCacheDir(model, cacheDir);
  if (!existsSync(markerPath) || !existsSync(weightPath)) return false;
  try {
    const marker = JSON.parse(readFileSync(markerPath, "utf8")) as Record<string, unknown>;
    const weight = statSync(weightPath);
    return marker.repository === model.repository &&
      marker.revision === model.revision &&
      marker.sha256 === model.onnxSha256 &&
      marker.dtype === model.dtype &&
      marker.dimensions === model.dimensions &&
      weight.size === model.onnxSizeBytes &&
      marker.weight_size_bytes === weight.size &&
      marker.weight_mtime_ms === Math.floor(weight.mtimeMs);
  } catch {
    return false;
  }
}

export function localEmbeddingModelIsReady(
  model: LocalEmbeddingModelDefinition,
  home = homedir()
): boolean {
  return localEmbeddingModelIsReadyFromCacheDir(model, localEmbeddingModelCacheDir(home));
}

export function localEmbeddingModelChoices(
  home = homedir(),
  selectedModel?: string
): LocalEmbeddingModelChoice[] {
  let selectedId: LocalEmbeddingModelId | null = null;
  if (selectedModel) {
    try {
      selectedId = resolveLocalEmbeddingModel(selectedModel).id;
    } catch {
      selectedId = null;
    }
  }

  return LOCAL_EMBEDDING_MODELS.map((model) => ({
    id: model.id,
    repository: model.repository,
    model: model.runtimeModel,
    dtype: model.dtype,
    dimensions: model.dimensions,
    context_length: model.contextLength,
    approximate_download_mb: model.approximateDownloadMb,
    cached: localEmbeddingModelIsReady(model, home),
    selected: model.id === selectedId,
  }));
}
