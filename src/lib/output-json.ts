import type { Trap, TrapActionCard, TrapDetails, TrapEvidence } from "../domain/trap";
import type { Scope } from "./constants";
import type { DoctorReport } from "./doctor";
import type { EmbeddingStatsResult } from "./embedding-health";
import type { TrapListGroup, TrapStatsResult } from "./trap-operations";
import { parseEvidenceRelatedFiles, parseTrapTags } from "./trap-json-fields";

export type JsonTrap = Omit<Trap, "tags"> & {
  tags: string[];
};

export type JsonTrapEvidence = Omit<TrapEvidence, "related_files"> & {
  related_files: string[];
};

export type JsonTrapDetails = {
  scope: Scope;
  trap: JsonTrap;
  evidence: JsonTrapEvidence[];
};

export type CliTrapActionCard = Omit<TrapActionCard, "next_action"> & {
  next_action: {
    command: string;
  };
};

export type McpTextResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export type McpResourceResult = {
  contents: { uri: string; mimeType: string; text: string }[];
};

export function toCliSearchJson(cards: TrapActionCard[]): CliTrapActionCard[] {
  return cards.map((card) => ({
    trap_id: card.trap_id,
    scope: card.scope,
    title: card.title,
    why_relevant: card.why_relevant,
    avoid: card.avoid,
    do_instead: card.do_instead,
    severity: card.severity,
    score: card.score,
    sources: card.sources,
    next_action: {
      command: `codetrap show ${card.trap_id} --scope ${card.scope} --json`,
    },
  }));
}

export function toMcpSearchJson(cards: TrapActionCard[]): TrapActionCard[] {
  return cards;
}

export function toMcpTextJson(value: unknown, isError = false): McpTextResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

export function toMcpTextError(message: string): McpTextResult {
  return toMcpTextJson({ error: message }, true);
}

export function toMcpResourceJson(uri: string, value: unknown): McpResourceResult {
  return {
    contents: [{ uri, mimeType: "application/json", text: JSON.stringify(value, null, 2) }],
  };
}

export function toMcpResourceText(uri: string, text: string): McpResourceResult {
  return {
    contents: [{ uri, mimeType: "text/plain", text }],
  };
}

export function toTrapDetailsJson(details: TrapDetails): JsonTrapDetails {
  return {
    scope: details.scope,
    trap: toTrapJson(details.trap),
    evidence: details.evidence.map(toTrapEvidenceJson),
  };
}

export function toListJson(groups: TrapListGroup[]): JsonTrap[] {
  return groups.flatMap((group) =>
    group.traps.map((trap) => ({
      ...toTrapJson(trap),
      scope: group.scope,
    }))
  );
}

export function toStatsJson(stats: TrapStatsResult, embeddings?: EmbeddingStatsResult) {
  return {
    project: stats.project
      ? {
          ...stats.project,
          embeddings: embeddings?.project ?? null,
        }
      : null,
    global: {
      ...stats.global,
      embeddings: embeddings?.global ?? null,
    },
  };
}

export function toDoctorJson(input: DoctorReport): DoctorReport {
  return input;
}

export function toTrapJson(trap: Trap): JsonTrap {
  return {
    ...trap,
    tags: parseTrapTags(trap.tags),
  };
}

export function toTrapEvidenceJson(evidence: TrapEvidence): JsonTrapEvidence {
  return {
    ...evidence,
    related_files: parseEvidenceRelatedFiles(evidence.related_files),
  };
}
