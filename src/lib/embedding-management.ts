import type { ConfigWriteResult, EmbeddingSettings } from "./config";
import type { EmbeddingScopeStatus, TrapEmbeddingProfiles, TrapEmbeddingStatus } from "./store";
import type { EmbeddingProfileSummary } from "../db/embedding-queries";

export type EmbeddingsUseResult = ConfigWriteResult & {
  embeddings: EmbeddingSettings;
  next_action: {
    command: string;
    reason: string;
  };
};

export function formatEmbeddingStatusText(status: TrapEmbeddingStatus): string {
  const runtime = status.runtime.provider
    ? `${status.runtime.provider}/${status.runtime.model} (${status.runtime.dimensions}d)`
    : "unconfigured";
  const lines = [
    `Runtime: ${runtime}`,
    `Available: ${status.runtime.available ? "yes" : "no"}`,
    `Active profile: ${status.runtime.profile_id ?? "(none)"}`,
  ];

  if (status.runtime.setup_action) {
    lines.push(`Next setup: ${status.runtime.setup_action.command}`);
  }

  lines.push(...scopeStatusLines("Project", status.project));
  lines.push(...scopeStatusLines("Global", status.global));
  return lines.join("\n");
}

export function formatEmbeddingProfilesText(profiles: TrapEmbeddingProfiles): string {
  const lines = [
    ...profileSectionLines("Project", profiles.project),
    ...profileSectionLines("Global", profiles.global),
  ];
  return lines.length > 0 ? lines.join("\n") : "No stored embedding profiles.";
}

export function formatEmbeddingsUseText(result: EmbeddingsUseResult): string {
  return [
    `Configured embeddings provider: ${result.embeddings.provider}`,
    `Config: ${result.path}`,
    `Next: ${result.next_action.command}`,
  ].join("\n");
}

function scopeStatusLines(label: string, status: EmbeddingScopeStatus | null): string[] {
  if (!status) return [];
  return [
    "",
    `${label}: total ${status.total}, fresh ${status.fresh}, stale ${status.stale}, missing ${status.missing}`,
    ...profileSectionLines("Stored profiles", status.profiles),
  ];
}

function profileSectionLines(label: string, profiles: EmbeddingProfileSummary[] | null): string[] {
  if (!profiles || profiles.length === 0) return [];
  return [
    `${label}:`,
    ...profiles.map((profile) =>
      `  - ${profile.id} (${profile.embedding_count} embeddings, updated ${profile.updated_at ?? "unknown"})`
    ),
  ];
}
