import { readFileSync } from "node:fs";
import type { TrapStore } from "../lib/store";
import type { TrapOperations } from "../lib/trap-operations";
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
  sessionCaptureSuppressedPayload,
  sessionCaptureSuppressedText,
  sessionCliConflictPayload,
  sessionCleanupPayload,
  sessionConflictPayload,
  sessionConflictText,
  sessionPayload,
  sessionRejectPayload,
  sessionRollbackPayload,
} from "../lib/session-review";
import { EXECUTOR_IS_DECLARED, type LearningReceipt } from "../domain/learning";
import {
  sessionAcceptRequestFromArgs,
  sessionCandidateRequestFromArgs,
  sessionCaptureRequestFromArgs,
  sessionCloseRequestFromArgs,
  sessionIdRequestFromArgs,
  sessionListRequestFromArgs,
  sessionNoteRequestFromArgs,
  sessionPruneRequestFromArgs,
  sessionApproveRequestFromArgs,
  sessionRejectRequestFromArgs,
  sessionRollbackRequestFromArgs,
  sessionShowRequestFromArgs,
  sessionStartRequestFromArgs,
  sessionUnsuppressRequestFromArgs,
} from "../lib/command-requests";
import { errorResult, jsonResult, textResult, type CommandResult } from "./command-result";
import { errorFrom, parseArgs } from "./command-args";

export async function cmdSession(args: string[], store: TrapStore, trapOperations: TrapOperations): Promise<CommandResult> {
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
      case "approve":
        return cmdSessionApprove(rest, sessions);
      case "reject":
        return cmdSessionReject(rest, sessions);
      case "rollback":
        return cmdSessionRollback(rest, sessions);
      case "migrate":
        return cmdSessionMigrate(rest, sessions);
      case "receipts":
        return cmdSessionReceipts(rest, sessions);
      case "suppressions":
        return cmdSessionSuppressions(rest, sessions);
      case "unsuppress":
        return cmdSessionUnsuppress(rest, sessions);
      case "delete":
        return cmdSessionDelete(rest, sessions);
      case "prune":
        return cmdSessionPrune(rest, sessions);
      case "cleanup":
        return cmdSessionCleanup(rest, sessions);
      default:
        return errorResult("Usage: codetrap session <start|note|status|list|show|notes|close|capture|candidates|candidate|accept|approve|reject|rollback|migrate|receipts|suppressions|unsuppress|delete|prune|cleanup>");
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
  if (result.suppressed) {
    const suppressedPayload = sessionCaptureSuppressedPayload(result);
    if (opts.json !== undefined) return jsonResult(suppressedPayload);
    return textResult(sessionCaptureSuppressedText(suppressedPayload));
  }
  const nextAction = `codetrap session candidate ${result.candidate.id} --session ${result.session.id} --json`;
  const payload = {
    success: true,
    suppressed: false,
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
  lines.push(receiptLine(accepted.receipt));
  lines.push(`Undo: codetrap session rollback ${accepted.candidate.id} --session ${accepted.session.id}`);
  return textResult(lines.join("\n"));
}

function cmdSessionReject(args: string[], sessions: SessionOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const rejected = sessions.rejectCandidate(sessionRejectRequestFromArgs(positionals, opts));
  const payload = sessionRejectPayload(rejected);
  if (opts.json !== undefined) return jsonResult(payload);
  return textResult([
    `Rejected ${rejected.candidate.id}.`,
    `Suppressed ${payload.suppression.fingerprint} — this lesson will not be proposed again.`,
    receiptLine(payload.receipt),
    `Allow it again: codetrap session unsuppress ${payload.suppression.fingerprint}`,
  ].join("\n"));
}

function cmdSessionApprove(args: string[], sessions: SessionOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const result = sessions.approveCandidate(sessionApproveRequestFromArgs(positionals, opts));
  if (opts.json !== undefined) {
    return jsonResult({
      success: true,
      session_id: result.session.id,
      candidate_id: result.candidate.id,
      authorization: result.authorization,
      receipt: result.receipt,
    });
  }
  return textResult([
    `Approved ${result.candidate.id} at revision ${result.authorization.revision}.`,
    `Content hash: ${result.authorization.content_hash}`,
    `An agent may now commit it: codetrap session accept ${result.candidate.id} --session ${result.session.id} --executor agent`,
    "A material edit to the lesson invalidates this approval.",
  ].join("\n"));
}

function cmdSessionRollback(args: string[], sessions: SessionOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const result = sessions.rollbackCandidate(sessionRollbackRequestFromArgs(positionals, opts));
  const payload = sessionRollbackPayload(result);
  if (opts.json !== undefined) return jsonResult(payload);
  return textResult([
    result.trap_deleted
      ? `Deleted trap #${result.trap_id} from ${result.scope} scope.`
      : `Trap #${result.trap_id} was already absent from ${result.scope} scope.`,
    `${result.candidate.id}: accepted -> proposed; it is back in the review queue.`,
    receiptLine(payload.receipt),
  ].join("\n"));
}

function cmdSessionMigrate(args: string[], sessions: SessionOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const apply = opts.apply !== undefined;
  if (apply && opts["dry-run"] !== undefined) {
    return errorResult("Choose either --dry-run or --apply, not both.");
  }
  const result = sessions.migrateCandidateDocuments({
    sessionId: positionals[0] ?? stringOptionValue(opts.session),
    direction: opts.down !== undefined ? "down" : "up",
    apply,
  });
  if (opts.json !== undefined) return jsonResult(result);

  if (result.sessions.length === 0) {
    return textResult(`No candidate records need migrating to schema version ${result.target_version}.`);
  }
  const verb = result.applied ? "Migrated" : "Would migrate";
  const lines = [
    `${verb} ${result.sessions.length} session(s) to schema version ${result.target_version}:`,
    ...result.sessions.flatMap((entry) => [
      `  ${entry.session_id}: v${entry.from_version} -> v${entry.to_version} (${entry.candidate_count} record(s))`,
      ...entry.warnings.map((warning) => `    warning: ${warning}`),
    ]),
  ];
  if (result.next_action) {
    lines.push("", `Nothing was written. Apply with: ${result.next_action.command}`);
  }
  return textResult(lines.join("\n"));
}

function stringOptionValue(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : undefined;
}

function cmdSessionReceipts(args: string[], sessions: SessionOperations): CommandResult {
  const { opts } = parseArgs(args);
  const limit = receiptsLimit(opts.limit);
  const receipts = sessions.listReceipts(limit);
  if (opts.json !== undefined) {
    return jsonResult({ executor_note: EXECUTOR_IS_DECLARED, receipts });
  }
  if (receipts.length === 0) return textResult("No receipts recorded.");
  return textResult([
    ...receipts.map((receipt) => [
      `${receipt.recorded_at} ${receipt.action} by ${receipt.executor}`,
      `  ${receipt.title}`,
      `  authorized scope: ${receipt.authorized_scope}`,
      `  destination: ${receipt.destination}${receipt.trap_id === null ? "" : ` trap #${receipt.trap_id} (${receipt.trap_scope})`}`,
      `  fingerprint: ${receipt.fingerprint}`,
      ...(receipt.reason ? [`  reason: ${receipt.reason}`] : []),
    ].join("\n")),
    "",
    EXECUTOR_IS_DECLARED,
  ].join("\n"));
}

function cmdSessionSuppressions(args: string[], sessions: SessionOperations): CommandResult {
  const { opts } = parseArgs(args);
  const suppressions = sessions.listSuppressions();
  if (opts.json !== undefined) return jsonResult({ suppressions });
  if (suppressions.length === 0) return textResult("No suppressed lessons.");
  return textResult(suppressions.map((entry) => [
    `${entry.fingerprint}  ${entry.title}`,
    `  suppressed ${entry.suppressed_at.slice(0, 10)}${entry.reason ? `: ${entry.reason}` : ""}`,
  ].join("\n")).join("\n"));
}

function cmdSessionUnsuppress(args: string[], sessions: SessionOperations): CommandResult {
  const { opts, positionals } = parseArgs(args);
  const result = sessions.unsuppress(sessionUnsuppressRequestFromArgs(positionals, opts));
  if (opts.json !== undefined) return jsonResult(result);
  return textResult([
    `Unsuppressed ${result.suppression.fingerprint} ("${result.suppression.title}").`,
    "It can be captured again.",
    receiptLine(result.receipt),
  ].join("\n"));
}

function receiptsLimit(value: unknown): number {
  if (value === undefined) return 0;
  const limit = Number(String(value));
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(`Invalid --limit: ${String(value)}. Expected a positive integer.`);
  }
  return limit;
}

function receiptLine(receipt: LearningReceipt): string {
  return `Receipt: ${receipt.action} by ${receipt.executor} (declared), authorized scope "${receipt.authorized_scope}".`;
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

function possibleConflictResult(
  result: SessionConflictResult,
  asJson: boolean
): CommandResult {
  const payload = sessionConflictPayload(result);
  if (asJson) return jsonResult(sessionCliConflictPayload(payload), 1);
  return errorResult(sessionConflictText(payload));
}
