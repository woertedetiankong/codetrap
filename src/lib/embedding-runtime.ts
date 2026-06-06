import {
  DEFAULT_OLLAMA_DIMENSIONS,
  DEFAULT_OLLAMA_ENDPOINT,
  DEFAULT_OLLAMA_MODEL,
  EmbeddingProviderUnavailableError,
  JinaEmbedder,
  OllamaEmbedder,
  embeddingConfig,
  embeddingProfileId,
  type EmbeddingConfig,
  type EmbeddingProvider,
} from "./embedder";
import { loadCodetrapConfig, type CodetrapConfig, type EmbeddingProviderSetting } from "./config";

export type EmbeddingRuntimeInput = EmbeddingRuntime | EmbeddingProvider | undefined;

export type EmbeddingRuntimeAction = {
  command: string;
  reason: string;
};

export type EmbeddingRuntimeStatus = {
  available: boolean;
  provider: string | null;
  model: string | null;
  dimensions: number | null;
  passage_version: number | null;
  profile_id: string | null;
  setup_action: EmbeddingRuntimeAction | null;
};

export class EmbeddingRuntime {
  constructor(
    private readonly adapter?: EmbeddingProvider,
    private readonly setupProvider: EmbeddingProviderSetting = "ollama",
    private readonly configuredConfig: EmbeddingConfig | null = null
  ) {}

  static fromEnvironment(
    env: NodeJS.ProcessEnv = process.env,
    config: CodetrapConfig = loadCodetrapConfig()
  ): EmbeddingRuntime {
    const provider = configuredProvider(env, config);
    if (provider === "ollama") {
      return new EmbeddingRuntime(new OllamaEmbedder(ollamaOptions(env, config)), "ollama");
    }
    if (provider === "jina") {
      const apiKey = env.JINA_API_KEY;
      const configuredConfig = embeddingConfig(new JinaEmbedder(apiKey ?? ""));
      return new EmbeddingRuntime(apiKey ? new JinaEmbedder(apiKey) : undefined, "jina", configuredConfig);
    }

    const apiKey = env.JINA_API_KEY;
    if (apiKey) return new EmbeddingRuntime(new JinaEmbedder(apiKey), "jina");
    return new EmbeddingRuntime(undefined, "ollama");
  }

  provider(): EmbeddingProvider | undefined {
    return this.adapter;
  }

  available(): boolean {
    return this.adapter !== undefined;
  }

  config(): EmbeddingConfig | null {
    return this.adapter ? embeddingConfig(this.adapter) : this.configuredConfig;
  }

  requireProvider(message?: string): EmbeddingProvider {
    if (!this.adapter) throw this.unavailableError(message);
    return this.adapter;
  }

  unavailableError(message?: string): EmbeddingProviderUnavailableError {
    return new EmbeddingProviderUnavailableError(
      message ?? "Embedding provider is unavailable. Configure an embedding provider or use --mode fts."
    );
  }

  setupAction(): EmbeddingRuntimeAction | null {
    if (this.adapter) return null;
    if (this.setupProvider === "jina") {
      return {
        command: "export JINA_API_KEY=<your-jina-api-key>",
        reason: "Enable Jina semantic and hybrid search; otherwise use --mode fts.",
      };
    }
    return {
      command: "export CODETRAP_EMBEDDING_PROVIDER=ollama",
      reason: "Enable local semantic and hybrid search after installing Ollama and pulling qwen3-embedding:0.6b; otherwise use --mode fts.",
    };
  }

  status(): EmbeddingRuntimeStatus {
    const config = this.config();
    return {
      available: this.available(),
      provider: config?.provider ?? null,
      model: config?.model ?? null,
      dimensions: config?.dimensions ?? null,
      passage_version: config?.passageVersion ?? null,
      profile_id: config ? embeddingProfileId(config) : null,
      setup_action: this.setupAction(),
    };
  }

  async health(): Promise<EmbeddingRuntimeStatus> {
    const status = this.status();
    if (!this.adapter || !(this.adapter instanceof OllamaEmbedder)) return status;

    const health = await this.adapter.health();
    if (health.ok) return status;
    return {
      ...status,
      available: false,
      setup_action: {
        command: health.command ?? `ollama pull ${this.adapter.model}`,
        reason: health.message ?? "Ollama embedding provider is unavailable.",
      },
    };
  }
}

export function defaultEmbeddingRuntime(
  env: NodeJS.ProcessEnv = process.env,
  config?: CodetrapConfig
): EmbeddingRuntime {
  return EmbeddingRuntime.fromEnvironment(env, config);
}

export function embeddingRuntimeFrom(input: EmbeddingRuntimeInput): EmbeddingRuntime {
  return input instanceof EmbeddingRuntime ? input : new EmbeddingRuntime(input);
}

function configuredProvider(
  env: NodeJS.ProcessEnv,
  config: CodetrapConfig
): EmbeddingProviderSetting | undefined {
  if (config.embeddings?.provider) return config.embeddings.provider;
  if (env.CODETRAP_EMBEDDING_PROVIDER) return parseProviderEnv(env.CODETRAP_EMBEDDING_PROVIDER);
  if (config.embeddings?.endpoint || config.embeddings?.model || config.embeddings?.dimensions) return "ollama";
  if (env.CODETRAP_OLLAMA_ENDPOINT || env.CODETRAP_OLLAMA_MODEL || env.CODETRAP_OLLAMA_DIMENSIONS) {
    return "ollama";
  }
  return undefined;
}

function ollamaOptions(env: NodeJS.ProcessEnv, config: CodetrapConfig) {
  return {
    endpoint: normalizeEndpointSetting(
      config.embeddings?.endpoint ?? env.CODETRAP_OLLAMA_ENDPOINT ?? env.OLLAMA_HOST ?? DEFAULT_OLLAMA_ENDPOINT
    ),
    model: config.embeddings?.model ?? env.CODETRAP_OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL,
    dimensions:
      config.embeddings?.dimensions ??
      parseOptionalPositiveInt(env.CODETRAP_OLLAMA_DIMENSIONS, "CODETRAP_OLLAMA_DIMENSIONS") ??
      DEFAULT_OLLAMA_DIMENSIONS,
  };
}

function parseProviderEnv(value: string): EmbeddingProviderSetting {
  if (value === "ollama" || value === "jina") return value;
  throw new Error(`Invalid CODETRAP_EMBEDDING_PROVIDER: ${value}. Expected ollama or jina.`);
}

function parseOptionalPositiveInt(value: string | undefined, label: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  throw new Error(`Invalid ${label}: expected a positive integer.`);
}

function normalizeEndpointSetting(endpoint: string): string {
  if (/^https?:\/\//.test(endpoint)) return endpoint;
  return `http://${endpoint}`;
}
