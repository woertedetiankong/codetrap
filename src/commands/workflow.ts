import { readFileSync } from "node:fs";
import { TrapStore } from "../lib/store";
import { formatTrapShort, formatTrapDetails, formatTrapActionCard } from "../lib/format";
import type { Trap } from "../domain/trap";
import type { SessionMetadata } from "../domain/session";
import {
  formatScopeMigrationText,
  runScopeMigration,
  type ScopeMigrationCommand,
} from "../lib/scope-migration";
import { TrapOperations } from "../lib/trap-operations";
import { buildDoctorReport, formatDoctorText } from "../lib/doctor";
import { formatEmbedText } from "../lib/embed-output";
import { searchDefaultsFromConfig } from "../lib/config";
import { SessionStore } from "../lib/session-store";
import { SessionOperations, type SessionConflictResult } from "../lib/session-operations";
import {
  CANDIDATES_FILE,
  NOTES_FILE,
  RECAP_FILE,
  sessionRelativeDir,
  sessionRelativeFile,
} from "../lib/session-codec";
import {
  toCliSearchJson,
  toListJson,
  toStatsJson,
  toTrapDetailsJson,
} from "../lib/output-json";
import {
  errorResult,
  jsonResult,
  textResult,
  type CommandResult,
} from "./command-result";
import { mutationJsonPayload } from "../lib/trap-mutation-result";
import {
  embedRequestFromArgs,
  evidenceRequestFromArgs,
  listRequestFromArgs,
  searchRequestFromArgs,
  sessionAcceptRequestFromArgs,
  sessionCandidateRequestFromArgs,
  sessionCloseRequestFromArgs,
  sessionIdRequestFromArgs,
  sessionListRequestFromArgs,
  sessionNoteRequestFromArgs,
  sessionPruneRequestFromArgs,
  sessionRejectRequestFromArgs,
  sessionShowRequestFromArgs,
  sessionStartRequestFromArgs,
  statsRequestFromArgs,
} from "../lib/command-requests";

type ParsedArgs = {
  opts: Record<string, string>;
  positionals: string[];
};

export async function executeCommand(strip: string[], store: TrapStore): Promise<CommandResult> {
  const sub = strip[0];
  const args = strip.slice(1);
  const operations = new TrapOperations(store);

  switch (sub) {
    case "add":
      return cmdAdd(args, operations);
    case "search":
      return cmdSearch(args, operations);
    case "list":
      return cmdList(args, operations);
    case "show":
      return cmdShow(args, operations);
    case "edit":
      return cmdEdit(args, operations);
    case "delete":
    case "rm":
      return cmdDelete(args, operations);
    case "add_trap_evidence":
    case "add-evidence":
      return cmdAddTrapEvidence(args, operations);
    case "archive_trap":
    case "archive":
      return cmdArchiveTrap(args, operations);
    case "supersede_trap":
    case "supersede":
      return cmdSupersedeTrap(args, operations);
    case "init":
      return cmdInit(args, store);
    case "export":
      return cmdExport(args, operations);
    case "import":
      return cmdImport(args, operations);
    case "stats":
      return cmdStats(args, operations);
    case "doctor":
      return cmdDoctor(args, store, operations);
    case "repair-scope":
      return cmdScopeMigration("repair-scope", args, operations);
    case "migrate-project":
      return cmdScopeMigration("migrate-project", args, operations);
    case "embed":
      return cmdEmbed(args, store);
    case "session":
      return cmdSession(args, store, operations);
    default:
      return errorResult([
        `Unknown command: ${sub}`,
        "Commands: init, add, search, list, show, edit, delete, add_trap_evidence, archive_trap, supersede_trap, export, import, stats, doctor, repair-scope, migrate-project, embed, session",
      ].join("\n"));
  }
}

export function parseArgs(args: string[]): ParsedArgs {
  const opts: Record<string, string> = {};
  const positionals: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
      opts[key] = val;
    } else {
      positionals.push(args[i]);
    }
  }
  return { opts, positionals };
}

function cmdInit(_args: string[], store: TrapStore): CommandResult {
  if (store.hasProject()) {
    return textResult(`Already in a project: ${store.getProjectRoot()}`);
  }
  return textResult("Project initialized.");
}

function cmdAdd(args: string[], operations: TrapOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  if (opts.json !== undefined) {
    if (!opts.json || opts.json === "true") {
      return errorResult("Error: --json requires a JSON string argument");
    }
    try {
      const result = operations.addTrap(JSON.parse(opts.json));
      return opts["output-json"] !== undefined
        ? jsonResult(result)
        : textResult(`Trap #${result.id} added to ${result.scope} scope.`);
    } catch (error) {
      return errorFrom(error);
    }
  }

  if (positionals.length > 0) {
    return textResult([
      "Use --json mode for structured input.",
      `Quick add: codetrap add --json '{"title":"${positionals.join(" ")}","category":"other","scope":"global","context":"...","mistake":"...","fix":"..."}'`,
    ].join("\n"));
  }

  return textResult([
    "Interactive mode not yet implemented. Use --json for now.",
    'Example: codetrap add --json \'{"title":"...","category":"convention","scope":"project","context":"...","mistake":"...","fix":"..."}\'',
  ].join("\n"));
}

async function cmdSearch(args: string[], operations: TrapOperations): Promise<CommandResult> {
  const { opts, positionals } = parseArgs(args);
  const query = readQuery(positionals);
  if (!query) {
    return errorResult("Usage: codetrap search <query> [--category X] [--limit N] [--mode fts|semantic|hybrid] [--status active|superseded|archived|all] [--path file] [--module name] [--owner name] [--json]");
  }

  try {
    const defaults = searchDefaultsFromConfig();
    const cards = await operations.searchTrapCards(searchRequestFromArgs(query, opts, defaults));
    if (opts.json !== undefined) return jsonResult(toCliSearchJson(cards));
    return textResult(cards.length > 0 ? cards.map(formatTrapActionCard).join("\n\n") : "No traps found.");
  } catch (error) {
    return errorFrom(error);
  }
}

function cmdList(args: string[], operations: TrapOperations): CommandResult {
  const { opts } = parseArgs(args);
  try {
    const groups = operations.listTraps(listRequestFromArgs(opts));
    if (opts.json !== undefined) return jsonResult(toListJson(groups));

    const lines = groups.flatMap((group) =>
      group.traps.map((trap) => formatTrapShort(trap, group.scope))
    );
    return textResult(lines.length > 0 ? lines.join("\n") : "No traps found.");
  } catch (error) {
    return errorFrom(error);
  }
}

function cmdShow(args: string[], operations: TrapOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const id = parseId(positionals[0], "Usage: codetrap show <id> [--scope project|global] [--json]");
  if (typeof id !== "number") return id;

  const result = operations.getTrapDetails(id, opts.scope);
  if (!result) return errorResult(`Trap #${id} not found.`);

  operations.hitTrap(id, result.scope);
  return opts.json !== undefined
    ? jsonResult(toTrapDetailsJson(result))
    : textResult(formatTrapDetails(result));
}

function cmdEdit(args: string[], operations: TrapOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const id = parseId(positionals[0], "Usage: codetrap edit <id> --json '{\"title\":\"new title\"}' [--scope project|global]");
  if (typeof id !== "number") return id;

  if (!opts.json) {
    return errorResult([
      "Error: edit requires --json for now.",
      "Example: codetrap edit 1 --json '{\"title\":\"new title\"}' [--scope project|global]",
    ].join("\n"));
  }

  try {
    const result = operations.updateTrap(id, JSON.parse(opts.json), opts.scope);
    if (!result.success) return errorResult(`Trap #${id} not found or no fields changed.`);
    return opts["output-json"] !== undefined
      ? jsonResult({ id, ...result })
      : textResult(`Trap #${id} updated in ${result.scope} scope.`);
  } catch (error) {
    return errorFrom(error);
  }
}

function cmdDelete(args: string[], operations: TrapOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const id = parseId(positionals[0], "Usage: codetrap delete <id> [--scope project|global] [--json]");
  if (typeof id !== "number") return id;

  const result = operations.deleteTrap(id, opts.scope);
  if (opts.json !== undefined) {
    return mutationJsonResult({ id, ...result }, `Trap #${id} not found.`);
  }
  return result.success
    ? textResult(`Trap #${id} deleted from ${result.scope} scope.`)
    : errorResult(`Trap #${id} not found.`);
}

function cmdAddTrapEvidence(args: string[], operations: TrapOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const id = parseId(
    positionals[0],
    "Usage: codetrap add_trap_evidence <id> --source_type manual|conversation|commit|issue|test_failure|article [--scope project|global] [--source_ref X] [--related_files a,b] [--note X]"
  );
  if (typeof id !== "number") return id;

  try {
    const input = opts.json ? JSON.parse(opts.json) : evidenceRequestFromArgs(opts);
    const result = operations.addTrapEvidence(id, input, opts.scope);
    if (opts["output-json"] !== undefined) {
      return mutationJsonResult({ id, ...result }, `Trap #${id} not found.`);
    }
    return result.success
      ? textResult(`Evidence #${result.evidence_id} added to trap #${id} in ${result.scope} scope.`)
      : errorResult(`Trap #${id} not found.`);
  } catch (error) {
    return errorFrom(error);
  }
}

function cmdArchiveTrap(args: string[], operations: TrapOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const id = parseId(positionals[0], "Usage: codetrap archive_trap <id> [--scope project|global] [--json]");
  if (typeof id !== "number") return id;

  const result = operations.archiveTrap(id, opts.scope);
  if (opts.json !== undefined) {
    return mutationJsonResult({ id, ...result, status: result.success ? "archived" : undefined }, `Trap #${id} not found.`);
  }
  return result.success
    ? textResult(`Trap #${id} archived in ${result.scope} scope.`)
    : errorResult(`Trap #${id} not found.`);
}

function cmdSupersedeTrap(args: string[], operations: TrapOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  if (positionals.length < 2) {
    return errorResult("Usage: codetrap supersede_trap <old_id> <new_id> [--scope project|global] [--state_key key] [--json]");
  }
  const id = Number.parseInt(positionals[0], 10);
  const supersededById = Number.parseInt(positionals[1], 10);
  if (Number.isNaN(id) || Number.isNaN(supersededById)) {
    return errorResult("Error: ids must be numbers");
  }

  const result = operations.supersedeTrap(id, supersededById, opts.scope, opts.state_key ?? opts["state-key"]);
  if (opts.json !== undefined) {
    return mutationJsonResult(
      { id, superseded_by_id: supersededById, ...result },
      `Trap #${id} or #${supersededById} not found in the same scope.`
    );
  }
  return result.success
    ? textResult(`Trap #${id} superseded by #${supersededById} in ${result.scope} scope.`)
    : errorResult(`Trap #${id} or #${supersededById} not found in the same scope.`);
}

function cmdExport(args: string[], operations: TrapOperations): CommandResult {
  const { opts } = parseArgs(args);
  return jsonResult(operations.exportTraps(opts.scope));
}

function cmdImport(args: string[], operations: TrapOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  if (positionals.length === 0) return errorResult("Usage: codetrap import <file.json>");

  try {
    const traps = JSON.parse(readFileSync(positionals[0], "utf-8"));
    if (!Array.isArray(traps)) {
      const message = "Error: JSON file must contain an array of traps";
      return opts.json !== undefined ? jsonResult({ success: false, error: message }, 1) : errorResult(message);
    }
    const imported = operations.importTraps(traps);
    return opts.json !== undefined
      ? jsonResult({ imported, success: true })
      : textResult(`Imported ${imported} traps.`);
  } catch (error) {
    if (opts.json !== undefined) {
      return jsonResult({ success: false, error: errorMessage(error) }, 1);
    }
    return errorFrom(error);
  }
}

function cmdStats(args: string[], operations: TrapOperations): CommandResult {
  const { opts } = parseArgs(args);
  const request = statsRequestFromArgs(opts);
  const stats = operations.getStats(request.scope);
  const embeddingStats = operations.getEmbeddingStats(request.scope);
  return opts.json !== undefined
    ? jsonResult(toStatsJson(stats, embeddingStats))
    : textResult(formatStatsText(stats));
}

function cmdDoctor(args: string[], store: TrapStore, operations: TrapOperations): CommandResult {
  const { opts } = parseArgs(args);
  const report = buildDoctorReport(store, operations);
  return opts.json !== undefined
    ? jsonResult(report)
    : textResult(formatDoctorText(report));
}

function cmdScopeMigration(
  command: ScopeMigrationCommand,
  args: string[],
  operations: TrapOperations
): CommandResult {
  const { opts } = parseArgs(args);
  if (opts.apply !== undefined && opts["dry-run"] !== undefined) {
    return errorResult("Error: choose either --dry-run or --apply, not both.");
  }
  if (command === "migrate-project" && (!opts["from-project-path"] || !opts["to-project-path"])) {
    return errorResult("Usage: codetrap migrate-project --from-project-path <path> --to-project-path <path> [--dry-run|--apply] [--json]");
  }

  try {
    const result = runScopeMigration({
      command,
      fromProjectPath: opts["from-project-path"],
      toProjectPath: opts["to-project-path"],
      apply: opts.apply !== undefined,
      cwd: process.cwd(),
    });
    return opts.json !== undefined
      ? jsonResult(result)
      : textResult(formatScopeMigrationText(result));
  } catch (error) {
    return errorFrom(error);
  }
}

async function cmdEmbed(args: string[], store: TrapStore): Promise<CommandResult> {
  const { opts } = parseArgs(args);
  try {
    const result = await store.ensureEmbeddings(embedRequestFromArgs(opts));
    return textResult(formatEmbedText(result));
  } catch (error) {
    return errorFrom(error);
  }
}

async function cmdSession(args: string[], store: TrapStore, trapOperations: TrapOperations): Promise<CommandResult> {
  const sub = args[0];
  const rest = args.slice(1);
  const projectRoot = store.getProjectRoot();
  if (!projectRoot) {
    return errorResult("Not in a project. Run 'codetrap init' first.");
  }

  const sessions = new SessionOperations(new SessionStore(projectRoot), trapOperations);
  try {
    switch (sub) {
      case "start":
        return cmdSessionStart(rest, sessions);
      case "note":
        return cmdSessionNote(rest, sessions);
      case "status":
        return cmdSessionStatus(rest, sessions);
      case "list":
        return cmdSessionList(rest, sessions);
      case "show":
        return cmdSessionShow(rest, sessions);
      case "notes":
        return cmdSessionNotes(rest, sessions);
      case "close":
        return cmdSessionClose(rest, sessions);
      case "candidates":
        return cmdSessionCandidates(rest, sessions);
      case "candidate":
        return cmdSessionCandidate(rest, sessions);
      case "accept":
        return cmdSessionAccept(rest, sessions);
      case "reject":
        return cmdSessionReject(rest, sessions);
      case "delete":
        return cmdSessionDelete(rest, sessions);
      case "prune":
        return cmdSessionPrune(rest, sessions);
      case "cleanup":
        return cmdSessionCleanup(rest, sessions);
      default:
        return errorResult("Usage: codetrap session <start|note|status|list|show|notes|close|candidates|candidate|accept|reject|delete|prune|cleanup>");
    }
  } catch (error) {
    return errorFrom(error);
  }
}

function cmdSessionStart(args: string[], sessions: SessionOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const session = sessions.startSession(sessionStartRequestFromArgs(positionals, opts));
  const payload = sessionPayload(session);
  if (opts.json !== undefined) return jsonResult(payload);
  return textResult([
    `Started session ${session.id}`,
    `Notes: ${payload.notes_path}`,
  ].join("\n"));
}

function cmdSessionNote(args: string[], sessions: SessionOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const result = sessions.addNote(sessionNoteRequestFromArgs(positionals, opts, {
    isTTY: process.stdin.isTTY === true,
    read: () => readFileSync(0, "utf-8"),
  }));
  const payload = {
    session_id: result.session.id,
    kind: result.note.kind,
    note: result.note,
    notes_path: result.notes_path,
  };
  if (opts.json !== undefined) return jsonResult(payload);
  return textResult([
    `Added ${result.note.kind} note to session ${result.session.id}.`,
    `Notes: ${result.notes_path}`,
  ].join("\n"));
}

function cmdSessionStatus(args: string[], sessions: SessionOperations): CommandResult {
  const { opts } = parseArgs(args);
  const status = sessions.status();
  if (opts.json !== undefined) {
    return jsonResult({
      active_session_id: status.active_session_id,
      session: status.session ? sessionPayload(status.session) : null,
    });
  }
  if (!status.session) return textResult("No active session.");
  return textResult([
    `Active session ${status.session.id}`,
    `Goal: ${status.session.goal}`,
    `Notes: ${sessionRelativeFile(status.session.id, NOTES_FILE)}`,
  ].join("\n"));
}

function cmdSessionList(args: string[], sessions: SessionOperations): CommandResult {
  const { opts } = parseArgs(args);
  const entries = sessions.listSessions(sessionListRequestFromArgs(opts));
  if (opts.json !== undefined) return jsonResult(entries);
  if (entries.length === 0) return textResult("No sessions found.");
  return textResult(entries.map((entry) => `${entry.id} [${entry.status}] ${entry.goal}`).join("\n"));
}

function cmdSessionShow(args: string[], sessions: SessionOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const request = sessionShowRequestFromArgs(positionals);
  const shown = sessions.showSession(request.sessionId);
  if (opts.json !== undefined) {
    return jsonResult({
      ...sessionPayload(shown.session),
      session_dir: shown.session_dir,
      recap: shown.recap,
    });
  }
  if (shown.recap) return textResult(shown.recap.trimEnd());
  return textResult([
    `Session ${shown.session.id} [${shown.session.status}]`,
    `Goal: ${shown.session.goal}`,
    `Notes: ${shown.notes_path}`,
  ].join("\n"));
}

function cmdSessionNotes(args: string[], sessions: SessionOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const request = sessionIdRequestFromArgs(positionals);
  const summary = sessions.summarizeNotes(request.sessionId);
  if (opts.json !== undefined) return jsonResult(summary);
  return textResult(summary.content.trimEnd());
}

function cmdSessionClose(args: string[], sessions: SessionOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const request = sessionCloseRequestFromArgs(positionals, opts);
  const result = sessions.closeSession(request.sessionId, request.proposeTraps);
  const payload = {
    ...sessionPayload(result.session),
    recap_path: result.recap_path,
    candidate_count: result.candidate_count,
    traps_written: result.traps_written,
  };
  if (opts.json !== undefined) return jsonResult(payload);
  const lines = [
    `Closed session ${result.session.id}`,
    `Generated ${RECAP_FILE}`,
  ];
  if (opts["propose-traps"] !== undefined) {
    lines.push(`Proposed ${result.candidate_count} candidate traps`);
    lines.push(`0 traps were written. Use \`codetrap session accept <candidate-id> --session ${result.session.id}\` to save one.`);
  }
  return textResult(lines.join("\n"));
}

function cmdSessionCandidates(args: string[], sessions: SessionOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const request = sessionIdRequestFromArgs(positionals);
  const document = sessions.candidateDocument(request.sessionId);
  if (opts.json !== undefined) return jsonResult(document);
  if (document.candidates.length === 0) return textResult("No candidate traps found.");
  return textResult(document.candidates.map((candidate) =>
    `${candidate.id} [${candidate.status}] ${candidate.trap.title} (${candidate.quality_score.toFixed(2)})`
  ).join("\n"));
}

function cmdSessionCandidate(args: string[], sessions: SessionOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const request = sessionCandidateRequestFromArgs(positionals, opts);
  const result = sessions.getCandidate(request.candidateId, request.sessionId);
  if (opts.json !== undefined) return jsonResult({ session_id: result.session.id, candidate: result.candidate });
  return textResult(JSON.stringify(result.candidate, null, 2));
}

async function cmdSessionAccept(args: string[], sessions: SessionOperations): Promise<CommandResult> {
  const { opts, positionals } = parseArgs(args);
  const accepted = await sessions.acceptCandidate(sessionAcceptRequestFromArgs(positionals, opts));
  if (!accepted.success) return possibleConflictResult(accepted, opts.json !== undefined);
  const payload = {
    success: true,
    session_id: accepted.session.id,
    candidate_id: accepted.candidate.id,
    status: accepted.candidate.status,
    trap_id: accepted.trap_id,
    scope: accepted.scope,
    evidence_id: accepted.evidence_id,
    superseded_id: accepted.superseded_id,
  };
  if (opts.json !== undefined) return jsonResult(payload);
  const lines = [`Accepted ${accepted.candidate.id}; wrote trap #${accepted.trap_id} to ${accepted.scope} scope.`];
  if (accepted.superseded_id !== null) lines.push(`Superseded trap #${accepted.superseded_id}.`);
  return textResult(lines.join("\n"));
}

function cmdSessionReject(args: string[], sessions: SessionOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const rejected = sessions.rejectCandidate(sessionRejectRequestFromArgs(positionals, opts));
  const payload = {
    success: true,
    session_id: rejected.session.id,
    candidate_id: rejected.candidate.id,
    status: rejected.candidate.status,
    reason: rejected.candidate.rejection_reason ?? null,
  };
  if (opts.json !== undefined) return jsonResult(payload);
  return textResult(`Rejected ${rejected.candidate.id}.`);
}

function cmdSessionDelete(args: string[], sessions: SessionOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const request = sessionShowRequestFromArgs(positionals);
  const result = sessions.deleteSession(request.sessionId);
  const payload = { success: result.deleted, ...result };
  if (opts.json !== undefined) return jsonResult(payload);
  return textResult(`Deleted session ${result.session_id}.`);
}

function cmdSessionPrune(args: string[], sessions: SessionOperations): CommandResult {
  const { opts } = parseArgs(args);
  const result = sessions.pruneSessions(sessionPruneRequestFromArgs(opts));
  if (opts.json !== undefined) return jsonResult(result);
  const verb = result.dry_run ? "Would delete" : "Deleted";
  const lines = [`${verb} ${result.dry_run ? result.sessions.length : result.deleted_count} session(s) older than ${result.cutoff}.`];
  if (result.dry_run && result.sessions.length > 0) {
    lines.push("Run with --apply to delete them.");
  }
  lines.push(...result.sessions.map((session) => `- ${session.id} [${session.status}] ${session.goal}`));
  return textResult(lines.join("\n"));
}

function cmdSessionCleanup(args: string[], sessions: SessionOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  if (opts["deleted-trap-candidates"] === undefined && opts.deleted_trap_candidates === undefined) {
    return errorResult("Usage: codetrap session cleanup [session-id] --deleted-trap-candidates [--json]");
  }
  const request = sessionIdRequestFromArgs(positionals);
  const result = sessions.cleanupDeletedTrapCandidates(request.sessionId);
  const payload = {
    success: true,
    session_id: result.session.id,
    removed_count: result.removed_count,
    removed_candidate_ids: result.removed_candidate_ids,
  };
  if (opts.json !== undefined) return jsonResult(payload);
  return textResult(`Removed ${result.removed_count} deleted-trap candidate(s) from session ${result.session.id}.`);
}

function formatStatsText(stats: ReturnType<TrapOperations["getStats"]>): string {
  const sections: string[] = [];
  if (stats.project) {
    sections.push("── Project ──", formatStatsBlock(stats.project));
  }
  if (stats.global) {
    sections.push("── Global ──", formatStatsBlock(stats.global));
  }
  return sections.join("\n");
}

function formatStatsBlock(stats: { total: number; byCategory: Record<string, number>; bySeverity: Record<string, number> }): string {
  return [
    `  Total: ${stats.total}`,
    "  By category:",
    ...Object.entries(stats.byCategory).map(([category, count]) => `    ${category}: ${count}`),
    "  By severity:",
    ...Object.entries(stats.bySeverity).map(([severity, count]) => `    ${severity}: ${count}`),
  ].join("\n");
}

function parseId(value: string | undefined, usage: string): number | CommandResult {
  if (value === undefined) return errorResult(usage);
  const id = Number.parseInt(value, 10);
  return Number.isNaN(id) ? errorResult("Error: id must be a number") : id;
}

function readQuery(positionals: string[]): string {
  if (positionals.length > 0) return positionals.join(" ").trim();
  if (process.stdin.isTTY) return "";
  return readFileSync(0, "utf-8").trim();
}

function mutationJsonResult<T extends Record<string, unknown> & { success: boolean }>(
  value: T,
  error: string
): CommandResult {
  return jsonResult(mutationJsonPayload(value, error), value.success ? 0 : 1);
}

function errorFrom(error: unknown): CommandResult {
  return errorResult(`Error: ${errorMessage(error)}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sessionPayload(session: SessionMetadata) {
  return {
    ...session,
    session_dir: sessionRelativeDir(session.id),
    notes_path: sessionRelativeFile(session.id, NOTES_FILE),
    recap_path: sessionRelativeFile(session.id, RECAP_FILE),
    candidate_traps_path: sessionRelativeFile(session.id, CANDIDATES_FILE),
  };
}

function possibleConflictResult(
  result: SessionConflictResult,
  asJson: boolean
): CommandResult {
  const payload = {
    success: false,
    error: "Possible active trap conflict found.",
    session_id: result.session_id,
    candidate_id: result.candidate_id,
    possible_conflicts: result.possible_conflicts,
    next_actions: [
      `codetrap session accept ${result.candidate_id} --session ${result.session_id} --accept-anyway`,
      `codetrap session accept ${result.candidate_id} --session ${result.session_id} --supersedes <trap-id>`,
      `codetrap session reject ${result.candidate_id} --session ${result.session_id} --reason <reason>`,
    ],
  };
  if (asJson) return jsonResult(payload, 1);

  return errorResult([
    "Possible active trap conflict found:",
    ...result.possible_conflicts.map((conflict) => [
      `#${conflict.trap_id} ${conflict.title}`,
      `  reason: ${conflict.reason}`,
      `  fix: ${conflict.fix}`,
    ].join("\n")),
    "",
    `Use --accept-anyway to save as a new trap, or --supersedes <trap-id> to preserve lifecycle history.`,
  ].join("\n"));
}
