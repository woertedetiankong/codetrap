import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import type { EmbeddingProvider, EmbeddingTask } from "./embedder";
import { ensureHuggingFaceModelWeight } from "./huggingface-model-download";
import { HuggingFaceFileCache } from "./huggingface-file-cache";
import {
  localEmbeddingModelCacheDir,
  localEmbeddingModelIsReady,
  localEmbeddingModelReadyMarker,
  localEmbeddingModelWeightPath,
  resolveLocalEmbeddingModel,
  type LocalEmbeddingModelDefinition,
} from "./local-embedding-models";

type FeatureExtractionOutput = {
  data: ArrayLike<number>;
  dims: number[];
};

declare const CODETRAP_STANDALONE_WASM: boolean | undefined;

let standaloneTransformersRuntimePromise: Promise<typeof import("@huggingface/transformers")> | null = null;

type FeatureExtractor = (
  texts: string[],
  options: { pooling: "mean" | "last_token"; normalize: boolean }
) => Promise<FeatureExtractionOutput>;

export type HuggingFacePipelineFactory = (
  model: LocalEmbeddingModelDefinition,
  cacheDir: string
) => Promise<FeatureExtractor>;

export type HuggingFaceEmbedderOptions = {
  model?: string;
  home?: string;
  pipelineFactory?: HuggingFacePipelineFactory;
};

export class HuggingFaceEmbedder implements EmbeddingProvider {
  readonly provider = "huggingface";
  readonly model: string;
  readonly dimensions: number;
  readonly definition: LocalEmbeddingModelDefinition;

  private readonly home: string;
  private readonly cacheDir: string;
  private readonly pipelineFactory: HuggingFacePipelineFactory;
  private extractorPromise: Promise<FeatureExtractor> | null = null;

  constructor(options: HuggingFaceEmbedderOptions = {}) {
    this.definition = resolveLocalEmbeddingModel(options.model);
    this.model = this.definition.runtimeModel;
    this.dimensions = this.definition.dimensions;
    this.home = options.home ?? homedir();
    this.cacheDir = localEmbeddingModelCacheDir(this.home);
    this.pipelineFactory = options.pipelineFactory ?? createTransformersPipeline;
  }

  async embed(texts: string[], task: EmbeddingTask): Promise<Float32Array[]> {
    if (texts.length === 0) return [];

    const extractor = await this.extractor();
    const input = task === "retrieval.query" && this.definition.queryInstruction
      ? texts.map((text) => `${this.definition.queryInstruction}${text}`)
      : texts;
    const output = await extractor(input, {
      pooling: this.definition.pooling,
      normalize: true,
    });
    const vectors = outputVectors(output, texts.length, this.dimensions, this.model);
    this.markReady();
    return vectors;
  }

  ready(): boolean {
    return localEmbeddingModelIsReady(this.definition, this.home);
  }

  private extractor(): Promise<FeatureExtractor> {
    if (!this.extractorPromise) {
      mkdirSync(this.cacheDir, { recursive: true });
      this.extractorPromise = this.pipelineFactory(this.definition, this.cacheDir).catch((error) => {
        this.extractorPromise = null;
        throw error;
      });
    }
    return this.extractorPromise;
  }

  private markReady(): void {
    const weight = statSync(localEmbeddingModelWeightPath(this.definition, this.home));
    writeFileSync(
      localEmbeddingModelReadyMarker(this.definition, this.home),
      `${JSON.stringify({
        repository: this.definition.repository,
        revision: this.definition.revision,
        sha256: this.definition.onnxSha256,
        dtype: this.definition.dtype,
        dimensions: this.definition.dimensions,
        weight_size_bytes: weight.size,
        weight_mtime_ms: Math.floor(weight.mtimeMs),
      }, null, 2)}\n`
    );
  }
}

async function createTransformersPipeline(
  model: LocalEmbeddingModelDefinition,
  cacheDir: string
): Promise<FeatureExtractor> {
  let lastReportedBucket = -1;
  await ensureHuggingFaceModelWeight(model, cacheDir, {
    onProgress: ({ percent }) => {
      const bucket = Math.floor(percent / 10);
      if (bucket === lastReportedBucket) return;
      lastReportedBucket = bucket;
      console.error(`Downloading local embedding model ${model.id} (${model.dtype}): ${percent}%`);
    },
  });
  const { env, pipeline } = await importTransformersRuntime();
  const useWasmBackend = !env.useFS;
  if (useWasmBackend) {
    env.allowLocalModels = false;
    env.useCustomCache = true;
    env.customCache = new HuggingFaceFileCache(cacheDir);
    if (isStandaloneWasmBuild()) {
      const { embeddedStandaloneWasmRuntime } = await import("./standalone-wasm-assets");
      const runtime = await embeddedStandaloneWasmRuntime();
      env.useWasmCache = false;
      if (env.backends.onnx.wasm) {
        // The Transformers web bundle already contains the matching JS
        // factory. Supplying only the embedded binary lets ORT use that
        // factory and avoids both a CDN lookup and a blob/file URL import.
        env.backends.onnx.wasm.wasmPaths = undefined;
        env.backends.onnx.wasm.wasmBinary = runtime.binary;
      }
    } else {
      env.useWasmCache = true;
    }
    if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;
  }
  const extractor = await pipeline("feature-extraction", model.repository, {
    dtype: model.dtype,
    revision: model.revision,
    cache_dir: cacheDir,
    ...(useWasmBackend ? { device: "wasm" } : {}),
  });
  return extractor as unknown as FeatureExtractor;
}

async function importTransformersRuntime(): Promise<typeof import("@huggingface/transformers")> {
  if (!isStandaloneWasmBuild()) return import("@huggingface/transformers");
  if (standaloneTransformersRuntimePromise) return standaloneTransformersRuntimePromise;

  standaloneTransformersRuntimePromise = (async () => {
    // Transformers.js detects Node by process.release.name. Standalone builds
    // deliberately bundle its web artifact, so expose Bun as a non-Node runtime
    // only while that module initializes and selects ONNX Runtime WASM.
    const originalReleaseName = process.release.name;
    process.release.name = "bun";
    try {
      return await import("@huggingface/transformers");
    } finally {
      process.release.name = originalReleaseName;
    }
  })().catch((error) => {
    standaloneTransformersRuntimePromise = null;
    throw error;
  });
  return standaloneTransformersRuntimePromise;
}

function isStandaloneWasmBuild(): boolean {
  return typeof CODETRAP_STANDALONE_WASM !== "undefined" && CODETRAP_STANDALONE_WASM;
}

function outputVectors(
  output: FeatureExtractionOutput,
  expectedRows: number,
  dimensions: number,
  model: string
): Float32Array[] {
  const expectedValues = expectedRows * dimensions;
  if (output.data.length !== expectedValues) {
    throw new Error(
      `Local model ${model} returned ${output.data.length} values for ${expectedRows} inputs; expected ${expectedValues}.`
    );
  }
  if (output.dims.length !== 2 || output.dims[0] !== expectedRows || output.dims[1] !== dimensions) {
    throw new Error(
      `Local model ${model} returned shape [${output.dims.join(", ")}]; expected [${expectedRows}, ${dimensions}].`
    );
  }

  const vectors: Float32Array[] = [];
  for (let row = 0; row < expectedRows; row += 1) {
    const start = row * dimensions;
    const vector = new Float32Array(dimensions);
    for (let index = 0; index < dimensions; index += 1) {
      vector[index] = Number(output.data[start + index]);
    }
    vectors.push(vector);
  }
  return vectors;
}
