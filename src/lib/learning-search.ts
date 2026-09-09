import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  lstatSync,
} from "node:fs";
import { join } from "node:path";
import { Phase2Store } from "./phase2-store";
import { EmbeddingRuntime } from "./embedding-runtime";
import { type EmbeddingProvider } from "./embedder";
import { withAdvisoryLock } from "./advisory-lock";
import { writeFileAtomic } from "./fs-json";

export type LearningSearchMode = "fts" | "semantic" | "hybrid";
type Passage = {
  id: string;
  insight_id: string;
  title: string;
  text: string;
  hash: string;
  source_refs: string[];
  collection_title: string | null;
};
type Index = {
  version: 1;
  profile: string;
  dimensions: number;
  entries: Array<{ id: string; hash: string; vector: number[] }>;
};
export type LearningSearchResult = {
  kind: "learning";
  insight_id: string;
  title: string;
  collection_title: string | null;
  snippet: string;
  score: number;
  sources: string[];
  source_refs: string[];
  project_root: string;
  next_action: { command: string; cwd: string };
};
const fingerprint = (text: string) =>
  createHash("sha256").update(text).digest("hex");
const profile = (
  provider: Pick<EmbeddingProvider, "provider" | "model" | "dimensions">,
) =>
  JSON.stringify([
    provider.provider,
    provider.model,
    provider.dimensions,
    "learning-passages-v1",
  ]);
const normalize = (text: string) => text.normalize("NFKC").toLocaleLowerCase();

export function learningPassages(root: string): Passage[] {
  const library = new Phase2Store(root).learningLibrary();
  return library.insights.flatMap((insight) => {
    const membership = library.collection_items.find(
      (item) => item.insight_id === insight.id,
    );
    const collection = library.collections.find(
      (item) => item.id === membership?.collection_id,
    );
    const header = [
      insight.title,
      insight.summary,
      ...(insight.tags ?? []),
      ...(insight.topics ?? []),
      collection?.title,
    ]
      .filter(Boolean)
      .join("\n");
    const sections = [
      insight.body,
      ...(collection?.context_sections ?? []).map(
        (section) => section.title + "\n" + section.body,
      ),
    ];
    // Keep separate paragraphs separate: a cost example should not be embedded
    // together with installation instructions just because both fit one window.
    const sectionsToIndex = [
      header,
      ...sections
        .flatMap((text) => text.split(/\n\s*\n/))
        .filter((text) => text.trim()),
    ];
    const passages: Passage[] = [];
    for (const section of sectionsToIndex) {
      const chars = Array.from(section);
      for (let offset = 0; offset < chars.length; offset += 420) {
        const text = chars.slice(offset, offset + 500).join("");
        passages.push({
          id: insight.id + ":" + passages.length,
          insight_id: insight.id,
          title: insight.title,
          text,
          hash: fingerprint(
            JSON.stringify([
              text,
              insight.title,
              insight.source_refs,
              collection?.title,
            ]),
          ),
          source_refs: insight.source_refs,
          collection_title: collection?.title ?? null,
        });
      }
    }
    return passages;
  });
}
function vectorValid(vector: unknown, dimensions: number): vector is number[] {
  return (
    Array.isArray(vector) &&
    vector.length === dimensions &&
    vector.every((n) => typeof n === "number" && Number.isFinite(n)) &&
    vector.some((n) => n !== 0)
  );
}
function cosine(a: number[], b: number[]): number {
  let dot = 0,
    x = 0,
    y = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    x += a[i] ** 2;
    y += b[i] ** 2;
  }
  return dot / Math.sqrt(x * y);
}
function terms(query: string): string[] {
  return [...new Set(normalize(query).match(/[\p{L}\p{N}_-]+/gu) ?? [])];
}
function keywordScore(passage: Passage, query: string): number {
  const text = normalize(passage.text),
    title = normalize(passage.title);
  const words = terms(query);
  return words.reduce(
    (sum, word) =>
      sum + (text.includes(word) ? 1 : 0) + (title.includes(word) ? 2 : 0),
    0,
  );
}
function snippet(passage: Passage, query: string): string {
  const lower = normalize(passage.text);
  const found = terms(query)
    .map((term) => lower.indexOf(term))
    .filter((i) => i >= 0);
  const start = Math.max(0, (found.length ? Math.min(...found) : 0) - 70);
  return (
    (start ? "…" : "") +
    passage.text.slice(start, start + 350) +
    (start + 350 < passage.text.length ? "…" : "")
  );
}

export class LearningSearch {
  constructor(
    readonly root: string,
    readonly runtime = EmbeddingRuntime.fromEnvironment(),
  ) {}
  private directory() {
    return join(this.root, ".codetrap", "learning");
  }
  private path() {
    return join(this.directory(), "search-index.json");
  }
  private safePaths() {
    for (const path of [
      join(this.root, ".codetrap"),
      this.directory(),
      this.path(),
    ]) {
      if (existsSync(path) && lstatSync(path).isSymbolicLink())
        throw new Error("Learning search storage must not be a symbolic link.");
    }
  }
  private read(): Index | null {
    this.safePaths();
    if (!existsSync(this.path())) return null;
    if (statSync(this.path()).size > 128 * 1024 * 1024)
      throw new Error("Learning search index exceeds 128 MiB.");
    const value = JSON.parse(readFileSync(this.path(), "utf8"));
    if (
      value?.version !== 1 ||
      typeof value.profile !== "string" ||
      !Number.isInteger(value.dimensions) ||
      value.dimensions < 1 ||
      !Array.isArray(value.entries)
    )
      throw new Error("Invalid Learning search index. Rebuild it.");
    const ids = new Set<string>();
    for (const entry of value.entries) {
      if (
        typeof entry?.id !== "string" ||
        ids.has(entry.id) ||
        typeof entry.hash !== "string" ||
        !vectorValid(entry.vector, value.dimensions)
      )
        throw new Error("Invalid Learning search vector. Rebuild the index.");
      ids.add(entry.id);
    }
    return value;
  }
  status() {
    const passages = learningPassages(this.root),
      config = this.runtime.config();
    let index: Index | null = null,
      error: string | null = null;
    try {
      index = this.read();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    const entries =
      index && config && index.profile === profile(config)
        ? new Map(index.entries.map((entry) => [entry.id, entry]))
        : new Map();
    const fresh = passages.filter(
      (p) => entries.get(p.id)?.hash === p.hash,
    ).length;
    return {
      project_root: this.root,
      passages: passages.length,
      fresh,
      missing_or_stale: passages.length - fresh,
      profile: config ? profile(config) : null,
      error,
      next_action: { command: "codetrap learn reindex --json", cwd: this.root },
    };
  }
  async reindex() {
    const provider = this.runtime.requireProvider(),
      passages = learningPassages(this.root),
      key = profile(provider);
    let old: Index | null = null;
    try {
      old = this.read();
    } catch {
      /* Explicit rebuild repairs corrupt derived data. */
    }
    const cached = new Map(
      old?.profile === key ? old.entries.map((entry) => [entry.id, entry]) : [],
    );
    const entries: Index["entries"] = [],
      pending = passages.filter((p) => cached.get(p.id)?.hash !== p.hash);
    for (let offset = 0; offset < pending.length; offset += 16) {
      const batch = pending.slice(offset, offset + 16),
        vectors = await provider.embed(
          batch.map((p) => p.text),
          "retrieval.passage",
        );
      if (vectors.length !== batch.length)
        throw new Error(
          "Embedding provider returned an incomplete batch. Previous index was preserved.",
        );
      batch.forEach((p, i) => {
        const vector = Array.from(vectors[i]);
        if (!vectorValid(vector, provider.dimensions))
          throw new Error(
            "Embedding provider returned an invalid vector. Previous index was preserved.",
          );
        entries.push({ id: p.id, hash: p.hash, vector });
      });
    }
    for (const p of passages) {
      const entry = cached.get(p.id);
      if (entry?.hash === p.hash) entries.push(entry);
    }
    const document: Index = {
      version: 1,
      profile: key,
      dimensions: provider.dimensions,
      entries,
    };
    const serialized = JSON.stringify(document);
    if (Buffer.byteLength(serialized) > 128 * 1024 * 1024)
      throw new Error(
        "Learning search index exceeds 128 MiB. Previous index was preserved.",
      );
    this.safePaths();
    mkdirSync(this.directory(), { recursive: true });
    withAdvisoryLock(join(this.directory(), ".search.lock"), () => {
      const current = learningPassages(this.root);
      if (
        JSON.stringify(current.map((p) => [p.id, p.hash])) !==
        JSON.stringify(passages.map((p) => [p.id, p.hash]))
      )
        throw new Error(
          "Learning content changed during indexing. Retry; previous index was preserved.",
        );
      writeFileAtomic(this.path(), serialized);
    });
    return {
      success: true,
      generated: pending.length,
      reused: entries.length - pending.length,
      ...this.status(),
    };
  }
  async search(query: string, mode: LearningSearchMode = "hybrid", limit = 20) {
    if (!["fts", "semantic", "hybrid"].includes(mode))
      throw new Error("mode must be fts, semantic or hybrid.");
    if (!query.trim() || query.length > 2000)
      throw new Error("Provide a query of 1–2000 characters.");
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new Error("limit must be an integer from 1 to 100.");
    const passages = learningPassages(this.root),
      diagnostics: Array<{ code: string; message: string }> = [];
    const lexical =
      mode === "semantic"
        ? []
        : passages
            .map((p) => ({ p, score: keywordScore(p, query) }))
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score);
    let semantic: Array<{ p: Passage; score: number }> = [];
    if (mode !== "fts" && passages.length) {
      try {
        const provider = this.runtime.requireSearchProvider(),
          index = this.read();
        const entries = new Map(
          index?.profile === profile(provider)
            ? index.entries.map((e) => [e.id, e])
            : [],
        );
        const fresh = passages.filter(
          (p) => entries.get(p.id)?.hash === p.hash,
        );
        if (fresh.length !== passages.length)
          diagnostics.push({
            code: "partial_index",
            message:
              "Some Learning passages are missing or stale. Run codetrap learn reindex --json.",
          });
        if (fresh.length) {
          const vectors = await provider.embed([query], "retrieval.query");
          const vector = vectors[0] ? Array.from(vectors[0]) : [];
          if (vectors.length !== 1 || !vectorValid(vector, provider.dimensions))
            throw new Error("Invalid query embedding.");
          semantic = fresh
            .map((p) => ({
              p,
              score: cosine(vector, entries.get(p.id)!.vector),
            }))
            .filter((x) => x.score >= 0.3)
            .sort((a, b) => b.score - a.score);
          if (!semantic.length)
            diagnostics.push({
              code: "semantic_no_candidates",
              message: "No semantic matches exceeded the similarity threshold.",
            });
        }
      } catch (error) {
        diagnostics.push({
          code: "semantic_unavailable",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    const ranked = new Map<
      string,
      { p: Passage; score: number; sources: Set<string> }
    >();
    for (const [source, list] of [
      ["fts", lexical],
      ["semantic", semantic],
    ] as const) {
      // Fuse once per insight so long lessons do not win by having more chunks.
      const seen = new Set<string>();
      for (const entry of list) {
        if (seen.has(entry.p.insight_id)) continue;
        seen.add(entry.p.insight_id);
        const score = 1 / (60 + seen.size),
          existing = ranked.get(entry.p.insight_id);
        if (existing) {
          existing.score += score;
          existing.sources.add(source);
        } else
          ranked.set(entry.p.insight_id, {
            p: entry.p,
            score,
            sources: new Set([source]),
          });
      }
    }
    // A source can be changed/deleted while a remote query embedding is pending.
    const current = new Map(
      learningPassages(this.root).map((p) => [p.id, p.hash]),
    );
    const results: LearningSearchResult[] = [...ranked.values()]
      .filter((x) => current.get(x.p.id) === x.p.hash)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ p, score, sources }) => ({
        kind: "learning",
        insight_id: p.insight_id,
        title: p.title,
        collection_title: p.collection_title,
        snippet: snippet(p, query),
        score,
        sources: [...sources],
        source_refs: p.source_refs,
        project_root: this.root,
        next_action: {
          command: `codetrap learn show ${p.insight_id} --json`,
          cwd: this.root,
        },
      }));
    return { success: true, mode, results, diagnostics };
  }
}
