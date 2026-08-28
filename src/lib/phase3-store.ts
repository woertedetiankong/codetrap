import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { CandidateTrap } from "../domain/session";
import type { SetupClient } from "./client-setup";
import { withAdvisoryLock } from "./advisory-lock";
import { CODETRAP_DIR } from "./constants";
import { readJsonFile, writeFileAtomic } from "./fs-json";
import {
  applySkillProposal,
  createSkillPatchPayload,
  diffSkillSnapshots,
  finishSkillSnapshot,
  parseSkillName,
  parseSkillPayload,
  snapshotIdentity,
  type SkillDirectorySnapshot,
  type SkillProposal,
  type SnapshotFile,
} from "./skill-artifact";

export type SkillArtifact = SkillProposal;
export type { SkillDirectorySnapshot } from "./skill-artifact";

type Phase3TargetPlan = {
  client: SetupClient;
  client_home: string;
  path: string;
  before: SkillDirectorySnapshot | null;
  after: SkillDirectorySnapshot;
};

export type Phase3PreviewTarget = {
  client: SetupClient;
  client_home: string;
  path: string;
  created: boolean;
  changed: boolean;
  /** Metadata-aware snapshot ids for new previews; content hashes for legacy snapshots. */
  before_sha256: string | null;
  after_sha256: string;
  files: Array<{ path: string; sha256: string; mode?: number }>;
  changes: ReturnType<typeof diffSkillSnapshots>["changes"];
  summary: ReturnType<typeof diffSkillSnapshots>["summary"];
};

export type Phase3CommitTarget = {
  client: SetupClient;
  client_home: string;
  path: string;
  before_snapshot_id: string | null;
  after_snapshot_id: string;
  before_sha256: string | null;
  after_sha256: string;
};

export type Phase3Commit = {
  id: string;
  candidate_id: string;
  session_id: string;
  destination: "skill_candidate";
  skill_name: string;
  committed_at: string;
  reverted_at: string | null;
  targets: Phase3CommitTarget[];
};

type LegacyPhase3Commit = Omit<Phase3Commit, "targets"> & { targets: Phase3TargetPlan[] };
type CommitDocumentV1 = { version: 1; commits: LegacyPhase3Commit[] };
type CommitDocumentV2 = { version: 2; commits: Phase3Commit[] };
type ClientHomes = Record<SetupClient, string>;
type SnapshotObject = { version: 1; snapshot: SkillDirectorySnapshot };

export type Phase3StoreOptions = {
  /** Fault injection hook used by recovery tests; production callers omit it. */
  beforeTargetWrite?: (target: { client: SetupClient; path: string }, index: number) => void;
  maxCommits?: number;
  maxSnapshotObjects?: number;
  maxSnapshotStoreBytes?: number;
  maxSnapshotObjectBytes?: number;
};

const PHASE3_DIR = "phase3";
const LOCK_DIR = ".phase3.lock";
const SNAPSHOT_DIR = "snapshots";
const SNAPSHOT_ID = /^[a-f0-9]{64}$/;

export const MAX_PHASE3_COMMITS = 1_000;
export const MAX_PHASE3_SNAPSHOT_OBJECTS = 512;
export const MAX_PHASE3_SNAPSHOT_STORE_BYTES = 256_000_000;
export const MAX_PHASE3_SNAPSHOT_OBJECT_BYTES = 30_000_000;

export class Phase3Store {
  constructor(
    private readonly projectRoot: string,
    private readonly options: Phase3StoreOptions = {}
  ) {}

  preview(candidate: CandidateTrap, homes: ClientHomes): Phase3PreviewTarget[] {
    return this.previewTargets(this.planTargets(skillArtifact(candidate), homes));
  }

  prepareImprovement(name: unknown, operations: unknown, homes: ClientHomes) {
    const skillName = parseSkillName(name, "Skill name");
    const targets = this.targetPaths(skillName, homes);
    const snapshots = targets.map((target) => ({ ...target, before: this.snapshotDirectory(target.path) }));
    for (const target of snapshots) {
      if (!target.before) throw new Error(`Skill ${skillName} does not exist at ${target.path}.`);
    }
    const first = snapshots[0].before!;
    const second = snapshots[1].before!;
    if (snapshotIdentity(first) !== snapshotIdentity(second)) {
      throw new Error(
        `Skill ${skillName} differs between Codex (${snapshotIdentity(first)}) and Claude (${snapshotIdentity(second)}); reconcile them before proposing one shared improvement.`
      );
    }
    const payload = createSkillPatchPayload(skillName, first.sha256, operations);
    const proposal = parseSkillPayload(payload);
    const previewTargets = this.previewTargets(this.planTargets(proposal, homes));
    return { payload, base_sha256: first.sha256, targets: previewTargets };
  }

  apply(
    sessionId: string,
    candidate: CandidateTrap,
    homes: ClientHomes,
    expectedTargets: Phase3PreviewTarget[],
    now = new Date()
  ): Phase3Commit {
    return this.withLock(() => {
      const artifact = skillArtifact(candidate);
      const targets = this.planTargets(artifact, homes);
      assertPlanUnchanged(expectedTargets, this.previewTargets(targets));
      const document = this.readV2ForWrite();
      const commitLimit = this.options.maxCommits ?? MAX_PHASE3_COMMITS;
      if (document.commits.length >= commitLimit) {
        throw new Error(`Phase 3 commit history reached its ${commitLimit} commit limit.`);
      }

      const snapshots = targets.flatMap((target) => target.before ? [target.before, target.after] : [target.after]);
      const createdSnapshotIds = this.storeSnapshots(snapshots, true);
      const touched: Phase3TargetPlan[] = [];
      try {
        for (const [index, target] of targets.entries()) {
          touched.push(target);
          this.options.beforeTargetWrite?.({ client: target.client, path: target.path }, index);
          this.writeSnapshot(target.path, target.after);
        }
        const commit: Phase3Commit = {
          id: `p3-${now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`,
          candidate_id: candidate.id,
          session_id: sessionId,
          destination: "skill_candidate",
          skill_name: artifact.name,
          committed_at: now.toISOString(),
          reverted_at: null,
          targets: targets.map(commitTarget),
        };
        this.writeCommits({ version: 2, commits: [...document.commits, commit] });
        return commit;
      } catch (error) {
        const recoveryErrors: unknown[] = [];
        for (const target of touched.reverse()) {
          try {
            this.restoreTarget(target.path, target.before);
          } catch (recoveryError) {
            recoveryErrors.push(recoveryError);
          }
        }
        this.removeUnreferencedCreatedSnapshots(createdSnapshotIds, document);
        if (recoveryErrors.length > 0) {
          throw new AggregateError([error, ...recoveryErrors], "Phase 3 install failed and one or more target restorations also failed.");
        }
        throw error;
      }
    });
  }

  revert(commitId: string, now = new Date()): Phase3Commit {
    return this.withLock(() => {
      const document = this.readV2ForWrite();
      const commit = document.commits.find((item) => item.id === commitId);
      if (!commit) throw new Error(`Phase 3 commit ${commitId} not found.`);
      if (commit.reverted_at) throw new Error(`Phase 3 commit ${commitId} was already reverted.`);

      const snapshots = commit.targets.map((target) => ({
        target,
        before: target.before_snapshot_id ? this.readSnapshot(target.before_snapshot_id) : null,
        after: this.readSnapshot(target.after_snapshot_id),
      }));
      for (const item of snapshots) {
        const current = this.snapshotDirectory(item.target.path);
        if (!snapshotMatches(current, item.after)) {
          throw new Error(`Refusing to roll back ${item.target.path}: it changed after ${commitId}.`);
        }
      }

      const restored: typeof snapshots = [];
      try {
        for (const item of [...snapshots].reverse()) {
          restored.push(item);
          this.restoreTarget(item.target.path, item.before);
        }
        commit.reverted_at = now.toISOString();
        this.writeCommits(document);
        return commit;
      } catch (error) {
        const recoveryErrors: unknown[] = [];
        for (const item of restored.reverse()) {
          try {
            this.writeSnapshot(item.target.path, item.after);
          } catch (recoveryError) {
            recoveryErrors.push(recoveryError);
          }
        }
        if (recoveryErrors.length > 0) {
          throw new AggregateError([error, ...recoveryErrors], "Phase 3 rollback failed and one or more installed targets could not be restored.");
        }
        throw error;
      }
    });
  }

  listCommits(): Phase3Commit[] {
    const document = this.readRawCommits();
    const commits = document.version === 2
      ? document.commits
      : document.commits.map(convertLegacyCommit);
    return [...commits].reverse();
  }

  private planTargets(artifact: SkillArtifact, homes: ClientHomes): Phase3TargetPlan[] {
    return this.targetPaths(artifact.name, homes).map((target) => {
      const before = this.snapshotDirectory(target.path);
      return { ...target, before, after: applySkillProposal(artifact, before) };
    });
  }

  private targetPaths(name: string, homes: ClientHomes) {
    const targets = (["codex", "claude"] as SetupClient[]).map((client) => {
      const clientHome = resolve(homes[client]);
      return { client, client_home: clientHome, path: safeSkillTarget(clientHome, name) };
    });
    if (targets[0].path.toLowerCase() === targets[1].path.toLowerCase()) {
      throw new Error("Codex and Claude client homes resolve to the same skill target; choose two distinct homes.");
    }
    return targets;
  }

  private previewTargets(targets: Phase3TargetPlan[]): Phase3PreviewTarget[] {
    return targets.map((target) => {
      const diff = diffSkillSnapshots(target.before, target.after);
      return {
        client: target.client,
        client_home: target.client_home,
        path: target.path,
        created: target.before === null,
        changed: target.before === null || snapshotIdentity(target.before) !== snapshotIdentity(target.after),
        before_sha256: target.before ? snapshotIdentity(target.before) : null,
        after_sha256: snapshotIdentity(target.after),
        files: target.after.files.map((file) => ({
          path: file.path,
          sha256: file.sha256,
          ...(file.mode === undefined ? {} : { mode: file.mode }),
        })),
        ...diff,
      };
    });
  }

  private snapshotDirectory(path: string): SkillDirectorySnapshot | null {
    if (!existsSync(path)) return null;
    const root = lstatSync(path);
    if (!root.isDirectory() || root.isSymbolicLink()) {
      throw new Error(`Skill target ${path} must be a regular directory, not a file or symbolic link.`);
    }
    const directories: string[] = [];
    const directoryModes: Record<string, number> = {};
    const files: SnapshotFile[] = [];
    const walk = (dir: string, prefix: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const absolute = join(dir, entry.name);
        const itemPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isSymbolicLink()) throw new Error(`Skill target ${path} contains unsupported symbolic link ${itemPath}.`);
        const stat = lstatSync(absolute);
        if (entry.isDirectory()) {
          directories.push(itemPath);
          directoryModes[itemPath] = stat.mode & 0o777;
          walk(absolute, itemPath);
          continue;
        }
        if (!entry.isFile()) throw new Error(`Skill target ${path} contains unsupported entry ${itemPath}.`);
        const content = readFileSync(absolute);
        files.push({
          path: itemPath,
          content_base64: content.toString("base64"),
          sha256: digest(content),
          ...(process.platform === "win32" ? {} : { mode: stat.mode & 0o777 }),
        });
      }
    };
    walk(path, "");
    return finishSkillSnapshot(directories, files, process.platform === "win32" ? {} : {
      root_mode: root.mode & 0o777,
      directory_modes: directoryModes,
    });
  }

  private writeSnapshot(path: string, snapshot: SkillDirectorySnapshot): void {
    if (existsSync(path)) rmSync(path, { recursive: true, force: true });
    mkdirSync(path, { recursive: true });
    for (const dir of snapshot.directories) mkdirSync(join(path, ...dir.split("/")), { recursive: true });
    for (const file of snapshot.files) {
      const absolute = join(path, ...file.path.split("/"));
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, Buffer.from(file.content_base64, "base64"));
      if (file.mode !== undefined) chmodSync(absolute, file.mode);
    }
    for (const dir of [...snapshot.directories].sort((a, b) => b.split("/").length - a.split("/").length)) {
      const mode = snapshot.directory_modes?.[dir];
      if (mode !== undefined) chmodSync(join(path, ...dir.split("/")), mode);
    }
    if (snapshot.root_mode !== undefined) chmodSync(path, snapshot.root_mode);
  }

  private restoreTarget(path: string, snapshot: SkillDirectorySnapshot | null): void {
    if (snapshot === null) {
      if (existsSync(path)) rmSync(path, { recursive: true, force: true });
      return;
    }
    this.writeSnapshot(path, snapshot);
  }

  private readV2ForWrite(): CommitDocumentV2 {
    const document = this.readRawCommits();
    if (document.version === 2) return document;
    const snapshots = document.commits.flatMap((commit) => commit.targets.flatMap((target) =>
      target.before ? [target.before, target.after] : [target.after]
    ));
    // Migration converts already-persisted rollback material. New writes are
    // still refused later when the bounded store is already at capacity.
    this.storeSnapshots(snapshots, false);
    const migrated: CommitDocumentV2 = { version: 2, commits: document.commits.map(convertLegacyCommit) };
    this.writeCommits(migrated);
    return migrated;
  }

  private readRawCommits(): CommitDocumentV1 | CommitDocumentV2 {
    if (!existsSync(this.commitsPath())) return { version: 2, commits: [] };
    const document = readJsonFile<CommitDocumentV1 | CommitDocumentV2>(this.commitsPath(), "Phase 3 skill commits");
    if ((document.version !== 1 && document.version !== 2) || !Array.isArray(document.commits)) {
      throw new Error(`Unsupported Phase 3 commit document ${this.commitsPath()}.`);
    }
    return document;
  }

  private writeCommits(document: CommitDocumentV2): void {
    mkdirSync(this.phase3Dir(), { recursive: true });
    writeFileAtomic(this.commitsPath(), `${JSON.stringify(document, null, 2)}\n`);
  }

  private storeSnapshots(snapshots: SkillDirectorySnapshot[], enforceLimits: boolean): string[] {
    const unique = new Map<string, { serialized: string; bytes: number }>();
    for (const snapshot of snapshots) {
      const id = snapshotIdentity(snapshot);
      if (unique.has(id)) continue;
      if (existsSync(this.snapshotPath(id))) {
        this.readSnapshot(id);
        continue;
      }
      const object: SnapshotObject = { version: 1, snapshot };
      const serialized = `${JSON.stringify(object, null, 2)}\n`;
      unique.set(id, { serialized, bytes: Buffer.byteLength(serialized, "utf-8") });
    }
    const pending = [...unique.entries()];
    const objectLimit = this.options.maxSnapshotObjectBytes ?? MAX_PHASE3_SNAPSHOT_OBJECT_BYTES;
    for (const [id, item] of pending) {
      if (item.bytes > objectLimit) throw new Error(`Phase 3 snapshot ${id} exceeds the ${objectLimit} byte object limit.`);
    }
    if (enforceLimits && pending.length > 0) {
      const usage = this.snapshotStoreUsage();
      const countLimit = this.options.maxSnapshotObjects ?? MAX_PHASE3_SNAPSHOT_OBJECTS;
      const byteLimit = this.options.maxSnapshotStoreBytes ?? MAX_PHASE3_SNAPSHOT_STORE_BYTES;
      const addedBytes = pending.reduce((sum, [, item]) => sum + item.bytes, 0);
      if (usage.count + pending.length > countLimit) {
        throw new Error(`Phase 3 snapshot store would exceed its ${countLimit} object limit.`);
      }
      if (usage.bytes + addedBytes > byteLimit) {
        throw new Error(`Phase 3 snapshot store would exceed its ${byteLimit} byte limit.`);
      }
    }
    if (pending.length === 0) return [];
    mkdirSync(this.snapshotsDir(), { recursive: true });
    const created: string[] = [];
    for (const [id, item] of pending) {
      writeFileAtomic(this.snapshotPath(id), item.serialized);
      created.push(id);
    }
    return created;
  }

  private readSnapshot(id: string): SkillDirectorySnapshot {
    if (!SNAPSHOT_ID.test(id)) throw new Error(`Invalid Phase 3 snapshot id ${id}.`);
    const path = this.snapshotPath(id);
    if (!existsSync(path)) throw new Error(`Phase 3 snapshot ${id} is missing from ${path}.`);
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Phase 3 snapshot ${path} must be a regular file.`);
    const object = readJsonFile<SnapshotObject>(path, "Phase 3 snapshot");
    if (object.version !== 1 || !object.snapshot) throw new Error(`Unsupported Phase 3 snapshot object ${path}.`);
    const snapshot = finishSkillSnapshot(
      object.snapshot.directories,
      object.snapshot.files,
      { root_mode: object.snapshot.root_mode, directory_modes: object.snapshot.directory_modes }
    );
    if (snapshotIdentity(snapshot) !== id) throw new Error(`Phase 3 snapshot ${id} failed its identity check.`);
    return snapshot;
  }

  private snapshotStoreUsage(): { count: number; bytes: number } {
    const dir = this.snapshotsDir();
    if (!existsSync(dir)) return { count: 0, bytes: 0 };
    const root = lstatSync(dir);
    if (!root.isDirectory() || root.isSymbolicLink()) throw new Error(`Phase 3 snapshot store ${dir} must be a regular directory.`);
    let count = 0;
    let bytes = 0;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.name.endsWith(".json")) continue;
      const path = join(dir, entry.name);
      if (!entry.isFile() || entry.isSymbolicLink()) throw new Error(`Phase 3 snapshot entry ${path} must be a regular file.`);
      count += 1;
      bytes += statSync(path).size;
    }
    return { count, bytes };
  }

  private removeUnreferencedCreatedSnapshots(ids: string[], document: CommitDocumentV2): void {
    const referenced = new Set(document.commits.flatMap((commit) => commit.targets.flatMap((target) => [
      ...(target.before_snapshot_id ? [target.before_snapshot_id] : []),
      target.after_snapshot_id,
    ])));
    for (const id of ids) {
      if (!referenced.has(id)) rmSync(this.snapshotPath(id), { force: true });
    }
  }

  private phase3Dir(): string { return join(this.projectRoot, CODETRAP_DIR, PHASE3_DIR); }
  private commitsPath(): string { return join(this.phase3Dir(), "skill-commits.json"); }
  private snapshotsDir(): string { return join(this.phase3Dir(), SNAPSHOT_DIR); }
  private snapshotPath(id: string): string { return join(this.snapshotsDir(), `${id}.json`); }
  private withLock<T>(fn: () => T): T {
    mkdirSync(this.phase3Dir(), { recursive: true });
    return withAdvisoryLock(join(this.phase3Dir(), LOCK_DIR), fn).value;
  }
}

export function skillArtifact(candidate: CandidateTrap): SkillArtifact {
  if (candidate.candidate_kind !== "skill_candidate") {
    throw new Error(`Candidate ${candidate.id} is not a skill_candidate.`);
  }
  const payload = candidate.destination_payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("skill_candidate payload is required.");
  }
  const artifact = parseSkillPayload(payload as Record<string, unknown>);
  if (artifact.mode === "replace") applySkillProposal(artifact, null);
  return artifact;
}

function safeSkillTarget(clientHome: string, name: string): string {
  name = parseSkillName(name, "Skill name");
  const skillsRoot = resolve(clientHome, "skills");
  const target = resolve(skillsRoot, name);
  if (relative(skillsRoot, target).replace(/\\/g, "/") !== name) {
    throw new Error(`Unsafe Phase 3 skill target for ${name}.`);
  }
  return target;
}

function commitTarget(target: Phase3TargetPlan): Phase3CommitTarget {
  return {
    client: target.client,
    client_home: target.client_home,
    path: target.path,
    before_snapshot_id: target.before ? snapshotIdentity(target.before) : null,
    after_snapshot_id: snapshotIdentity(target.after),
    before_sha256: target.before?.sha256 ?? null,
    after_sha256: target.after.sha256,
  };
}

function convertLegacyCommit(commit: LegacyPhase3Commit): Phase3Commit {
  return { ...commit, targets: commit.targets.map(commitTarget) };
}

function snapshotMatches(current: SkillDirectorySnapshot | null, expected: SkillDirectorySnapshot): boolean {
  if (!current) return false;
  return expected.metadata_sha256
    ? snapshotIdentity(current) === snapshotIdentity(expected)
    : current.sha256 === expected.sha256;
}

function digest(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function assertPlanUnchanged(expected: Phase3PreviewTarget[], actual: Phase3PreviewTarget[]): void {
  const fingerprint = (targets: Phase3PreviewTarget[]) => targets.map((target) => ({
    client: target.client,
    path: target.path,
    before_sha256: target.before_sha256,
    after_sha256: target.after_sha256,
  }));
  if (JSON.stringify(fingerprint(expected)) !== JSON.stringify(fingerprint(actual))) {
    throw new Error("Skill targets changed after authorization validation; preview and approve the current plan again.");
  }
}
