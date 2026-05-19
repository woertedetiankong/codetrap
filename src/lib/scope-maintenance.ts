import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { TrapRepository } from "../db/repository";
import { CODETRAP_DIR, TRAPS_DB_FILE } from "./constants";
import { ScopePathResolver } from "./scope-path";

const scopePath = new ScopePathResolver();

export type ScopeMaintenanceCommand = "repair-scope" | "migrate-project";

export type ScopeMaintenancePaths = {
  command: ScopeMaintenanceCommand;
  fromProjectPath: string;
  toProjectPath: string;
  sourceDb: string;
  destinationDb: string;
};

export function buildScopeMaintenancePaths(input: {
  command: ScopeMaintenanceCommand;
  fromProjectPath: string;
  toProjectPath: string;
}): ScopeMaintenancePaths {
  return {
    command: input.command,
    fromProjectPath: input.fromProjectPath,
    toProjectPath: input.toProjectPath,
    sourceDb: projectDbPath(input.fromProjectPath),
    destinationDb: projectDbPath(input.toProjectPath),
  };
}

export function validateScopeMaintenancePaths(input: ScopeMaintenancePaths): void {
  if (input.command === "migrate-project" && scopePath.same(input.fromProjectPath, input.toProjectPath)) {
    throw new Error("--from-project-path and --to-project-path must be different.");
  }
  if (scopePath.same(input.sourceDb, input.destinationDb)) {
    throw new Error("Source and destination database paths are the same.");
  }
  if (!existsSync(scopePath.join(input.toProjectPath, CODETRAP_DIR))) {
    throw new Error(`Destination project is not initialized: ${input.toProjectPath}. Run 'codetrap init' first.`);
  }
}

export function projectDbPath(projectPath: string): string {
  return scopePath.join(projectPath, CODETRAP_DIR, TRAPS_DB_FILE);
}

export function withReadOnlyScopeRepository<T>(dbPath: string, callback: (repository: TrapRepository) => T): T {
  const db = new Database(dbPath, { readonly: true });
  try {
    return callback(new TrapRepository(db));
  } finally {
    db.close();
  }
}

export function backupScopeDatabase(dbPath: string, label: string): string {
  const backupDir = join(dirname(dbPath), "backups");
  mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(backupDir, `${basename(dbPath)}.${label}.${timestamp}.backup`);
  const db = new Database(dbPath, { readonly: true });
  try {
    writeFileSync(backupPath, db.serialize());
  } finally {
    db.close();
  }
  return backupPath;
}
