import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { CandidateTrap } from "../domain/session";
import { CODETRAP_DIR } from "./constants";
import { withAdvisoryLock } from "./advisory-lock";
import { readJsonFile, writeFileAtomic } from "./fs-json";

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
  shelved_at: string;
  consulted_count: number;
  last_consulted_at: string | null;
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
type InsightDocument = { version: 1; insights: InsightRecord[] };
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

  consultInsight(id: string, now = new Date()): InsightRecord {
    return this.withLock(() => {
      const document = this.readInsights();
      const insight = document.insights.find((item) => item.id === id);
      if (!insight) throw new Error(`Insight ${id} not found.`);
      insight.consulted_count += 1;
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
      const path = "src/tests/fixtures/search-eval.json";
      const testCase = recordValue(payload.case, "payload.case");
      return [this.textSnapshot(path, (before) => {
        if (before === null) throw new Error(`${path} does not exist.`);
        const fixture = JSON.parse(before) as Record<string, unknown>;
        if (!Array.isArray(fixture.cases)) throw new Error(`${path} must contain a cases array.`);
        const cases = [...fixture.cases];
        const key = JSON.stringify(testCase);
        if (!cases.some((item) => JSON.stringify(item) === key)) cases.push(testCase);
        return `${JSON.stringify({ ...fixture, cases }, null, 2)}\n`;
      })];
    }
    if (kind === "insight") {
      const path = this.relativeInsightsPath();
      const before = this.readOptional(path);
      const document = before === null ? { version: 1 as const, insights: [] } : parseInsightDocument(before, path);
      const insight: InsightRecord = {
        id: `ins-${candidate.content_hash?.slice(0, 12) ?? candidate.id}`,
        title: requiredText(payload.title ?? candidate.trap.title, "payload.title"),
        summary: requiredText(payload.summary ?? candidate.rationale ?? candidate.trap.context, "payload.summary"),
        body: requiredText(payload.body ?? candidate.trap.fix, "payload.body"),
        tags: stringArray(payload.tags),
        source_refs: stringArray(payload.source_refs ?? candidate.source_manifest_refs),
        shelved_at: now.toISOString(),
        consulted_count: 0,
        last_consulted_at: null,
      };
      if (!document.insights.some((item) => item.id === insight.id)) document.insights.push(insight);
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
    return existsSync(this.insightsPath()) ? readJsonFile(this.insightsPath(), "insight shelf") : { version: 1, insights: [] };
  }
  private readEvents(): EventDocument {
    return existsSync(this.eventsPath()) ? readJsonFile(this.eventsPath(), "Phase 2 events") : { version: 1, events: [] };
  }
  private writeCommits(document: CommitDocument): void { this.writeJson(this.commitsPath(), document); }
  private writeInsights(document: InsightDocument): void { this.writeJson(this.insightsPath(), document); }
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

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function parseInsightDocument(text: string, path: string): InsightDocument {
  const parsed = JSON.parse(text) as InsightDocument;
  if (!parsed || !Array.isArray(parsed.insights)) throw new Error(`Corrupt insight shelf ${path}.`);
  return parsed;
}
