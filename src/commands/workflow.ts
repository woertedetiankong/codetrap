import { readFileSync } from "node:fs";
import { TrapStore } from "../lib/store";
import { formatTrapShort, formatTrapDetails, formatTrapActionCard } from "../lib/format";
import type { Trap } from "../domain/trap";
import {
  formatScopeMigrationText,
  runScopeMigration,
  type ScopeMigrationCommand,
} from "../lib/scope-migration";
import { TrapOperations } from "../lib/trap-operations";
import { buildDoctorReport, formatDoctorText } from "../lib/doctor";
import { formatEmbedText } from "../lib/embed-output";
import {
  formatEmbeddingProfilesText,
  formatEmbeddingStatusText,
  formatEmbeddingsUseText,
  type EmbeddingsUseResult,
} from "../lib/embedding-management";
import { searchDefaultsFromConfig } from "../lib/config";
import { formatCodexSetupText, runCodexSetup } from "../lib/codex-setup";
import { SessionStore } from "../lib/session-store";
import { SessionOperations, type SessionConflictResult } from "../lib/session-operations";
import {
  CANDIDATES_FILE,
  NOTES_FILE,
  RECAP_FILE,
  sessionRelativeFile,
} from "../lib/session-codec";
import {
  sessionAcceptPayload,
  sessionCliConflictPayload,
  sessionCleanupPayload,
  sessionConflictPayload,
  sessionConflictText,
  sessionPayload,
  sessionRejectPayload,
} from "../lib/session-review";
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
  embeddingsUseRequestFromArgs,
  evidenceRequestFromArgs,
  listRequestFromArgs,
  searchRequestFromArgs,
  sessionAcceptRequestFromArgs,
  sessionCaptureRequestFromArgs,
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
  try {
    return await dispatchCommand(sub, args, store);
  } catch (error) {
    return errorFrom(error, args);
  }
}

async function dispatchCommand(sub: string, args: string[], store: TrapStore): Promise<CommandResult> {
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
    case "setup":
      return cmdSetup(args);
    case "repair-scope":
      return cmdScopeMigration("repair-scope", args, operations);
    case "migrate-project":
      return cmdScopeMigration("migrate-project", args, operations);
    case "embed":
      return cmdEmbed(args, store);
    case "embeddings":
      return cmdEmbeddings(args, store);
    case "session":
      return cmdSession(args, store, operations);
    default:
      return errorResult([
        `Unknown command: ${sub}`,
        "Commands: init, add, search, list, show, edit, delete, add_trap_evidence, archive_trap, supersede_trap, export, import, stats, doctor, setup, repair-scope, migrate-project, embed, embeddings, session",
      ].join("\n"));
  }
}

// Flags that never take a value. Without this allowlist, a boolean flag
// placed before a positional swallows it ("search --json timeout" losing
// the query). Use --flag=value to force a value onto any flag.
const BOOLEAN_FLAGS = new Set([
  "json",
  "output-json",
  "no-rerank",
  "rerank",
  "ranking-signals",
  "ranking_signals",
  "force",
  "apply",
  "dry-run",
  "propose-traps",
  "accept-anyway",
  "deleted-trap-candidates",
  "deleted_trap_candidates",
  "stdin",
  "mcp",
  "no-agents",
]);

export function parseArgs(args: string[]): ParsedArgs {
  const opts: Record<string, string> = {};
  const positionals: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const body = arg.slice(2);
    const eq = body.indexOf("=");
    if (eq !== -1) {
      opts[body.slice(0, eq)] = body.slice(eq + 1);
      continue;
    }
    if (BOOLEAN_FLAGS.has(body)) {
      opts[body] = "true";
      continue;
    }
    const next = args[i + 1];
    opts[body] = next !== undefined && !next.startsWith("--") ? args[++i] : "true";
  }
  return { opts, positionals };
}

function wantsJson(opts: Record<string, string>): boolean {
  return opts.json !== undefined || opts["output-json"] !== undefined;
}

function wantsJsonRaw(args: string[]): boolean {
  return args.some((arg) =>
    arg === "--json" || arg === "--output-json" || arg.startsWith("--json=") || arg.startsWith("--output-json=")
  );
}

function cmdInit(_args: string[], store: TrapStore): CommandResult {
  if (store.hasProject()) {
    return textResult(`Already in a project: ${store.getProjectRoot()}`);
  }
  return textResult("Project initialized.");
}

async function cmdAdd(args: string[], operations: TrapOperations): Promise<CommandResult> {
  const { opts, positionals } = parseArgs(args);
  const input = opts["input-json"];
  if (input !== undefined) {
    if (!input || input === "true") {
      return failureMessage("--input-json requires a JSON string argument", args);
    }
    try {
      const result = operations.addTrap(JSON.parse(input));
      await operations.embedTrapBestEffort(result.id, result.scope);
      return wantsJson(opts)
        ? jsonResult(result)
        : textResult(`Trap #${result.id} added to ${result.scope} scope.`);
    } catch (error) {
      return errorFrom(error, args);
    }
  }

  if (looksLikeJsonPositional(positionals)) {
    return failureMessage([
      "JSON input moved to --input-json; --json now always means JSON output.",
      'Example: codetrap add --input-json \'{"title":"...","category":"convention","scope":"project","context":"...","mistake":"...","fix":"..."}\' [--json]',
    ].join("\n"), args);
  }

  if (positionals.length > 0) {
    return failureMessage([
      "Use --input-json for structured input.",
      `Quick add: codetrap add --input-json '{"title":"${positionals.join(" ")}","category":"other","scope":"global","context":"...","mistake":"...","fix":"..."}'`,
    ].join("\n"), args);
  }

  return failureMessage([
    "add requires --input-json (interactive mode is not implemented).",
    'Example: codetrap add --input-json \'{"title":"...","category":"convention","scope":"project","context":"...","mistake":"...","fix":"..."}\'',
  ].join("\n"), args);
}

function looksLikeJsonPositional(positionals: string[]): boolean {
  return positionals.some((value) => value.trimStart().startsWith("{"));
}

async function cmdSearch(args: string[], operations: TrapOperations): Promise<CommandResult> {
  const { opts, positionals } = parseArgs(args);
  const query = readQuery(positionals);
  if (!query) {
    return errorResult("Usage: codetrap search <query> [--category X] [--limit N] [--mode fts|semantic|hybrid] [--status active|superseded|archived|all] [--path file] [--module name] [--owner name] [--json]");
  }

  try {
    const defaults = searchDefaultsFromConfig();
    const { cards, diagnostics } = await operations.searchTrapCards(searchRequestFromArgs(query, opts, defaults));
    if (opts.json !== undefined) {
      return jsonResult({ results: toCliSearchJson(cards), diagnostics });
    }
    const sections = [cards.length > 0 ? cards.map(formatTrapActionCard).join("\n\n") : "No traps found."];
    sections.push(...diagnostics.map((diagnostic) =>
      `note [${diagnostic.code}] (${diagnostic.scope}): ${diagnostic.message}`
    ));
    return textResult(sections.join("\n\n"));
  } catch (error) {
    return errorFrom(error, args);
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
    return errorFrom(error, args);
  }
}

function cmdShow(args: string[], operations: TrapOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const id = parseId(positionals[0], "Usage: codetrap show <id> [--scope project|global] [--json]");
  if (typeof id !== "number") return id;

  const result = operations.getTrapDetails(id, opts.scope);
  if (!result) return failureMessage(`Trap #${id} not found.`, args);

  operations.hitTrap(id, result.scope);
  return opts.json !== undefined
    ? jsonResult(toTrapDetailsJson(result))
    : textResult(formatTrapDetails(result));
}

async function cmdEdit(args: string[], operations: TrapOperations): Promise<CommandResult> {
  const { opts, positionals } = parseArgs(args);
  const id = parseId(positionals[0], "Usage: codetrap edit <id> --input-json '{\"title\":\"new title\"}' [--scope project|global] [--json]");
  if (typeof id !== "number") return id;

  const input = opts["input-json"];
  if (!input || input === "true") {
    const hint = looksLikeJsonPositional(positionals)
      ? "JSON input moved to --input-json; --json now always means JSON output."
      : "edit requires --input-json.";
    return failureMessage([
      hint,
      "Example: codetrap edit 1 --input-json '{\"title\":\"new title\"}' [--scope project|global] [--json]",
    ].join("\n"), args);
  }

  try {
    const result = operations.updateTrap(id, JSON.parse(input), opts.scope);
    if (!result.success) {
      return failureMessage(result.error ?? `Trap #${id} not found or no fields changed.`, args);
    }
    await operations.embedTrapBestEffort(id, result.scope);
    return wantsJson(opts)
      ? jsonResult({ id, ...result })
      : textResult(`Trap #${id} updated in ${result.scope} scope.`);
  } catch (error) {
    return errorFrom(error, args);
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
    : errorResult(result.error ?? `Trap #${id} not found.`);
}

function cmdAddTrapEvidence(args: string[], operations: TrapOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const id = parseId(
    positionals[0],
    "Usage: codetrap add_trap_evidence <id> --source_type manual|conversation|commit|issue|test_failure|article [--scope project|global] [--source_ref X] [--related_files a,b] [--note X]"
  );
  if (typeof id !== "number") return id;

  if (looksLikeJsonPositional(positionals)) {
    return failureMessage([
      "JSON input moved to --input-json; --json now always means JSON output.",
      "Example: codetrap add_trap_evidence 1 --input-json '{\"source_type\":\"commit\"}' [--json]",
    ].join("\n"), args);
  }

  try {
    const inputJson = opts["input-json"];
    const input = inputJson && inputJson !== "true" ? JSON.parse(inputJson) : evidenceRequestFromArgs(opts);
    const result = operations.addTrapEvidence(id, input, opts.scope);
    if (wantsJson(opts)) {
      return mutationJsonResult({ id, ...result }, `Trap #${id} not found.`);
    }
    return result.success
      ? textResult(`Evidence #${result.evidence_id} added to trap #${id} in ${result.scope} scope.`)
      : errorResult(result.error ?? `Trap #${id} not found.`);
  } catch (error) {
    return errorFrom(error, args);
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
    : errorResult(result.error ?? `Trap #${id} not found.`);
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
    : errorResult(result.error ?? `Trap #${id} or #${supersededById} not found in the same scope.`);
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
    const result = operations.importTraps(traps);
    const exitCode = result.skipped.length > 0 ? 1 : 0;
    if (opts.json !== undefined) {
      return jsonResult({
        success: result.skipped.length === 0,
        imported: result.imported,
        total: result.total,
        skipped: result.skipped,
      }, exitCode);
    }
    const lines = [`Imported ${result.imported} of ${result.total} traps.`];
    if (result.skipped.length > 0) {
      lines.push(`Skipped ${result.skipped.length} record(s):`);
      lines.push(...result.skipped.map((skip) =>
        `- [${skip.index}] ${skip.title ?? "(untitled)"}: ${skip.error}`
      ));
    }
    return { exitCode, [exitCode === 0 ? "stdout" : "stderr"]: lines.join("\n") };
  } catch (error) {
    if (opts.json !== undefined) {
      return jsonResult({ success: false, error: errorMessage(error) }, 1);
    }
    return errorFrom(error, args);
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

async function cmdDoctor(args: string[], store: TrapStore, operations: TrapOperations): Promise<CommandResult> {
  const { opts } = parseArgs(args);
  const projectRoot = store.getProjectRoot();
  const candidateReview = projectRoot
    ? new SessionOperations(new SessionStore(projectRoot), operations).candidateReviewSummary()
    : null;
  const report = await buildDoctorReport(store, operations, process.cwd(), candidateReview);
  return opts.json !== undefined
    ? jsonResult(report)
    : textResult(formatDoctorText(report));
}

function cmdSetup(args: string[]): CommandResult {
  const sub = args[0];
  const rest = args.slice(1);
  if (sub !== "codex") {
    return errorResult("Usage: codetrap setup codex [--mcp] [--no-agents] [--agents-file AGENTS.md] [--codex-home <path>] [--dry-run] [--json]");
  }
  const { opts } = parseArgs(rest);
  try {
    const result = runCodexSetup({
      cwd: process.cwd(),
      codexHome: opts["codex-home"],
      agentsFile: opts["agents-file"],
      installMcp: opts.mcp !== undefined,
      skipAgents: opts["no-agents"] !== undefined,
      dryRun: opts["dry-run"] !== undefined,
    });
    if (opts.json !== undefined) return jsonResult(result, result.success ? 0 : 1);
    return result.success
      ? textResult(formatCodexSetupText(result))
      : errorResult(formatCodexSetupText(result));
  } catch (error) {
    return errorFrom(error, args);
  }
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
    return errorFrom(error, args);
  }
}

async function cmdEmbed(args: string[], store: TrapStore): Promise<CommandResult> {
  const { opts } = parseArgs(args);
  try {
    const result = await store.ensureEmbeddings(embedRequestFromArgs(opts));
    return textResult(formatEmbedText(result));
  } catch (error) {
    return errorFrom(error, args);
  }
}

async function cmdEmbeddings(args: string[], store: TrapStore): Promise<CommandResult> {
  const sub = args[0] ?? "status";
  const rest = args.length === 0 ? [] : args.slice(1);

  try {
    switch (sub) {
      case "status": {
        const { opts } = parseArgs(rest);
        const status = await store.embeddingStatus({ scope: opts.scope });
        return opts.json !== undefined
          ? jsonResult(status)
          : textResult(formatEmbeddingStatusText(status));
      }
      case "list":
      case "profiles": {
        const { opts } = parseArgs(rest);
        const profiles = store.embeddingProfiles({ scope: opts.scope });
        const payload = {
          active_profile_id: store.embeddingRuntimeStatus().profile_id,
          ...profiles,
        };
        return opts.json !== undefined
          ? jsonResult(payload)
          : textResult(formatEmbeddingProfilesText(profiles));
      }
      case "use": {
        const { opts, positionals } = parseArgs(rest);
        const request = embeddingsUseRequestFromArgs(positionals, opts);
        const written = store.configureEmbeddings(request.embeddings);
        const scope = store.hasProject() ? "project" : "global";
        const result: EmbeddingsUseResult = {
          ...written,
          embeddings: written.config.embeddings ?? request.embeddings,
          next_action: {
            command: `codetrap embeddings reindex --scope ${scope}`,
            reason: "Generate embeddings for the selected profile.",
          },
        };
        return opts.json !== undefined
          ? jsonResult(result)
          : textResult(formatEmbeddingsUseText(result));
      }
      case "reindex":
      case "embed":
        return cmdEmbed(rest, store);
      default:
        return errorResult("Usage: codetrap embeddings <status|list|profiles|use|reindex> [--json]");
    }
  } catch (error) {
    return errorFrom(error, args);
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
      case "capture":
        return cmdSessionCapture(rest, sessions);
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
        return errorResult("Usage: codetrap session <start|note|status|list|show|notes|close|capture|candidates|candidate|accept|reject|delete|prune|cleanup>");
    }
  } catch (error) {
    return errorFrom(error, args);
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
      candidate_review: status.candidate_review,
    });
  }
  if (!status.session) {
    const lines = ["No active session."];
    if (status.candidate_review.pending_count > 0) {
      lines.push(
        `Pending candidate review: ${status.candidate_review.pending_count} candidate(s) across ${status.candidate_review.pending_session_count} session(s).`
      );
      if (status.candidate_review.next_session_id) {
        lines.push(`Review: codetrap session candidates ${status.candidate_review.next_session_id}`);
      }
      lines.push("Open web review: codetrap web");
    }
    return textResult(lines.join("\n"));
  }
  const lines = [
    `Active session ${status.session.id}`,
    `Goal: ${status.session.goal}`,
    `Notes: ${sessionRelativeFile(status.session.id, NOTES_FILE)}`,
  ];
  if (status.candidate_review.pending_count > 0) {
    lines.push(`Pending candidate review: ${status.candidate_review.pending_count} candidate(s).`);
  }
  return textResult(lines.join("\n"));
}

function cmdSessionList(args: string[], sessions: SessionOperations): CommandResult {
  const { opts } = parseArgs(args);
  const entries = sessions.listSessions(sessionListRequestFromArgs(opts));
  if (opts.json !== undefined) return jsonResult(entries);
  if (entries.length === 0) return textResult("No sessions found.");
  return textResult(entries.map((entry) =>
    `${entry.id} [${entry.status}] ${entry.goal} (${entry.pending_count} pending, ${entry.reviewed_count} reviewed)`
  ).join("\n"));
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

function cmdSessionCapture(args: string[], sessions: SessionOperations): CommandResult {
  const { opts } = parseArgs(args);
  const result = sessions.captureCandidate(sessionCaptureRequestFromArgs(opts, {
    isTTY: process.stdin.isTTY === true,
    readStdin: () => readFileSync(0, "utf-8"),
    readFile: (path) => readFileSync(path, "utf-8"),
  }));
  const nextAction = `codetrap session candidate ${result.candidate.id} --session ${result.session.id} --json`;
  const payload = {
    success: true,
    session_id: result.session.id,
    candidate_id: result.candidate.id,
    status: result.candidate.status,
    quality_score: result.candidate.quality_score,
    candidate_count: result.candidate_count,
    created_session: result.created_session,
    closed_session: result.closed_session,
    duplicate: result.duplicate,
    candidate_traps_path: sessionRelativeFile(result.session.id, CANDIDATES_FILE),
    recap_path: result.recap_path,
    next_action: {
      command: nextAction,
    },
  };
  if (opts.json !== undefined) return jsonResult(payload);
  return textResult([
    `${result.duplicate ? "Reused" : "Captured"} candidate ${result.candidate.id} in session ${result.session.id}.`,
    result.created_session ? "Created and closed a post-flight session." : "Session remains active.",
    `Candidate inbox: ${payload.candidate_traps_path}`,
    `Review: ${nextAction}`,
  ].join("\n"));
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
  const payload = sessionAcceptPayload(accepted);
  if (opts.json !== undefined) return jsonResult(payload);
  const lines = [`Accepted ${accepted.candidate.id}; wrote trap #${accepted.trap_id} to ${accepted.scope} scope.`];
  if (accepted.superseded_id !== null) lines.push(`Superseded trap #${accepted.superseded_id}.`);
  return textResult(lines.join("\n"));
}

function cmdSessionReject(args: string[], sessions: SessionOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const rejected = sessions.rejectCandidate(sessionRejectRequestFromArgs(positionals, opts));
  const payload = sessionRejectPayload(rejected);
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
  const payload = sessionCleanupPayload(result);
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

function mutationJsonResult<T extends Record<string, unknown> & { success: boolean; error?: string }>(
  value: T,
  error: string
): CommandResult {
  return jsonResult(mutationJsonPayload(value, error), value.success ? 0 : 1);
}

function errorFrom(error: unknown, rawArgs?: string[]): CommandResult {
  return failureMessage(errorMessage(error), rawArgs);
}

// M25: when the caller asked for JSON, failures are JSON too — a uniform
// { success: false, error } envelope on stdout with exit 1.
function failureMessage(message: string, rawArgs?: string[]): CommandResult {
  if (rawArgs && wantsJsonRaw(rawArgs)) {
    return jsonResult({ success: false, error: message }, 1);
  }
  return errorResult(message.startsWith("Error:") ? message : `Error: ${message}`);
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  // M7: a raw SQLite CHECK/constraint failure is meaningless to a user; enum
  // fields are validated upstream, so this is a safety net for the rest.
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && code.startsWith("SQLITE_CONSTRAINT")) {
    return `Invalid trap field (${error.message}).`;
  }
  return error.message;
}

function possibleConflictResult(
  result: SessionConflictResult,
  asJson: boolean
): CommandResult {
  const payload = sessionConflictPayload(result);
  if (asJson) return jsonResult(sessionCliConflictPayload(payload), 1);
  return errorResult(sessionConflictText(payload));
}
