import { SEARCH_MODES, type SearchMode } from "./constants";
import type { SearchDefaults } from "./config";
import type { SearchTrapsArgs, ListTrapsArgs } from "./trap-operations";

type RawArgs = Record<string, unknown>;

export type EmbedRequest = {
  scope?: string;
  category?: string;
  limit?: number;
  force?: boolean;
  batchSize?: number;
};

export type StatsRequest = {
  scope?: string;
};

export type SessionStartRequest = {
  goal: string;
  specRef?: string;
  module?: string;
  owner?: string;
};

export type SessionNoteRequest = {
  kind?: string;
  text: string;
  relatedFiles?: string[];
  sourceRef?: string;
};

export type SessionListRequest = {
  status?: string;
  limit?: number;
};

export type SessionCloseRequest = {
  sessionId?: string;
  proposeTraps: boolean;
};

export type SessionIdRequest = {
  sessionId?: string;
};

export type SessionShowRequest = {
  sessionId: string;
};

export type SessionCandidateRequest = {
  candidateId: string;
  sessionId?: string;
};

export type SessionAcceptRequest = SessionCandidateRequest & {
  edit?: Record<string, unknown>;
  supersedesId?: number;
  acceptAnyway: boolean;
};

export type SessionRejectRequest = SessionCandidateRequest & {
  reason?: string;
};

export type SessionNoteStdin = {
  isTTY: boolean;
  read: () => string;
};

export function searchRequestFromArgs(query: string, args: RawArgs, defaults: SearchDefaults): SearchTrapsArgs {
  return {
    query,
    category: stringOption(args, "category"),
    scope: stringOption(args, "scope") ?? defaults.scope,
    limit: intOption(args, "limit", defaults.limit),
    mode: searchModeOption(args, "mode") ?? defaults.mode,
    status: stringOption(args, "status"),
    path: stringOption(args, "path"),
    module: stringOption(args, "module"),
    owner: stringOption(args, "owner"),
    rerank: flagPresent(args, "no-rerank") ? false : booleanOption(args, "rerank") ?? defaults.rerank,
    includeRankingSignals: booleanOption(args, "ranking_signals", "ranking-signals") ?? false,
  };
}

export function listRequestFromArgs(args: RawArgs): ListTrapsArgs {
  return {
    category: stringOption(args, "category"),
    scope: stringOption(args, "scope"),
    status: stringOption(args, "status"),
    path: stringOption(args, "path"),
    module: stringOption(args, "module"),
    owner: stringOption(args, "owner"),
    limit: intOption(args, "limit", 50),
  };
}

export function statsRequestFromArgs(args: RawArgs): StatsRequest {
  return {
    scope: stringOption(args, "scope"),
  };
}

export function embedRequestFromArgs(args: RawArgs): EmbedRequest {
  return {
    scope: stringOption(args, "scope"),
    category: stringOption(args, "category"),
    limit: optionalIntOption(args, "limit"),
    force: booleanOption(args, "force") === true,
    batchSize: optionalIntOption(args, "batch_size", "batch-size"),
  };
}

export function evidenceRequestFromArgs(args: RawArgs): RawArgs {
  return {
    source_type: stringOption(args, "source_type", "source-type"),
    source_ref: stringOption(args, "source_ref", "source-ref"),
    observed_at: stringOption(args, "observed_at", "observed-at"),
    related_files: csvOrArrayOption(args, "related_files", "related-files"),
    note: stringOption(args, "note"),
  };
}

export function sessionStartRequestFromArgs(positionals: string[], args: RawArgs): SessionStartRequest {
  const goal = positionals.join(" ").trim();
  if (!goal) throw new Error("Session goal is required.");
  return {
    goal,
    specRef: stringOption(args, "spec"),
    module: stringOption(args, "module"),
    owner: stringOption(args, "owner"),
  };
}

export function sessionNoteRequestFromArgs(
  positionals: string[],
  args: RawArgs,
  stdin: SessionNoteStdin
): SessionNoteRequest {
  const hasText = args.text !== undefined;
  const hasStdin = args.stdin !== undefined;
  if (hasText && hasStdin) throw new Error("Choose either --text or --stdin, not both.");
  if (hasStdin && stdin.isTTY) throw new Error("--stdin requires piped input.");

  const text = hasStdin
    ? stdin.read().trim()
    : stringOption(args, "text") ?? positionals.join(" ").trim();
  if (!text) throw new Error("Session note text is required.");

  return {
    kind: stringOption(args, "kind"),
    text,
    relatedFiles: csvOrArrayOption(args, "related_files", "related-files"),
    sourceRef: stringOption(args, "source_ref", "source-ref"),
  };
}

export function sessionListRequestFromArgs(args: RawArgs): SessionListRequest {
  return {
    status: stringOption(args, "status") ?? "all",
    limit: optionalIntOption(args, "limit"),
  };
}

export function sessionCloseRequestFromArgs(positionals: string[], args: RawArgs): SessionCloseRequest {
  return {
    sessionId: positionals[0],
    proposeTraps: flagPresent(args, "propose-traps"),
  };
}

export function sessionIdRequestFromArgs(positionals: string[]): SessionIdRequest {
  return {
    sessionId: positionals[0],
  };
}

export function sessionShowRequestFromArgs(positionals: string[]): SessionShowRequest {
  return {
    sessionId: requiredPositional(positionals, 0, "session-id"),
  };
}

export function sessionCandidateRequestFromArgs(positionals: string[], args: RawArgs): SessionCandidateRequest {
  return {
    candidateId: requiredPositional(positionals, 0, "candidate-id"),
    sessionId: stringOption(args, "session"),
  };
}

export function sessionAcceptRequestFromArgs(positionals: string[], args: RawArgs): SessionAcceptRequest {
  return {
    ...sessionCandidateRequestFromArgs(positionals, args),
    edit: jsonObjectOption(args, "edit-json"),
    supersedesId: optionalIntOption(args, "supersedes"),
    acceptAnyway: flagPresent(args, "accept-anyway"),
  };
}

export function sessionRejectRequestFromArgs(positionals: string[], args: RawArgs): SessionRejectRequest {
  return {
    ...sessionCandidateRequestFromArgs(positionals, args),
    reason: stringOption(args, "reason"),
  };
}

function stringOption(args: RawArgs, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return undefined;
}

function intOption(args: RawArgs, key: string, fallback: number): number {
  return optionalIntOption(args, key) ?? fallback;
}

function optionalIntOption(args: RawArgs, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = args[key];
    if (value === undefined) continue;
    const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
    throw new Error(`Invalid number: ${String(value)}`);
  }
  return undefined;
}

function searchModeOption(args: RawArgs, key: string): SearchMode | undefined {
  const value = stringOption(args, key);
  if (!value) return undefined;
  if ((SEARCH_MODES as readonly string[]).includes(value)) return value as SearchMode;
  throw new Error(`Invalid search mode: ${value}. Expected one of: ${SEARCH_MODES.join(", ")}`);
}

function booleanOption(args: RawArgs, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = args[key];
    if (value === undefined) continue;
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (["true", "1", "yes", "on"].includes(value.toLowerCase())) return true;
      if (["false", "0", "no", "off"].includes(value.toLowerCase())) return false;
    }
    throw new Error(`Invalid boolean: ${String(value)}`);
  }
  return undefined;
}

function flagPresent(args: RawArgs, key: string): boolean {
  return args[key] !== undefined;
}

function csvOrArrayOption(args: RawArgs, ...keys: string[]): string[] | undefined {
  for (const key of keys) {
    const value = args[key];
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === "string" && value.trim() !== "") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return undefined;
}

function jsonObjectOption(args: RawArgs, key: string): Record<string, unknown> | undefined {
  const value = stringOption(args, key);
  if (value === undefined) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error(`${key} must be a JSON object.`);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid --${key}: ${message}`);
  }
}

function requiredPositional(positionals: string[], index: number, name: string): string {
  const value = positionals[index];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
