import {
  buildTrapEvidenceInput,
  buildTrapInput,
  parseTrapStatus,
  pickTrapUpdate,
  type Trap,
  type TrapActionCard,
  type TrapDetails,
  type TrapImportRecord,
  type TrapSearchResult,
} from "../domain/trap";
import type { ScopedSearchDiagnostic, TrapStore, TrapStats } from "./store";
import type { SearchMode } from "./constants";
import { toTrapActionCards } from "./search-result-card";
import type { AddTrapEvidenceResult, TrapMutationResult } from "./trap-mutation-result";
import {
  ObservationRunRecorder,
  type ObservationCallContext,
} from "./observation-recorder";
import { activeAgentObservationContext } from "./agent-observation";

export type TrapListGroup = { traps: Trap[]; scope: string };
export type TrapSearchGroup = { results: TrapSearchResult[]; scope: string };
export type TrapSearchOutcome = { groups: TrapSearchGroup[]; diagnostics: ScopedSearchDiagnostic[] };
export type TrapSearchCards = { cards: TrapActionCard[]; diagnostics: ScopedSearchDiagnostic[] };
export type { AddTrapEvidenceResult, TrapMutationResult };

export type TrapStatsResult = { project: TrapStats | null; global: TrapStats | null };
export type EmbeddingStatsResult = ReturnType<TrapStore["embeddingStats"]>;

export interface SearchTrapsArgs {
  query: string;
  category?: string;
  scope?: string;
  limit?: number;
  mode?: SearchMode;
  status?: string;
  path?: string;
  module?: string;
  owner?: string;
  rerank?: boolean;
  includeRankingSignals?: boolean;
  observation?: ObservationCallContext;
}

export interface ListTrapsArgs {
  category?: string;
  scope?: string;
  limit?: number;
  offset?: number;
  status?: string;
  path?: string;
  module?: string;
  owner?: string;
}

export class TrapOperations {
  constructor(private readonly store: TrapStore) {}

  addTrap(args: Record<string, unknown>): { id: number; scope: string } {
    return this.store.add(buildTrapInput(args));
  }

  async searchTrapGroups(args: SearchTrapsArgs): Promise<TrapSearchOutcome> {
    const started = performance.now();
    const outcome = await this.store.search(args.query, {
      category: args.category,
      scope: args.scope,
      limit: args.limit ?? 20,
      mode: args.mode,
      status: parseTrapStatus(args.status),
      path: args.path,
      module: args.module,
      owner: args.owner,
      rerank: args.rerank,
      includeRankingSignals: args.includeRankingSignals,
    });
    const projectRoot = this.store.getProjectRoot();
    const observation = args.observation ?? (projectRoot ? activeAgentObservationContext(projectRoot) : undefined);
    if (observation) {
      if (!projectRoot) {
        outcome.diagnostics.push(observationDiagnostic());
      } else {
        try {
          const results = outcome.groups
            .flatMap((group) => group.results.map((result) => ({ result, scope: group.scope })))
            .map(({ result, scope }, index) => ({
              trap_id: result.trap.id,
              revision: `${scope}:${result.trap.updated_at}`,
              rank: index + 1,
            }));
          const recorded = new ObservationRunRecorder(projectRoot).search(observation, {
            query: args.query,
            mode: args.mode ?? "hybrid",
            path: args.path ?? null,
            module: args.module ?? null,
            results,
            diagnostics: outcome.diagnostics.map((diagnostic) => diagnostic.code),
            duration_ms: Math.max(0, performance.now() - started),
          });
          if (!recorded.success) outcome.diagnostics.push(observationDiagnostic());
        } catch {
          outcome.diagnostics.push(observationDiagnostic());
        }
      }
    }
    return outcome;
  }

  async searchTrapCards(args: SearchTrapsArgs): Promise<TrapSearchCards> {
    const outcome = await this.searchTrapGroups(args);
    return {
      cards: toTrapActionCards(outcome.groups),
      diagnostics: outcome.diagnostics,
    };
  }

  embedTrapBestEffort(id: number, scope: string): Promise<boolean> {
    return this.store.embedTrapBestEffort(id, scope);
  }

  getTrapDetails(id: number, scope?: string): TrapDetails | null {
    return this.store.getDetails(id, scope);
  }

  hitTrap(id: number, scope?: string): void {
    this.store.hit(id, scope);
  }

  /**
   * Records that a recalled lesson actually helped. Deliberately separate from
   * `hitTrap`: a view is not evidence of usefulness, and conflating them would
   * make the §17 falsifier unfalsifiable — every search would look successful.
   */
  markTrapUseful(
    id: number,
    scope?: string,
    now = new Date(),
    observation?: ObservationCallContext
  ): { success: boolean; scope?: string; observation_warning?: string } {
    const marked = this.store.markUseful(id, scope, now);
    if (!marked.success) return marked;
    const projectRoot = this.store.getProjectRoot();
    const context = observation ?? (projectRoot ? activeAgentObservationContext(projectRoot) : undefined);
    if (!context) return marked;
    if (!projectRoot) return { ...marked, observation_warning: observationDiagnostic().message };
    try {
      const details = this.getTrapDetails(id, marked.scope);
      const recorded = new ObservationRunRecorder(projectRoot).feedback({
        ...context,
        trap_id: id,
        revision: details ? `${details.scope}:${details.trap.updated_at}` : null,
        feedback: "helpful",
        note: null,
      });
      return recorded.success
        ? marked
        : { ...marked, observation_warning: recorded.warning ?? observationDiagnostic().message };
    } catch {
      return { ...marked, observation_warning: observationDiagnostic().message };
    }
  }

  validateTrap(id: number, scope?: string, now = new Date()) {
    return this.store.validate(id, scope, now);
  }

  graduateTrap(id: number, target: string, scope?: string, now = new Date()) {
    return this.store.graduate(id, target, scope, now);
  }

  listTraps(args: ListTrapsArgs = {}): TrapListGroup[] {
    return this.store.list({
      category: args.category,
      scope: args.scope,
      status: parseTrapStatus(args.status),
      limit: args.limit ?? 50,
      offset: args.offset,
      path: args.path,
      module: args.module,
      owner: args.owner,
    });
  }

  topTraps(scope: string, limit = 20): TrapListGroup[] {
    return [{ traps: this.store.topTraps(scope, limit), scope }];
  }

  updateTrap(
    id: number,
    args: Record<string, unknown>,
    scope?: string
  ): TrapMutationResult {
    return this.store.update(id, pickTrapUpdate(args), scope);
  }

  deleteTrap(id: number, scope?: string): TrapMutationResult {
    return this.store.delete(id, scope);
  }

  addTrapEvidence(
    id: number,
    args: Record<string, unknown>,
    scope?: string
  ): AddTrapEvidenceResult {
    return this.store.addEvidence(id, buildTrapEvidenceInput(args), scope);
  }

  archiveTrap(id: number, scope?: string): TrapMutationResult {
    return this.store.archive(id, scope);
  }

  supersedeTrap(
    id: number,
    supersededById: number,
    scope?: string,
    stateKey?: string
  ): TrapMutationResult {
    return this.store.supersede(id, supersededById, scope, stateKey);
  }

  transaction<T>(scope: string, callback: () => T): T {
    return this.store.transaction(scope, callback);
  }

  getStats(scope?: string): TrapStatsResult {
    return this.store.stats({ scope });
  }

  getEmbeddingStats(scope?: string): EmbeddingStatsResult {
    return this.store.embeddingStats({ scope });
  }

  exportTraps(scope?: string): ReturnType<TrapStore["exportAll"]> {
    return this.store.exportAll({ scope });
  }

  importTraps(records: TrapImportRecord[]): ReturnType<TrapStore["importAll"]> {
    return this.store.importAll(records);
  }
}

function observationDiagnostic(): ScopedSearchDiagnostic {
  return {
    code: "observation_write_failed",
    message: "Observation sidecar could not record this operation; the primary Codetrap result is unchanged.",
    scope: "project",
  };
}
