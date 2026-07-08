// L11: include the astral CJK Unified Ideographs Extension B\u2013F block so those
// characters bigram instead of dropping out entirely.
const CJK_RUN = /[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af\u{20000}-\u{2fa1f}]+/gu;
const ASCII_TOKEN = /[A-Za-z0-9_.$/@:-]+/g;

const SYNONYMS: Record<string, string[]> = {
  "请求": ["http", "https", "fetch", "request", "axios"],
  "认证": ["auth", "authentication", "login", "session"],
  "数据库": ["db", "sql", "sqlite", "migration"],
  "配置": ["config", "env", "environment"],
  "缓存": ["cache", "redis"],
  "路由": ["route", "router"],
};

export type SearchTextFields = {
  title?: string;
  context?: string;
  mistake?: string;
  fix?: string;
  tags?: string | string[];
  before_code?: string | null;
  after_code?: string | null;
  path_globs?: string | string[] | null;
  module?: string | null;
  owner?: string | null;
};

export const SEARCH_TEXT_FIELD_NAMES = [
  "title",
  "context",
  "mistake",
  "fix",
  "tags",
  "before_code",
  "after_code",
  "path_globs",
  "module",
  "owner",
] as const;

export type CJKGramOptions = {
  // The index stores multi-character CJK content as bigrams, so a lone CJK
  // character in a *query* can never match as an exact term. Mark it as a
  // prefix (`缓*`) instead so it matches any token that starts with it.
  prefixSingleChar?: boolean;
};

export function bigramCJK(input: string, opts: CJKGramOptions = {}): string[] {
  const grams: string[] = [];
  for (const run of input.matchAll(CJK_RUN)) {
    const chars = Array.from(run[0]);
    if (chars.length === 1) {
      grams.push(opts.prefixSingleChar ? `${chars[0]}*` : chars[0]);
      continue;
    }
    for (let i = 0; i < chars.length - 1; i++) {
      grams.push(chars[i] + chars[i + 1]);
    }
  }
  return grams;
}

export function buildSearchText(fields: SearchTextFields, opts: CJKGramOptions = {}): string {
  // L11: NFKC folds full-width ASCII (ＡＢＣ → ABC) and compatibility forms so
  // they tokenize instead of normalizing to nothing.
  const source = fieldsToText(fields).normalize("NFKC");
  const tokens = new Set<string>();

  for (const token of source.match(ASCII_TOKEN) ?? []) {
    tokens.add(token.toLowerCase());
  }

  for (const gram of bigramCJK(source, opts)) {
    addTokenWithSynonyms(tokens, gram);
  }

  for (const [trigger, expansions] of Object.entries(SYNONYMS)) {
    if (source.includes(trigger)) {
      tokens.add(trigger);
      for (const expansion of expansions) tokens.add(expansion);
    }
  }

  return [...tokens].join(" ");
}

export function normalizeQuery(query: string): string {
  return buildSearchText({ title: query }, { prefixSingleChar: true });
}

function addTokenWithSynonyms(tokens: Set<string>, token: string): void {
  tokens.add(token);
  for (const expansion of SYNONYMS[token] ?? []) {
    tokens.add(expansion);
  }
}

function fieldsToText(fields: SearchTextFields): string {
  const parts: string[] = [];
  for (const field of SEARCH_TEXT_FIELD_NAMES) {
    const value = fields[field];
    if (Array.isArray(value)) {
      parts.push(value.join(" "));
    } else if (typeof value === "string") {
      parts.push(value);
    }
  }
  return parts.join(" ");
}
