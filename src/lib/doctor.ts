import type { TrapStore } from "./store";
import type { TrapOperations } from "./trap-operations";
import type { EmbeddingStatsResult, HybridFallbackReason } from "./embedding-health";
import { createScopeContext } from "./scope-context";
import { hybridFallbackReason } from "./embedding-health";

export type DoctorReport = {
  cwd: string;
  project_root: string | null;
  project_db: string | null;
  global_db: string;
  traps: {
    project: number | null;
    global: number;
  };
  embeddings: EmbeddingStatsResult;
  hybrid_search: {
    semantic_available: boolean;
    fallback_reason: HybridFallbackReason | null;
  };
  diagnostics: {
    mis_scoped_traps: {
      global_db_project_traps: ReturnType<TrapStore["diagnostics"]>["mis_scoped_traps"]["global_db_project_traps"];
    };
  };
  mcp_hint: string;
};

export function buildDoctorReport(
  store: TrapStore,
  operations: TrapOperations,
  cwd = process.cwd()
): DoctorReport {
  const scope = createScopeContext(cwd);
  const stats = operations.getStats();
  const embeddings = operations.getEmbeddingStats();
  const semanticAvailable = store.hasEmbeddingProvider();

  return {
    ...scope,
    traps: {
      project: stats.project?.total ?? null,
      global: stats.global?.total ?? 0,
    },
    embeddings,
    hybrid_search: {
      semantic_available: semanticAvailable,
      fallback_reason: hybridFallbackReason(semanticAvailable, embeddings),
    },
    diagnostics: {
      mis_scoped_traps: store.diagnostics().mis_scoped_traps,
    },
    mcp_hint: "Pass cwd in MCP tool calls, or restart codetrap serve after changing projects.",
  };
}

export function formatDoctorText(report: DoctorReport): string {
  return [
    `cwd: ${report.cwd}`,
    `project_root: ${report.project_root ?? "(none)"}`,
    `project_db: ${report.project_db ?? "(none)"}`,
    `global_db: ${report.global_db}`,
    `project_traps: ${report.traps.project ?? "(none)"}`,
    `global_traps: ${report.traps.global}`,
    "Embeddings:",
    formatEmbeddingStats("project", report.embeddings.project),
    formatEmbeddingStats("global", report.embeddings.global),
    "Hybrid search:",
    `  semantic_available: ${report.hybrid_search.semantic_available ? "yes" : "no"}`,
    `  fallback_reason: ${report.hybrid_search.fallback_reason ?? "(none)"}`,
    "Diagnostics:",
    `  global_db_project_traps: ${report.diagnostics.mis_scoped_traps.global_db_project_traps.length}`,
    `mcp_hint: ${report.mcp_hint}`,
  ].join("\n");
}

function formatEmbeddingStats(
  label: string,
  stats: EmbeddingStatsResult["global"] | null
): string {
  if (!stats) return `  ${label}: unavailable`;
  const provider = stats.provider_available
    ? `${stats.provider}/${stats.model}`
    : "unavailable";
  return `  ${label}: fresh=${stats.fresh}, stale=${stats.stale}, missing=${stats.missing}, total=${stats.total}, provider=${provider}`;
}
