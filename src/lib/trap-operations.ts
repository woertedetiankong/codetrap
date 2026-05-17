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
import type { TrapStore, TrapStats } from "./store";
import type { SearchMode } from "./constants";
import { toTrapActionCards } from "./search-result-card";

export type TrapListGroup = { traps: Trap[]; scope: string };
export type TrapSearchGroup = { results: TrapSearchResult[]; scope: string };
export type TrapMutationResult = { scope: string; success: boolean };
export type AddTrapEvidenceResult = {
  scope: string;
  evidence_id: number | null;
  success: boolean;
};

export type TrapStatsResult = { project: TrapStats | null; global: TrapStats };
export type EmbeddingStatsResult = ReturnType<TrapStore["embeddingStats"]>;

export interface SearchTrapsArgs {
  query: string;
  category?: string;
  scope?: string;
  limit?: number;
  mode?: SearchMode;
  status?: string;
}

export interface ListTrapsArgs {
  category?: string;
  scope?: string;
  limit?: number;
  offset?: number;
  status?: string;
}

export class TrapOperations {
  constructor(private readonly store: TrapStore) {}

  addTrap(args: Record<string, unknown>): { id: number; scope: string } {
    return this.store.add(buildTrapInput(args));
  }

  async searchTrapGroups(args: SearchTrapsArgs): Promise<TrapSearchGroup[]> {
    return this.store.search(args.query, {
      category: args.category,
      scope: args.scope,
      limit: args.limit ?? 20,
      mode: args.mode,
      status: parseTrapStatus(args.status),
    });
  }

  async searchTrapCards(args: SearchTrapsArgs): Promise<TrapActionCard[]> {
    return toTrapActionCards(await this.searchTrapGroups(args));
  }

  getTrapDetails(id: number, scope?: string): TrapDetails | null {
    return this.store.getDetails(id, scope);
  }

  hitTrap(id: number, scope?: string): void {
    this.store.hit(id, scope);
  }

  listTraps(args: ListTrapsArgs = {}): TrapListGroup[] {
    return this.store.list({
      category: args.category,
      scope: args.scope,
      status: parseTrapStatus(args.status),
      limit: args.limit ?? 50,
      offset: args.offset,
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

  getStats(): TrapStatsResult {
    return this.store.stats();
  }

  getEmbeddingStats(): EmbeddingStatsResult {
    return this.store.embeddingStats();
  }

  exportTraps(scope?: string): ReturnType<TrapStore["exportAll"]> {
    return this.store.exportAll({ scope });
  }

  importTraps(records: TrapImportRecord[]): number {
    return this.store.importAll(records);
  }
}
