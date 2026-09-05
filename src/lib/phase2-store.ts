import { LEGACY_EVAL_SUITE, requireEvalPath, evalSuiteHash, evalCorpusHash } from "./project-eval-suite";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { CandidateTrap } from "../domain/session";
import {
  collectionContextSourceRefs,
  normalizeCollectionContextSections,
  normalizeSourceCoverage,
  normalizeSourceUnitRefs,
  sourceCoverageSummary,
  type CollectionContextSection,
  type SourceCoverageManifest,
  type SourceCoverageSummary,
} from "../domain/source-coverage";
import { CODETRAP_DIR } from "./constants";
import { withAdvisoryLock } from "./advisory-lock";
import { readJsonFile, writeFileAtomic } from "./fs-json";
import { normalizeDogfoodCase, parseEvalFixture } from "./search-eval";

export type Phase2Snapshot = { path: string; before: string | null; after: string };
export type Phase2Commit = {
  id: string;
  candidate_id: string;
  session_id: string;
  destination: string;
  committed_at: string;
  reverted_at: string | null;
  snapshots: Phase2Snapshot[];
};

export type InsightRecord = {
  id: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  source_refs: string[];
  source_type?: InsightSourceType;
  topics?: string[];
  /** Stable source-unit ids taught by this Insight. */
  source_unit_refs?: string[];
  shelved_at: string;
  consulted_count: number;
  last_consulted_at: string | null;
};

export const INSIGHT_SOURCE_TYPES = [
  "article",
  "conversation",
  "documentation",
  "paper",
  "video",
  "course",
  "manual",
  "other",
] as const;
export type InsightSourceType = (typeof INSIGHT_SOURCE_TYPES)[number];

export type InsightCollectionRecord = {
  id: string;
  title: string;
  summary: string;
  source_type: InsightSourceType;
  source_refs: string[];
  topics: string[];
  source_coverage?: SourceCoverageManifest;
  /** Source-backed background preserved without becoming a study chapter. */
  context_sections?: CollectionContextSection[];
  /** Derived on read from the manifest and Insights that actually exist. */
  coverage_summary?: SourceCoverageSummary;
  created_at: string;
  updated_at: string;
  /** Read-time legacy grouping; persisted only after an explicit edit. */
  inferred?: boolean;
};

export type InsightCollectionItem = {
  collection_id: string;
  insight_id: string;
  position: number;
};

export type InsightLibrary = {
  version: 2;
  insights: InsightRecord[];
  collections: InsightCollectionRecord[];
  collection_items: InsightCollectionItem[];
};

export type Phase2Event = {
  type: "authorization_invalidated" | "recall_outcome" | "graduated" | "validated";
  recorded_at: string;
  candidate_id?: string;
  trap_id?: number;
  scope?: string;
  channel?: "preflight" | "curated";
  useful?: boolean;
};

type CommitDocument = { version: 1; commits: Phase2Commit[] };
type InsightDocument = {
  version: 1 | 2;
  insights: InsightRecord[];
  collections?: InsightCollectionRecord[];
  collection_items?: InsightCollectionItem[];
};
type PreparedInsightCollection = {
  id: string;
  title: string;
  summary: string;
  source_type: InsightSourceType;
  source_refs: string[];
  topics: string[];
  source_coverage?: SourceCoverageManifest;
  context_sections: CollectionContextSection[];
  replace_context_sections: boolean;
  position: unknown;
};
type EventDocument = { version: 1; events: Phase2Event[] };

const PHASE2_DIR = "phase2";
const LOCK_DIR = ".phase2.lock";

export class Phase2Store {
  constructor(private readonly projectRoot: string) {}

  preview(candidate: CandidateTrap, now = new Date()) {
    return this.renderSnapshots(candidate, now).map((snapshot) => ({
      path: snapshot.path,
      created: snapshot.before === null,
      changed: snapshot.before !== snapshot.after,
      before: snapshot.before,
      after: snapshot.after,
    }));
  }

  apply(sessionId: string, candidate: CandidateTrap, now = new Date()): Phase2Commit {
    return this.withLock(() => {
      const snapshots = this.renderSnapshots(candidate, now);
      const applied: Phase2Snapshot[] = [];
      try {
        for (const snapshot of snapshots) {
          const absolute = this.safeProjectPath(snapshot.path);
          mkdirSync(dirname(absolute), { recursive: true });
          writeFileAtomic(absolute, snapshot.after);
          applied.push(snapshot);
        }
      } catch (error) {
        for (const snapshot of applied.reverse()) this.restoreSnapshot(snapshot);
        throw error;
      }

      const commit: Phase2Commit = {
        id: `p2-${now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`,
        candidate_id: candidate.id,
        session_id: sessionId,
        destination: candidate.candidate_kind ?? "unclassified",
        committed_at: now.toISOString(),
        reverted_at: null,
        snapshots,
      };
      const document = this.readCommits();
      this.writeCommits({ version: 1, commits: [...document.commits, commit] });
      return commit;
    });
  }

  revert(commitId: string, now = new Date()): Phase2Commit {
    return this.withLock(() => {
      const document = this.readCommits();
      const commit = document.commits.find((item) => item.id === commitId);
      if (!commit) throw new Error(`Phase 2 commit ${commitId} not found.`);
      if (commit.reverted_at) throw new Error(`Phase 2 commit ${commitId} was already reverted.`);
      for (const snapshot of commit.snapshots) {
        const absolute = this.safeProjectPath(snapshot.path);
        const current = existsSync(absolute) ? readFileSync(absolute, "utf-8") : null;
        if (current !== snapshot.after) {
          throw new Error(`Refusing to revert ${snapshot.path}: it changed after ${commitId}.`);
        }
      }
      for (const snapshot of [...commit.snapshots].reverse()) this.restoreSnapshot(snapshot);
      commit.reverted_at = now.toISOString();
      this.writeCommits(document);
      return commit;
    });
  }

  listCommits(): Phase2Commit[] {
    return [...this.readCommits().commits].reverse();
  }

  listInsights(): InsightRecord[] {
    return [...this.readInsights().insights].reverse();
  }

  learningLibrary(): InsightLibrary {
    return libraryFromDocument(this.readInsights());
  }

  updateCollection(
    id: string,
    updates: { title?: string; summary?: string; topics?: string[] },
    now = new Date()
  ): InsightCollectionRecord {
    return this.withLock(() => {
      const document = materializeInferredCollection(this.readInsights(), id);
      const collection = document.collections?.find((item) => item.id === id);
      if (!collection) throw new Error(`Insight collection ${id} not found.`);
      if (updates.title !== undefined) collection.title = requiredText(updates.title, "collection.title");
      if (updates.summary !== undefined) collection.summary = updates.summary.trim();
      if (updates.topics !== undefined) collection.topics = normalizedStrings(updates.topics);
      collection.updated_at = now.toISOString();
      delete collection.inferred;
      this.writeInsights(document);
      return collection;
    });
  }

  reorderCollection(id: string, insightIds: string[], now = new Date()): InsightCollectionItem[] {
    return this.withLock(() => {
      const document = materializeInferredCollection(this.readInsights(), id);
      const collection = document.collections?.find((item) => item.id === id);
      if (!collection) throw new Error(`Insight collection ${id} not found.`);
      const current = (document.collection_items ?? []).filter((item) => item.collection_id === id);
      const requested = normalizedStrings(insightIds);
      if (requested.length !== insightIds.length || requested.length !== current.length) {
        throw new Error(`Collection ${id} reorder must contain every member exactly once.`);
      }
      const currentIds = new Set(current.map((item) => item.insight_id));
      if (requested.some((insightId) => !currentIds.has(insightId))) {
        throw new Error(`Collection ${id} reorder contains an unknown member.`);
      }
      const reordered = requested.map((insight_id, index) => ({
        collection_id: id,
        insight_id,
        position: index + 1,
      }));
      document.collection_items = [
        ...(document.collection_items ?? []).filter((item) => item.collection_id !== id),
        ...reordered,
      ];
      collection.updated_at = now.toISOString();
      delete collection.inferred;
      this.writeInsights(document);
      return reordered;
    });
  }

  consultInsight(id: string, now = new Date()): InsightRecord {
    return this.withLock(() => {
      const document = this.readInsights();
      const insight = document.insights.find((item) => item.id === id);
      if (!insight) throw new Error(`Insight ${id} not found.`);
      // "Mark learned" is a state transition, not a click counter. Keeping it
      // idempotent also makes a retry safe when the browser loses the first
      // response after the write succeeded.
      if (insight.consulted_count > 0) return insight;
      insight.consulted_count = 1;
      insight.last_consulted_at = now.toISOString();
      this.writeInsights(document);
      return insight;
    });
  }

  appendEvent(event: Omit<Phase2Event, "recorded_at">, now = new Date()): Phase2Event {
    return this.withLock(() => {
      const recorded = { ...event, recorded_at: now.toISOString() } as Phase2Event;
      const document = this.readEvents();
      this.writeEvents({ version: 1, events: [...document.events, recorded] });
      return recorded;
    });
  }

  listEvents(): Phase2Event[] {
    return this.readEvents().events;
  }

  private renderSnapshots(candidate: CandidateTrap, now: Date): Phase2Snapshot[] {
    const kind = candidate.candidate_kind ?? "unclassified";
    const payload = candidate.destination_payload ?? {};
    if (kind === "project_convention") {
      const sectionId = requiredText(payload.section_id, "payload.section_id");
      const title = requiredText(payload.title ?? candidate.trap.title, "payload.title");
      const content = requiredText(payload.content, "payload.content");
      return ["AGENTS.md", "CLAUDE.md"].map((path) => this.textSnapshot(
        path,
        (before) => upsertManagedSection(before, "convention", sectionId, title, content)
      ));
    }
    if (kind === "docs_guidance") {
      const path = requiredText(payload.path, "payload.path");
      this.assertDocsPath(path);
      const sectionId = requiredText(payload.section_id, "payload.section_id");
      const title = requiredText(payload.title ?? candidate.trap.title, "payload.title");
      const content = requiredText(payload.content, "payload.content");
      return [this.textSnapshot(path, (before) => upsertManagedSection(before, "docs", sectionId, title, content))];
    }
    if (kind === "search_eval_case") {
      const path = payload.fixture_path === undefined ? LEGACY_EVAL_SUITE : requireEvalPath(payload.fixture_path);
      const testCase = recordValue(payload.case, "payload.case");
      return [this.textSnapshot(path, (before) => {
        if (before === null) throw new Error(`${path} does not exist.`);
        const fixture = parseEvalFixture(before, path);
        if (payload.corpus_sha256 && payload.corpus_sha256 !== evalCorpusHash(fixture)) throw new Error("The evaluation corpus changed. Start a new review; fixture IDs cannot be remapped automatically.");
        if (payload.fixture_sha256 && payload.fixture_sha256 !== evalSuiteHash(before)) throw new Error("The evaluation suite changed after preview. Preview the example again.");
        const query = normalizeDogfoodCase(testCase, fixture);
        const queries = [...fixture.queries];
        const key = JSON.stringify(query);
        if (!queries.some((item) => JSON.stringify(item) === key)) queries.push(query);
        return `${JSON.stringify({ ...fixture, queries }, null, 2)}\n`;
      })];
    }
    if (kind === "insight") {
      const path = this.relativeInsightsPath();
      const before = this.readOptional(path);
      const document = before === null
        ? emptyInsightDocument()
        : normalizedInsightDocument(parseInsightDocument(before, path));
      const sourceRefs = stringArray(payload.source_refs ?? candidate.source_manifest_refs);
      const collectionPayload = optionalRecordValue(payload.collection);
      const sourceType = parseInsightSourceType(payload.source_type, inferSourceType(sourceRefs[0]));
      const topics = normalizedStrings(stringArray(payload.topics));
      const preparedCollection = collectionPayload
        ? prepareInsightCollection(document, collectionPayload, sourceRefs, sourceType, topics)
        : undefined;
      const sourceUnitRefs = normalizeSourceUnitRefs(
        payload.source_unit_refs,
        preparedCollection?.source_coverage,
        "payload.source_unit_refs"
      );
      if (preparedCollection?.source_coverage && sourceUnitRefs.length === 0) {
        throw new Error("payload.source_unit_refs must identify at least one learned source unit when source_coverage is present.");
      }
      const insight: InsightRecord = {
        id: `ins-${candidate.content_hash?.slice(0, 12) ?? candidate.id}`,
        title: requiredText(payload.title ?? candidate.trap.title, "payload.title"),
        summary: requiredText(payload.summary ?? candidate.rationale ?? candidate.trap.context, "payload.summary"),
        body: requiredText(payload.body ?? candidate.trap.fix, "payload.body"),
        tags: stringArray(payload.tags),
        source_refs: sourceRefs,
        source_type: sourceType,
        topics,
        ...(sourceUnitRefs.length > 0 ? { source_unit_refs: sourceUnitRefs } : {}),
        shelved_at: now.toISOString(),
        consulted_count: 0,
        last_consulted_at: null,
      };
      if (!document.insights.some((item) => item.id === insight.id)) document.insights.push(insight);
      if (preparedCollection) {
        upsertInsightCollection(document, insight, preparedCollection, now);
      }
      return [{ path, before, after: `${JSON.stringify(document, null, 2)}\n` }];
    }
    throw new Error(`Candidate ${candidate.id} has unsupported Phase 2 destination ${kind}.`);
  }

  private textSnapshot(path: string, transform: (before: string | null) => string): Phase2Snapshot {
    const before = this.readOptional(path);
    return { path: normalizeRelativePath(path), before, after: transform(before) };
  }

  private restoreSnapshot(snapshot: Phase2Snapshot): void {
    const absolute = this.safeProjectPath(snapshot.path);
    if (snapshot.before === null) {
      if (existsSync(absolute)) unlinkSync(absolute);
      return;
    }
    writeFileAtomic(absolute, snapshot.before);
  }

  private assertDocsPath(path: string): void {
    const normalized = normalizeRelativePath(path);
    if (!(normalized === "README.md" || normalized === "AGENTS.md" || normalized === "CLAUDE.md" || /^docs\/.+\.md$/i.test(normalized))) {
      throw new Error("docs_guidance may target README.md, AGENTS.md, CLAUDE.md, or docs/**/*.md only.");
    }
  }

  private safeProjectPath(path: string): string {
    const absolute = resolve(this.projectRoot, normalizeRelativePath(path));
    const rel = relative(this.projectRoot, absolute).replace(/\\/g, "/");
    if (!rel || rel.startsWith("../") || rel === "..") throw new Error(`Unsafe Phase 2 target path: ${path}`);
    return absolute;
  }

  private readOptional(path: string): string | null {
    const absolute = this.safeProjectPath(path);
    return existsSync(absolute) ? readFileSync(absolute, "utf-8") : null;
  }

  private relativeInsightsPath(): string { return `${CODETRAP_DIR}/${PHASE2_DIR}/insights.json`; }
  private phase2Dir(): string { return join(this.projectRoot, CODETRAP_DIR, PHASE2_DIR); }
  private commitsPath(): string { return join(this.phase2Dir(), "commits.json"); }
  private insightsPath(): string { return join(this.phase2Dir(), "insights.json"); }
  private eventsPath(): string { return join(this.phase2Dir(), "events.json"); }

  private readCommits(): CommitDocument {
    return existsSync(this.commitsPath()) ? readJsonFile(this.commitsPath(), "Phase 2 commits") : { version: 1, commits: [] };
  }
  private readInsights(): InsightDocument {
    return existsSync(this.insightsPath())
      ? parseInsightDocument(readFileSync(this.insightsPath(), "utf-8"), this.insightsPath())
      : emptyInsightDocument();
  }
  private readEvents(): EventDocument {
    return existsSync(this.eventsPath()) ? readJsonFile(this.eventsPath(), "Phase 2 events") : { version: 1, events: [] };
  }
  private writeCommits(document: CommitDocument): void { this.writeJson(this.commitsPath(), document); }
  private writeInsights(document: InsightDocument): void {
    this.writeJson(this.insightsPath(), normalizedInsightDocument(document));
  }
  private writeEvents(document: EventDocument): void { this.writeJson(this.eventsPath(), document); }
  private writeJson(path: string, value: unknown): void {
    mkdirSync(dirname(path), { recursive: true });
    writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
  }
  private withLock<T>(fn: () => T): T {
    mkdirSync(this.phase2Dir(), { recursive: true });
    return withAdvisoryLock(join(this.phase2Dir(), LOCK_DIR), fn).value;
  }
}

function upsertManagedSection(before: string | null, namespace: string, id: string, title: string, content: string): string {
  const start = `<!-- codetrap:${namespace}:${id}:start -->`;
  const end = `<!-- codetrap:${namespace}:${id}:end -->`;
  const block = `${start}\n## ${title}\n\n${content.trim()}\n${end}`;
  const source = before ?? "";
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end);
  if (startIndex >= 0 && endIndex >= startIndex) {
    return `${source.slice(0, startIndex)}${block}${source.slice(endIndex + end.length)}`;
  }
  const prefix = source.trimEnd();
  return `${prefix}${prefix ? "\n\n" : ""}${block}\n`;
}

function normalizeRelativePath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/^\.\//, "");
}

function requiredText(value: unknown, field: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${field} is required.`);
  return text;
}

function recordValue(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field} must be an object.`);
  return value as Record<string, unknown>;
}

function optionalRecordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function normalizedStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values.map(String).map((item) => item.trim()).filter(Boolean)) {
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
  }
  return normalized;
}

function emptyInsightDocument(): InsightDocument {
  return { version: 2, insights: [], collections: [], collection_items: [] };
}

function normalizedInsightDocument(document: InsightDocument): InsightDocument {
  const insightIds = new Set(document.insights.map((insight) => insight.id));
  const collections = (document.collections ?? []).map((collection) => {
    const { inferred: _inferred, coverage_summary: _coverageSummary, ...persisted } = collection;
    return {
      ...persisted,
      source_type: parseInsightSourceType(collection.source_type, inferSourceType(collection.source_refs?.[0])),
      source_refs: normalizedStrings(collection.source_refs ?? []),
      topics: normalizedStrings(collection.topics ?? []),
      ...(collection.source_coverage ? {
        source_coverage: normalizeSourceCoverage(
          collection.source_coverage,
          `collection ${collection.id}.source_coverage`
        ),
      } : {}),
      ...(collection.context_sections?.length ? {
        context_sections: normalizeCollectionContextSections(
          collection.context_sections,
          collection.source_coverage,
          `collection ${collection.id}.context_sections`
        ),
      } : {}),
    };
  });
  const collectionIds = new Set(collections.map((collection) => collection.id));
  const collectionItems = (document.collection_items ?? [])
    .filter((item) => collectionIds.has(item.collection_id) && insightIds.has(item.insight_id))
    .map((item) => ({
      collection_id: item.collection_id,
      insight_id: item.insight_id,
      position: positiveInteger(item.position, 1),
    }));
  return {
    version: 2,
    insights: document.insights.map((insight) => ({
      ...insight,
      tags: normalizedStrings(insight.tags ?? []),
      source_refs: normalizedStrings(insight.source_refs ?? []),
      source_type: parseInsightSourceType(insight.source_type, inferSourceType(insight.source_refs?.[0])),
      topics: normalizedStrings(insight.topics ?? []),
      ...(insight.source_unit_refs?.length ? {
        source_unit_refs: normalizedStrings(insight.source_unit_refs),
      } : {}),
    })),
    collections,
    collection_items: collectionItems,
  };
}

function libraryFromDocument(document: InsightDocument): InsightLibrary {
  const normalized = normalizedInsightDocument(document);
  const explicitCollections = normalized.collections ?? [];
  const explicitItems = normalized.collection_items ?? [];
  const groupedIds = new Set(explicitItems.map((item) => item.insight_id));
  const inferred = inferLegacyCollections(
    normalized.insights.filter((insight) => !groupedIds.has(insight.id))
  );
  const collections = [...explicitCollections, ...inferred.collections];
  const collectionItems = [...explicitItems, ...inferred.collection_items];
  const insightsById = new Map(normalized.insights.map((insight) => [insight.id, insight]));
  return {
    version: 2,
    insights: [...normalized.insights].reverse(),
    collections: collections.map((collection) => {
      const coveredRefs = collectionItems
        .filter((item) => item.collection_id === collection.id)
        .flatMap((item) => insightsById.get(item.insight_id)?.source_unit_refs ?? [])
        .concat(collectionContextSourceRefs(collection.context_sections));
      return {
        ...collection,
        coverage_summary: sourceCoverageSummary(collection.source_coverage, coveredRefs),
      };
    }),
    collection_items: collectionItems,
  };
}

function materializeInferredCollection(document: InsightDocument, id: string): InsightDocument {
  const normalized = normalizedInsightDocument(document);
  if (normalized.collections?.some((collection) => collection.id === id)) return normalized;
  const library = libraryFromDocument(normalized);
  const inferred = library.collections.find((collection) => collection.id === id && collection.inferred);
  if (!inferred) return normalized;
  const { inferred: _inferred, ...persisted } = inferred;
  normalized.collections = [...(normalized.collections ?? []), persisted];
  normalized.collection_items = [
    ...(normalized.collection_items ?? []),
    ...library.collection_items.filter((item) => item.collection_id === id),
  ];
  return normalized;
}

function upsertInsightCollection(
  document: InsightDocument,
  insight: InsightRecord,
  payload: PreparedInsightCollection,
  now: Date
): void {
  const timestamp = now.toISOString();
  const collections = document.collections ?? [];
  const existing = collections.find((collection) => collection.id === payload.id);
  if (existing) {
    existing.title = payload.title;
    existing.summary = payload.summary || existing.summary;
    existing.source_type = payload.source_type;
    existing.source_refs = payload.source_refs.length > 0 ? payload.source_refs : existing.source_refs;
    existing.topics = payload.topics.length > 0 ? payload.topics : existing.topics;
    if (payload.source_coverage) existing.source_coverage = payload.source_coverage;
    if (payload.replace_context_sections) existing.context_sections = payload.context_sections;
    existing.updated_at = timestamp;
  } else {
    collections.push({
      id: payload.id,
      title: payload.title,
      summary: payload.summary,
      source_type: payload.source_type,
      source_refs: payload.source_refs,
      topics: payload.topics,
      ...(payload.source_coverage ? { source_coverage: payload.source_coverage } : {}),
      ...(payload.context_sections.length > 0 ? { context_sections: payload.context_sections } : {}),
      created_at: timestamp,
      updated_at: timestamp,
    });
  }
  document.collections = collections;

  const items = (document.collection_items ?? []).filter((item) => item.insight_id !== insight.id);
  const collectionItems = items.filter((item) => item.collection_id === payload.id);
  const occupiedPositions = new Set<number>();
  for (const item of collectionItems) {
    if (occupiedPositions.has(item.position)) {
      throw new Error(`Collection ${payload.id} already contains duplicate position ${item.position}; reorder it before applying another Insight.`);
    }
    occupiedPositions.add(item.position);
  }
  const desired = positiveInteger(payload.position, nextCollectionPosition(items, payload.id));
  const occupied = collectionItems.find((item) => item.position === desired);
  if (occupied) {
    throw new Error(`Collection ${payload.id} position ${desired} is already occupied by Insight ${occupied.insight_id}.`);
  }
  document.collection_items = [...items, { collection_id: payload.id, insight_id: insight.id, position: desired }];
}

function prepareInsightCollection(
  document: InsightDocument,
  payload: Record<string, unknown>,
  insightSourceRefs: string[],
  insightSourceType: InsightSourceType,
  insightTopics: string[]
): PreparedInsightCollection {
  const title = requiredText(payload.title, "payload.collection.title");
  const declaredId = optionalTextValue(payload.id);
  const sourceCoverage = normalizeSourceCoverage(
    payload.source_coverage,
    "payload.collection.source_coverage"
  );
  const existing = findExistingAuditedCollection(document, declaredId, title, sourceCoverage);
  const existingCoverage = existing?.source_coverage
    ? normalizeSourceCoverage(existing.source_coverage, `collection ${existing.id}.source_coverage`)
    : undefined;
  const existingContext = existing?.source_coverage
    ? normalizeCollectionContextSections(
        existing.context_sections,
        existingCoverage,
        `collection ${existing.id}.context_sections`
      )
    : [];
  const explicitSourceRefs = normalizedStrings(stringArray(payload.source_refs));
  const sourceRefs = explicitSourceRefs.length > 0
    ? explicitSourceRefs
    : existing?.source_refs ?? normalizedStrings(insightSourceRefs);
  const id = declaredId ?? existing?.id ?? deriveInsightCollectionId(title, sourceRefs);
  const sourceType = payload.source_type !== undefined
    ? parseInsightSourceType(payload.source_type, insightSourceType ?? inferSourceType(sourceRefs[0]))
    : existing?.source_type ?? parseInsightSourceType(insightSourceType, inferSourceType(sourceRefs[0]));
  const explicitTopics = normalizedStrings(stringArray(payload.topics));
  const topics = explicitTopics.length > 0
    ? explicitTopics
    : existing?.topics ?? normalizedStrings(insightTopics);
  const contextSections = payload.context_sections !== undefined
    ? normalizeCollectionContextSections(
        payload.context_sections,
        sourceCoverage,
        "payload.collection.context_sections"
      )
    : existingContext;
  const prepared: PreparedInsightCollection = {
    id,
    title,
    summary: optionalTextValue(payload.summary) ?? existing?.summary ?? "",
    source_type: sourceType,
    source_refs: sourceRefs,
    topics,
    ...(sourceCoverage ? { source_coverage: sourceCoverage } : {}),
    context_sections: contextSections,
    replace_context_sections: payload.context_sections !== undefined,
    position: payload.position,
  };

  if (!existing?.source_coverage) return prepared;
  const existingContract = JSON.stringify({
    id: existing.id,
    title: existing.title,
    summary: existing.summary,
    source_type: existing.source_type,
    source_refs: existing.source_refs,
    topics: existing.topics,
    source_coverage: existingCoverage,
    context_sections: existingContext,
  });
  const proposedContract = JSON.stringify({
    id: prepared.id,
    title: prepared.title,
    summary: prepared.summary,
    source_type: prepared.source_type,
    source_refs: prepared.source_refs,
    topics: prepared.topics,
    source_coverage: prepared.source_coverage,
    context_sections: prepared.context_sections,
  });
  if (proposedContract !== existingContract) {
    throw new Error(
      `Collection ${id} source contract cannot be replaced by an Insight apply; ` +
      "resubmit the exact existing collection metadata or create a new collection with an explicit id."
    );
  }
  return prepared;
}

function findExistingAuditedCollection(
  document: InsightDocument,
  declaredId: string | null,
  title: string,
  sourceCoverage?: SourceCoverageManifest
): InsightCollectionRecord | undefined {
  const collections = document.collections ?? [];
  if (declaredId) return collections.find((collection) => collection.id === declaredId);

  const sameTitle = collections.filter((collection) =>
    Boolean(collection.source_coverage)
    && collection.title.toLocaleLowerCase() === title.toLocaleLowerCase()
  );
  if (sameTitle.length <= 1) return sameTitle[0];

  const fingerprintMatches = sourceCoverage
    ? sameTitle.filter((collection) =>
        collection.source_coverage?.source_fingerprint.toLocaleLowerCase()
          === sourceCoverage.source_fingerprint.toLocaleLowerCase())
    : [];
  if (fingerprintMatches.length === 1) return fingerprintMatches[0];
  throw new Error(
    `Source-covered collection ${title} is ambiguous without collection.id; ` +
    "resubmit the candidate with the intended existing collection id."
  );
}

function inferLegacyCollections(insights: InsightRecord[]): {
  collections: InsightCollectionRecord[];
  collection_items: InsightCollectionItem[];
} {
  const groups = new Map<string, InsightRecord[]>();
  for (const insight of insights) {
    const key = normalizedPrimarySource(insight.source_refs?.[0]);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(insight);
    groups.set(key, group);
  }
  const collections: InsightCollectionRecord[] = [];
  const collectionItems: InsightCollectionItem[] = [];
  for (const [source, members] of groups) {
    if (members.length < 2) continue;
    const ordered = [...members].sort((left, right) =>
      left.shelved_at.localeCompare(right.shelved_at) || left.id.localeCompare(right.id)
    );
    const id = `col-inferred-${shortHash(source)}`;
    const timestamps = ordered.map((insight) => insight.shelved_at).filter(Boolean).sort();
    collections.push({
      id,
      title: inferredCollectionTitle(source),
      summary: `${ordered.length} learning insights from one source.`,
      source_type: inferSourceType(source),
      source_refs: [source],
      topics: commonTags(ordered),
      created_at: timestamps[0] ?? new Date(0).toISOString(),
      updated_at: timestamps.at(-1) ?? new Date(0).toISOString(),
      inferred: true,
    });
    ordered.forEach((insight, index) => collectionItems.push({
      collection_id: id,
      insight_id: insight.id,
      position: index + 1,
    }));
  }
  return { collections, collection_items: collectionItems };
}

function normalizedPrimarySource(value: string | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") return text.split("#")[0] || null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    }
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return text.split("#")[0]?.trim() || null;
  }
}

function inferredCollectionTitle(source: string): string {
  try {
    const url = new URL(source);
    const segment = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) ?? "");
    if (segment) {
      return segment
        .replace(/\.[A-Za-z0-9]+$/, "")
        .split(/[-_]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
        .join(" ");
    }
    return url.hostname;
  } catch {
    const compact = source.replace(/^(session|conversation|transcript):/i, "").trim();
    return compact ? `Conversation ${compact}` : "AI conversation";
  }
}

function commonTags(insights: InsightRecord[]): string[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const insight of insights) {
    for (const tag of normalizedStrings(insight.tags ?? [])) {
      const key = tag.toLocaleLowerCase();
      const current = counts.get(key) ?? { label: tag, count: 0 };
      current.count += 1;
      counts.set(key, current);
    }
  }
  const threshold = Math.ceil(insights.length / 2);
  return [...counts.values()]
    .filter((entry) => entry.count >= threshold)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 5)
    .map((entry) => entry.label);
}

export function inferSourceType(source: string | undefined): InsightSourceType {
  const text = source?.trim().toLocaleLowerCase() ?? "";
  if (!text) return "manual";
  if (/^(session|conversation|transcript|learning-review|codex|claude)/.test(text)) return "conversation";
  if (/youtube\.com|youtu\.be|bilibili\.com|vimeo\.com/.test(text)) return "video";
  if (/\.pdf(?:$|\?)/.test(text) || /arxiv\.org/.test(text)) return "paper";
  if (/\/docs?(?:\/|$)|documentation/.test(text)) return "documentation";
  if (/^https?:/.test(text)) return "article";
  return "other";
}

export function parseInsightSourceType(value: unknown, fallback: InsightSourceType = "other"): InsightSourceType {
  const normalized = typeof value === "string" ? value.trim().toLocaleLowerCase() : "";
  return (INSIGHT_SOURCE_TYPES as readonly string[]).includes(normalized)
    ? normalized as InsightSourceType
    : fallback;
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

function nextCollectionPosition(items: InsightCollectionItem[], collectionId: string): number {
  return items
    .filter((item) => item.collection_id === collectionId)
    .reduce((max, item) => Math.max(max, item.position), 0) + 1;
}

function optionalTextValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function deriveInsightCollectionId(title: string, sourceRefs: string[]): string {
  return `col-${shortHash(JSON.stringify([title.toLocaleLowerCase(), normalizedStrings(sourceRefs)]))}`;
}

function parseInsightDocument(text: string, path: string): InsightDocument {
  const parsed = JSON.parse(text) as InsightDocument;
  if (!parsed || !Array.isArray(parsed.insights)) throw new Error(`Corrupt insight shelf ${path}.`);
  if (parsed.version !== 1 && parsed.version !== 2) throw new Error(`Unsupported insight shelf version in ${path}.`);
  if (parsed.collections !== undefined && !Array.isArray(parsed.collections)) {
    throw new Error(`Corrupt insight collections in ${path}.`);
  }
  if (parsed.collection_items !== undefined && !Array.isArray(parsed.collection_items)) {
    throw new Error(`Corrupt insight collection items in ${path}.`);
  }
  return parsed;
}
