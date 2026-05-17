import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { openDatabase } from "../db/connection";
import { TrapRepository } from "../db/repository";
import type { TrapExportRecord } from "../domain/trap";
import { CODETRAP_DIR, TRAPS_DB_FILE } from "./constants";
import { findProjectRoot } from "./scope";
import {
  deleteTransferredSourceTraps,
  importProjectTrapTransfer,
  type TrapTransferMapping,
} from "./trap-transfer";

export type ScopeMigrationCommand = "repair-scope" | "migrate-project";
export type ScopeMigrationMode = "dry-run" | "apply";

export type ScopeMigrationCandidate = {
  id: number;
  title: string;
  category: string;
  severity: string;
  status: string;
  project_path: string | null;
};

export type ScopeMigrationCounts = {
  source_before: number;
  source_after: number;
  destination_before: number;
  destination_after: number;
  candidates: number;
  moved: number;
};

export type ScopeMigrationBackups = {
  source_db: string | null;
  destination_db: string | null;
};

export type ScopeMigrationResult = {
  command: ScopeMigrationCommand;
  mode: ScopeMigrationMode;
  from_project_path: string;
  to_project_path: string;
  source_db: string;
  destination_db: string;
  source_db_exists: boolean;
  destination_db_exists: boolean;
  candidates: ScopeMigrationCandidate[];
  moved: TrapTransferMapping[];
  backups: ScopeMigrationBackups;
  counts: ScopeMigrationCounts;
  next_action: { command: string } | null;
};

export type ScopeMigrationOptions = {
  command: ScopeMigrationCommand;
  cwd?: string;
  fromProjectPath?: string;
  toProjectPath?: string;
  apply?: boolean;
};

type ResolvedScopeMigration = {
  command: ScopeMigrationCommand;
  mode: ScopeMigrationMode;
  apply: boolean;
  fromProjectPath: string;
  toProjectPath: string;
  sourceDb: string;
  destinationDb: string;
};

type ScopeMigrationPlan = ResolvedScopeMigration & {
  sourceDbExists: boolean;
  destinationDbExists: boolean;
  records: TrapExportRecord[];
  sourceBefore: number;
  destinationBefore: number;
};

type ScopeMigrationApplyResult = {
  moved: TrapTransferMapping[];
  backups: ScopeMigrationBackups;
  sourceAfter: number;
  destinationAfter: number;
};

export function runScopeMigration(options: ScopeMigrationOptions): ScopeMigrationResult {
  const plan = buildScopeMigrationPlan(options);

  if (!plan.apply || plan.records.length === 0) {
    return buildScopeMigrationResult(plan, {
      moved: [],
      backups: { source_db: null, destination_db: null },
      sourceAfter: plan.sourceBefore,
      destinationAfter: plan.destinationBefore,
    });
  }

  return buildScopeMigrationResult(plan, applyScopeMigrationPlan(plan));
}

export function formatScopeMigrationText(result: ScopeMigrationResult): string {
  const lines = [
    `${result.command} ${result.mode}`,
    `from_project_path: ${result.from_project_path}`,
    `to_project_path: ${result.to_project_path}`,
    `source_db: ${result.source_db}${result.source_db_exists ? "" : " (missing)"}`,
    `destination_db: ${result.destination_db}${result.destination_db_exists ? "" : " (missing)"}`,
    `candidates: ${result.counts.candidates}`,
  ];

  if (result.candidates.length > 0) {
    lines.push("candidate traps:");
    lines.push(...result.candidates.map((trap) =>
      `  #${trap.id} [${trap.severity}] [${trap.category}] [${trap.status}] ${trap.title}`
    ));
  }

  if (result.mode === "apply") {
    lines.push(`moved: ${result.counts.moved}`);
    if (result.backups.source_db || result.backups.destination_db) {
      lines.push("backups:");
      if (result.backups.source_db) lines.push(`  source_db: ${result.backups.source_db}`);
      if (result.backups.destination_db) lines.push(`  destination_db: ${result.backups.destination_db}`);
    }
    if (result.moved.length > 0) {
      lines.push("id mapping:");
      lines.push(...result.moved.map((item) =>
        `  #${item.source_id} -> #${item.destination_id} ${item.title}`
      ));
    }
  }

  lines.push(
    `source_count: ${result.counts.source_before} -> ${result.counts.source_after}`,
    `destination_count: ${result.counts.destination_before} -> ${result.counts.destination_after}`
  );

  if (result.next_action) {
    lines.push(`Next: ${result.next_action.command}`);
  }
  if (result.candidates.length === 0) {
    lines.push("No matching project traps found.");
  }
  return lines.join("\n");
}

function buildScopeMigrationPlan(options: ScopeMigrationOptions): ScopeMigrationPlan {
  const resolved = resolveScopeMigrationOptions(options);
  validateMigrationPaths(resolved);
  const sourceDbExists = existsSync(resolved.sourceDb);
  const destinationDbExists = existsSync(resolved.destinationDb);
  const records = sourceDbExists
    ? withReadOnlyRepository(resolved.sourceDb, (repository) =>
        repository.exportProjectTrapsByPath(resolved.fromProjectPath)
      )
    : [];
  const destinationBefore = destinationDbExists
    ? withReadOnlyRepository(resolved.destinationDb, (repository) =>
        repository.countProjectTrapsByPath(resolved.toProjectPath)
      )
    : 0;

  return {
    ...resolved,
    sourceDbExists,
    destinationDbExists,
    records,
    sourceBefore: records.length,
    destinationBefore,
  };
}

function applyScopeMigrationPlan(plan: ScopeMigrationPlan): ScopeMigrationApplyResult {
  const backups = {
    source_db: backupDatabase(plan.sourceDb, "source"),
    destination_db: plan.destinationDbExists ? backupDatabase(plan.destinationDb, "destination") : null,
  };

  const applyResult = applyScopeMigration(
    plan.sourceDb,
    plan.destinationDb,
    plan.fromProjectPath,
    plan.toProjectPath
  );

  return {
    moved: applyResult.moved,
    backups,
    sourceAfter: applyResult.sourceAfter,
    destinationAfter: applyResult.destinationAfter,
  };
}

function resolveScopeMigrationOptions(options: ScopeMigrationOptions): ResolvedScopeMigration {
  const cwd = resolve(options.cwd ?? process.cwd());
  const projectRoot = findProjectRoot(cwd);
  const fromProjectPath = resolve(options.fromProjectPath ?? homedir());
  const rawToProjectPath = options.toProjectPath ?? projectRoot;

  if (!rawToProjectPath) {
    throw new Error("Destination project not found. Run 'codetrap init' first, or pass --to-project-path.");
  }
  const toProjectPath = resolve(rawToProjectPath);

  return {
    command: options.command,
    mode: options.apply ? "apply" : "dry-run",
    apply: options.apply === true,
    fromProjectPath,
    toProjectPath,
    sourceDb: projectDbPath(fromProjectPath),
    destinationDb: projectDbPath(toProjectPath),
  };
}

function validateMigrationPaths(input: {
  command: ScopeMigrationCommand;
  fromProjectPath: string;
  toProjectPath: string;
  sourceDb: string;
  destinationDb: string;
}): void {
  if (input.command === "migrate-project" && input.fromProjectPath === input.toProjectPath) {
    throw new Error("--from-project-path and --to-project-path must be different.");
  }
  if (canonicalPath(input.sourceDb) === canonicalPath(input.destinationDb)) {
    throw new Error("Source and destination database paths are the same.");
  }
  if (!existsSync(join(input.toProjectPath, CODETRAP_DIR))) {
    throw new Error(`Destination project is not initialized: ${input.toProjectPath}. Run 'codetrap init' first.`);
  }
}

function applyScopeMigration(
  sourceDbPath: string,
  destinationDbPath: string,
  fromProjectPath: string,
  toProjectPath: string
): { moved: TrapTransferMapping[]; sourceAfter: number; destinationAfter: number } {
  const sourceDb = openDatabase(sourceDbPath);
  const destinationDb = openDatabase(destinationDbPath);
  try {
    const sourceRepository = new TrapRepository(sourceDb);
    const destinationRepository = new TrapRepository(destinationDb);
    const records = sourceRepository.exportProjectTrapsByPath(fromProjectPath);
    const moved = importProjectTrapTransfer(destinationRepository, records, toProjectPath);
    const deleted = deleteTransferredSourceTraps(sourceRepository, records);
    if (deleted !== records.length) {
      throw new Error(`Expected to delete ${records.length} source traps, deleted ${deleted}.`);
    }

    return {
      moved,
      sourceAfter: sourceRepository.countProjectTrapsByPath(fromProjectPath),
      destinationAfter: destinationRepository.countProjectTrapsByPath(toProjectPath),
    };
  } finally {
    sourceDb.close();
    destinationDb.close();
  }
}

function buildScopeMigrationResult(
  plan: ScopeMigrationPlan,
  applied: ScopeMigrationApplyResult
): ScopeMigrationResult {
  const candidates = plan.records.map(toCandidate);
  return {
    command: plan.command,
    mode: plan.mode,
    from_project_path: plan.fromProjectPath,
    to_project_path: plan.toProjectPath,
    source_db: plan.sourceDb,
    destination_db: plan.destinationDb,
    source_db_exists: plan.sourceDbExists,
    destination_db_exists: plan.destinationDbExists,
    candidates,
    moved: applied.moved,
    backups: applied.backups,
    counts: {
      source_before: plan.sourceBefore,
      source_after: applied.sourceAfter,
      destination_before: plan.destinationBefore,
      destination_after: applied.destinationAfter,
      candidates: candidates.length,
      moved: applied.moved.length,
    },
    next_action: plan.mode === "dry-run" && candidates.length > 0
      ? { command: buildApplyCommand(plan.command, plan.fromProjectPath, plan.toProjectPath) }
      : null,
  };
}

function toCandidate(record: TrapExportRecord): ScopeMigrationCandidate {
  return {
    id: record.id,
    title: record.title,
    category: record.category,
    severity: record.severity,
    status: record.status,
    project_path: record.project_path,
  };
}

function withReadOnlyRepository<T>(dbPath: string, callback: (repository: TrapRepository) => T): T {
  const db = new Database(dbPath, { readonly: true });
  try {
    return callback(new TrapRepository(db));
  } finally {
    db.close();
  }
}

function backupDatabase(dbPath: string, label: string): string {
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

function buildApplyCommand(
  command: ScopeMigrationCommand,
  fromProjectPath: string,
  toProjectPath: string
): string {
  return [
    "codetrap",
    command,
    "--from-project-path",
    shellQuote(fromProjectPath),
    "--to-project-path",
    shellQuote(toProjectPath),
    "--apply",
    "--json",
  ].join(" ");
}

function projectDbPath(projectPath: string): string {
  return join(projectPath, CODETRAP_DIR, TRAPS_DB_FILE);
}

function canonicalPath(path: string): string {
  return existsSync(path) ? realpathSync(path) : path;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
