import type { CandidateTrap } from "../domain/session";
import { buildTrapInput } from "../domain/trap";
import type { TrapOperations } from "./trap-operations";
import { findCandidateConflicts, type CandidateConflict } from "./session-conflicts";
import type {
  AcceptCandidateResult,
  AddSessionNoteArgs,
  CloseSessionResult,
  SessionStore,
  StartSessionArgs,
} from "./session-store";

export type SessionAcceptRequest = {
  candidateId: string;
  sessionId?: string;
  edit?: Record<string, unknown>;
  supersedesId?: number;
  acceptAnyway?: boolean;
};

export type SessionSaveCandidateRequest = {
  candidateId: string;
  sessionId?: string;
  edit: Record<string, unknown>;
};

export type SessionRejectRequest = {
  candidateId: string;
  sessionId?: string;
  reason?: string | null;
};

export type SessionConflictResult = {
  success: false;
  session_id: string;
  candidate_id: string;
  possible_conflicts: CandidateConflict[];
};

export type SessionAcceptSuccess = AcceptCandidateResult & {
  success: true;
};

export type SessionAcceptResult = SessionAcceptSuccess | SessionConflictResult;

export class SessionOperations {
  constructor(
    private readonly sessions: SessionStore,
    private readonly traps: TrapOperations
  ) {}

  startSession(args: StartSessionArgs) {
    return this.sessions.startSession(args);
  }

  addNote(args: AddSessionNoteArgs) {
    return this.sessions.addNote(args);
  }

  status() {
    return this.sessions.status();
  }

  listSessions(args: { status?: string; limit?: number } = {}) {
    return this.sessions.listSessions(args);
  }

  showSession(id: string) {
    return this.sessions.showSession(id);
  }

  summarizeNotes(id?: string) {
    return this.sessions.summarizeNotes(id);
  }

  closeSession(id: string | undefined, proposeTraps: boolean): CloseSessionResult {
    return this.sessions.closeSession(id, proposeTraps);
  }

  candidateDocument(id?: string) {
    return this.sessions.candidateDocument(id);
  }

  getCandidate(candidateId: string, sessionId?: string) {
    return this.sessions.getCandidate(candidateId, sessionId);
  }

  saveCandidate(request: SessionSaveCandidateRequest) {
    const { session, candidate } = this.sessions.getCandidate(request.candidateId, request.sessionId);
    const editedCandidate = candidateWithTrapEdits(candidate, request.edit);
    return this.sessions.saveCandidateTrap(editedCandidate.id, {
      sessionId: session.id,
      trap: editedCandidate.trap,
    });
  }

  async acceptCandidate(request: SessionAcceptRequest): Promise<SessionAcceptResult> {
    const { session, candidate } = this.sessions.getCandidate(request.candidateId, request.sessionId);
    const editedCandidate = candidateWithTrapEdits(candidate, request.edit);
    const supersedesId = request.supersedesId;
    const conflicts = await findCandidateConflicts(editedCandidate, this.traps);
    if (conflicts.length > 0 && supersedesId === undefined && request.acceptAnyway !== true) {
      const checked = this.sessions.recordCandidateConflictCheck(candidate.id, {
        sessionId: session.id,
        trap: editedCandidate.trap,
        conflictStatus: "possible",
        suggestedAction: "supersede",
      });
      return {
        success: false,
        session_id: checked.session.id,
        candidate_id: checked.candidate.id,
        possible_conflicts: conflicts,
      };
    }

    const trap = editedCandidate.trap;
    if (supersedesId !== undefined && !this.traps.getTrapDetails(supersedesId, String(trap.scope))) {
      throw new Error(`Trap #${supersedesId} not found in ${String(trap.scope)} scope.`);
    }

    const added = this.traps.addTrap({ ...trap });
    const evidence = this.traps.addTrapEvidence(added.id, {
      source_type: "conversation",
      source_ref: `session:${session.id}`,
      related_files: candidateRelatedFiles(editedCandidate),
      note: `Accepted from session candidate ${editedCandidate.id}`,
    }, added.scope);
    if (!evidence.success) throw new Error(`Failed to attach evidence to trap #${added.id}.`);

    if (supersedesId !== undefined) {
      const supersede = this.traps.supersedeTrap(supersedesId, added.id, added.scope);
      if (!supersede.success) throw new Error(`Trap #${supersedesId} could not be superseded by trap #${added.id}.`);
    }

    return {
      success: true,
      ...this.sessions.acceptCandidate(editedCandidate.id, {
        sessionId: session.id,
        trap,
        trapId: added.id,
        scope: added.scope,
        evidenceId: evidence.evidence_id,
        supersededId: supersedesId ?? null,
        conflictChecked: true,
        conflictStatus: supersedesId !== undefined ? "confirmed" : conflicts.length > 0 ? "possible" : "none",
        suggestedAction: supersedesId !== undefined ? "supersede" : "accept",
      }),
    };
  }

  rejectCandidate(request: SessionRejectRequest) {
    return this.sessions.rejectCandidate(request.candidateId, {
      sessionId: request.sessionId,
      reason: request.reason,
    });
  }
}

function candidateWithTrapEdits(candidate: CandidateTrap, edit: Record<string, unknown> | undefined): CandidateTrap {
  return {
    ...candidate,
    trap: normalizeCandidateTrap({
      ...candidate.trap,
      ...trapEdits(edit),
    }) as CandidateTrap["trap"],
  };
}

function normalizeCandidateTrap(args: Record<string, unknown>) {
  return buildTrapInput({
    ...args,
    tags: stringArray(args.tags),
    path_globs: stringArray(args.path_globs),
    module: optionalText(args.module),
    owner: optionalText(args.owner),
    before_code: optionalText(args.before_code),
    after_code: optionalText(args.after_code),
  });
}

function stringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") {
    const values = value.split(",").map((item) => item.trim()).filter(Boolean);
    return values.length > 0 ? values : undefined;
  }
  return undefined;
}

function optionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function trapEdits(edit: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!edit) return {};
  const nested = edit.trap;
  return isRecord(nested) ? nested : edit;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function candidateRelatedFiles(candidate: CandidateTrap): string[] {
  return uniqueStrings(candidate.evidence.flatMap((evidence) => evidence.related_files ?? []));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
