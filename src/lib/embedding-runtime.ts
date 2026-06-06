import {
  EmbeddingProviderUnavailableError,
  JinaEmbedder,
  embeddingConfig,
  type EmbeddingConfig,
  type EmbeddingProvider,
} from "./embedder";

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
  setup_action: EmbeddingRuntimeAction | null;
};

export class EmbeddingRuntime {
  constructor(private readonly adapter?: EmbeddingProvider) {}

  static fromEnvironment(env: NodeJS.ProcessEnv = process.env): EmbeddingRuntime {
    const apiKey = env.JINA_API_KEY;
    return new EmbeddingRuntime(apiKey ? new JinaEmbedder(apiKey) : undefined);
  }

  provider(): EmbeddingProvider | undefined {
    return this.adapter;
  }

  available(): boolean {
    return this.adapter !== undefined;
  }

  config(): EmbeddingConfig | null {
    return this.adapter ? embeddingConfig(this.adapter) : null;
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
    return {
      command: "export JINA_API_KEY=<your-jina-api-key>",
      reason: "Enable semantic and hybrid search; otherwise use --mode fts.",
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
      setup_action: this.setupAction(),
    };
  }
}

export function defaultEmbeddingRuntime(env: NodeJS.ProcessEnv = process.env): EmbeddingRuntime {
  return EmbeddingRuntime.fromEnvironment(env);
}

export function embeddingRuntimeFrom(input: EmbeddingRuntimeInput): EmbeddingRuntime {
  return input instanceof EmbeddingRuntime ? input : new EmbeddingRuntime(input);
}
