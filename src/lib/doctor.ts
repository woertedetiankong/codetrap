import type { TrapStore } from "./store";
import type { TrapOperations } from "./trap-operations";
import type { EmbeddingRuntimeStatus } from "./embedding-runtime";
import type { EmbeddingStateSummary, EmbeddingStatsResult, HybridFallbackReason } from "./embedding-health";
import { createScopeContext } from "./scope-context";
import { defaultScopePathResolver } from "./scope-path";
import { hybridFallbackReason } from "./embedding-health";
import type { ProjectCandidateReviewSummary } from "./session-review";
import type { ProjectIdentity } from "./project-identity";
import { allClientHealth, clientNextActions, formatClientHealthText, type ClientHealth } from "./client-health";
import { CODETRAP_VERSION } from "./version";

export type DoctorNextAction = {
  command: string;
  reason: string;
};

export type DoctorReport = {
  version: string;
  cwd: string;
  project_root: string | null;
  project_db: string | null;
  global_db: string;
  // A1: stable project identity (from .codetrap/project.json). `project_id` is
  // null outside a project or when the identity file is unreadable;
  // `project_moved` is true when the recorded creation path no longer matches the
  // current root — proof that identity is the id, not the (display-only) path.
  project_id: string | null;
  project_moved: boolean;
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
  candidate_review: ProjectCandidateReviewSummary | null;
  // §13.3: per-client (codex/claude) integration health — skills, guidance,
  // MCP registration — so a broken or stale client install is visible here
  // instead of failing silently at the next agent session.
  clients: ClientHealth[];
  next_actions: DoctorNextAction[];
  mcp_hint: string;
};

export async function buildDoctorReport(
  store: TrapStore,
  operations: TrapOperations,
  cwd = process.cwd(),
  candidateReview: ProjectCandidateReviewSummary | null = null
): Promise<DoctorReport> {
  const scope = createScopeContext(cwd);
  const stats = operations.getStats();
  const embeddings = operations.getEmbeddingStats();
  const embeddingRuntime = await store.embeddingRuntimeHealth();
  const semanticAvailable = embeddingRuntime.available;
  const diagnostics = store.diagnostics();
  const identity = safeProjectIdentity(store);
  const clients = allClientHealth(scope.project_root);

  return {
    version: CODETRAP_VERSION,
    ...scope,
    project_id: identity?.id ?? null,
    project_moved: projectMoved(identity, scope.project_root),
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
      mis_scoped_traps: diagnostics.mis_scoped_traps,
    },
    candidate_review: candidateReview,
    clients,
    next_actions: [
      ...buildDoctorNextActions(embeddingRuntime, embeddings, diagnostics, candidateReview),
      ...clientNextActions(clients),
    ],
    mcp_hint: "Pass cwd in MCP tool calls, or restart codetrap serve after changing projects.",
  };
}

function safeProjectIdentity(store: TrapStore): ProjectIdentity | null {
  try {
    return store.projectIdentity();
  } catch {
    // A corrupt/unwritable project.json must not crash `doctor` — it is the
    // command a user runs to diagnose exactly that kind of problem.
    return null;
  }
}

function projectMoved(identity: ProjectIdentity | null, projectRoot: string | null): boolean {
  if (!identity || !identity.path || !projectRoot) return false;
  return !defaultScopePathResolver.same(identity.path, projectRoot);
}

export function formatDoctorText(report: DoctorReport): string {
  return [
    `codetrap: ${report.version}`,
    `cwd: ${report.cwd}`,
    `project_root: ${report.project_root ?? "(none)"}`,
    `project_db: ${report.project_db ?? "(none)"}`,
    `global_db: ${report.global_db}`,
    `project_id: ${report.project_id ?? "(none)"}${report.project_moved ? " (project moved; id is stable, path is display-only)" : ""}`,
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
    "Candidate review:",
    formatCandidateReview(report.candidate_review),
    "Clients:",
    ...formatClientHealthText(report.clients),
    "Next actions:",
    ...formatNextActions(report.next_actions),
    `mcp_hint: ${report.mcp_hint}`,
  ].join("\n");
}

function buildDoctorNextActions(
  embeddingRuntime: EmbeddingRuntimeStatus,
  embeddings: EmbeddingStatsResult,
  diagnostics: ReturnType<TrapStore["diagnostics"]>,
  candidateReview: ProjectCandidateReviewSummary | null
): DoctorNextAction[] {
  const actions: DoctorNextAction[] = [];
  if (!embeddingRuntime.available) {
    if (embeddingRuntime.setup_action) actions.push(embeddingRuntime.setup_action);
  } else {
    const projectAction = embeddingRefreshAction("project", embeddings.project);
    const globalAction = embeddingRefreshAction("global", embeddings.global);
    if (projectAction) actions.push(projectAction);
    if (globalAction) actions.push(globalAction);
  }

  const stranded = diagnostics.mis_scoped_traps.global_db_project_traps.length;
  if (stranded > 0) {
    actions.push({
      command: "codetrap repair-scope --dry-run --json",
      reason: `${stranded} project-scoped trap(s) are stored in the global database.`,
    });
  }
  if (candidateReview && candidateReview.pending_count > 0) {
    if (candidateReview.next_session_id) {
      actions.push({
        command: `codetrap session candidates ${candidateReview.next_session_id} --json`,
        reason: `${candidateReview.pending_count} pending candidate trap(s) need review.`,
      });
    }
    actions.push({
      command: "codetrap web",
      reason: "Open the candidate review console.",
    });
  }
  return actions;
}

function embeddingRefreshAction(
  scope: "project" | "global",
  stats: EmbeddingStateSummary | null
): DoctorNextAction | null {
  if (!stats || stats.total === 0) return null;
  const needsRefresh = stats.missing + stats.stale;
  if (needsRefresh === 0) return null;
  const parts = [
    stats.missing > 0 ? `${stats.missing} missing` : null,
    stats.stale > 0 ? `${stats.stale} stale` : null,
  ].filter((item): item is string => item !== null);
  return {
    command: `codetrap embed --scope ${scope}`,
    reason: `${scope} embeddings need refresh (${parts.join(", ")}).`,
  };
}

function formatNextActions(actions: DoctorNextAction[]): string[] {
  if (actions.length === 0) return ["  (none)"];
  return actions.map((action) => `  - ${action.command} # ${action.reason}`);
}

function formatCandidateReview(summary: ProjectCandidateReviewSummary | null): string {
  if (!summary) return "  unavailable";
  return [
    `  pending=${summary.pending_count}`,
    `reviewed=${summary.reviewed_count}`,
    `sessions=${summary.pending_session_count}/${summary.session_count}`,
    `high_quality_pending=${summary.high_quality_pending_count}`,
    `needs_edit=${summary.needs_edit_count}`,
    `next_session=${summary.next_session_id ?? "(none)"}`,
  ].join(", ");
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
