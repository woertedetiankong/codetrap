import type { Database } from "bun:sqlite";
import type { Trap, TrapInput, TrapSearchResult, TrapUpdate } from "../domain/trap";
import * as queries from "./queries";

export type TrapStats = ReturnType<typeof queries.getStats>;

export class TrapRepository {
  constructor(private readonly db: Database) {}

  add(input: TrapInput): number {
    return queries.insertTrap(this.db, input);
  }

  search(query: string, opts: { category?: string; scope?: string; limit?: number } = {}): TrapSearchResult[] {
    return queries.searchTraps(this.db, query, opts);
  }

  get(id: number): Trap | null {
    return queries.getTrap(this.db, id);
  }

  list(opts: { category?: string; scope?: string; limit?: number; offset?: number } = {}): Trap[] {
    return queries.listTraps(this.db, opts);
  }

  update(id: number, input: TrapUpdate): boolean {
    return queries.updateTrap(this.db, id, input);
  }

  delete(id: number): boolean {
    return queries.deleteTrap(this.db, id);
  }

  hit(id: number): void {
    queries.incrementHitCount(this.db, id);
  }

  top(scope: string, limit = 20): Trap[] {
    return queries.getTopTraps(this.db, scope, limit);
  }

  stats(): TrapStats {
    return queries.getStats(this.db);
  }

  exportAll(): Trap[] {
    return queries.exportTraps(this.db);
  }
}
