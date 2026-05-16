import { createHash } from "node:crypto";
import type { Trap, TrapInput, TrapUpdate } from "../domain/trap";
import type { EmbeddingConfig, StoredEmbedding } from "./embedder";
import { buildSearchText, SEARCH_TEXT_FIELD_NAMES, type SearchTextFields } from "./search-normalizer";
import { parseTrapTags } from "./trap-json-fields";

export const PASSAGE_VERSION = 1;

export const PASSAGE_FIELD_NAMES = [
  "title",
  "category",
  "context",
  "mistake",
  "fix",
  "tags",
  "before_code",
  "after_code",
  "severity",
] as const;

export type TrapSearchDocumentFields = SearchTextFields & {
  title?: string;
  category?: string;
  severity?: string;
};

export function buildTrapSearchText(fields: SearchTextFields): string {
  return buildSearchText(fields);
}

export function buildTrapPassage(trap: TrapSearchDocumentFields): string {
  const tags = parseTrapTags(trap.tags).join(", ");
  return [
    trap.title ? `Title: ${trap.title}` : "",
    trap.category ? `Category: ${trap.category}` : "",
    trap.severity ? `Severity: ${trap.severity}` : "",
    tags ? `Tags: ${tags}` : "",
    trap.context ? `Context: ${trap.context}` : "",
    trap.mistake ? `Mistake: ${trap.mistake}` : "",
    trap.fix ? `Fix: ${trap.fix}` : "",
    trap.before_code ? `Before code:\n${trap.before_code}` : "",
    trap.after_code ? `After code:\n${trap.after_code}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function hashTrapPassage(passage: string): string {
  return createHash("sha256").update(passage).digest("hex");
}

export function passageHashForTrap(trap: TrapSearchDocumentFields): string {
  return hashTrapPassage(buildTrapPassage(trap));
}

export function searchTextFieldsChanged(input: Partial<TrapInput>): boolean {
  return SEARCH_TEXT_FIELD_NAMES.some((field) => input[field] !== undefined);
}

export function passageFieldsChanged(input: TrapUpdate): boolean {
  return PASSAGE_FIELD_NAMES.some((field) => input[field] !== undefined);
}

export function embeddingIsFresh(trap: Trap, embedding: StoredEmbedding | null, config: EmbeddingConfig): boolean {
  return Boolean(
    embedding &&
      embedding.provider === config.provider &&
      embedding.model === config.model &&
      embedding.dimensions === config.dimensions &&
      embedding.passage_version === config.passageVersion &&
      embedding.passage_hash === passageHashForTrap(trap)
  );
}
