import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { CandidateTrap } from "../domain/session";
import type { SetupClient } from "./client-setup";
import { withAdvisoryLock } from "./advisory-lock";
import { CODETRAP_DIR } from "./constants";
import { readJsonFile, writeFileAtomic } from "./fs-json";

export type SkillFilePath = "SKILL.md" | "agents/openai.yaml";

export type SkillArtifact = {
  name: string;
  files: Record<SkillFilePath, string>;
};

type SnapshotFile = {
  path: string;
  content_base64: string;
  sha256: string;
};

export type SkillDirectorySnapshot = {
  directories: string[];
  files: SnapshotFile[];
  sha256: string;
};

export type Phase3TargetSnapshot = {
  client: SetupClient;
  client_home: string;
  path: string;
  before: SkillDirectorySnapshot | null;
  after: SkillDirectorySnapshot;
};

export type Phase3Commit = {
  id: string;
  candidate_id: string;
  session_id: string;
  destination: "skill_candidate";
  skill_name: string;
  committed_at: string;
  reverted_at: string | null;
  targets: Phase3TargetSnapshot[];
};

type CommitDocument = { version: 1; commits: Phase3Commit[] };
type ClientHomes = Record<SetupClient, string>;

const PHASE3_DIR = "phase3";
const LOCK_DIR = ".phase3.lock";
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REQUIRED_FILES: SkillFilePath[] = ["SKILL.md", "agents/openai.yaml"];

export class Phase3Store {
  constructor(private readonly projectRoot: string) {}

  preview(candidate: CandidateTrap, homes: ClientHomes) {
    const artifact = skillArtifact(candidate);
    return this.planTargets(artifact, homes).map((target) => ({
      client: target.client,
      client_home: target.client_home,
      path: target.path,
      created: target.before === null,
      changed: target.before?.sha256 !== target.after.sha256,
      before_sha256: target.before?.sha256 ?? null,
      after_sha256: target.after.sha256,
      files: target.after.files.map((file) => ({ path: file.path, sha256: file.sha256 })),
    }));
  }

  apply(sessionId: string, candidate: CandidateTrap, homes: ClientHomes, now = new Date()): Phase3Commit {
    return this.withLock(() => {
      const artifact = skillArtifact(candidate);
      const targets = this.planTargets(artifact, homes);
      const touched: Phase3TargetSnapshot[] = [];
      try {
        for (const target of targets) {
          touched.push(target);
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
          targets,
        };
        const document = this.readCommits();
        this.writeCommits({ version: 1, commits: [...document.commits, commit] });
        return commit;
      } catch (error) {
        for (const target of touched.reverse()) this.restoreTarget(target.path, target.before);
        throw error;
      }
    });
  }

  revert(commitId: string, now = new Date()): Phase3Commit {
    return this.withLock(() => {
      const document = this.readCommits();
      const commit = document.commits.find((item) => item.id === commitId);
      if (!commit) throw new Error(`Phase 3 commit ${commitId} not found.`);
      if (commit.reverted_at) throw new Error(`Phase 3 commit ${commitId} was already reverted.`);

      for (const target of commit.targets) {
        const current = this.snapshotDirectory(target.path);
        if (current?.sha256 !== target.after.sha256) {
          throw new Error(`Refusing to roll back ${target.path}: it changed after ${commitId}.`);
        }
      }

      const restored: Phase3TargetSnapshot[] = [];
      try {
        for (const target of [...commit.targets].reverse()) {
          restored.push(target);
          this.restoreTarget(target.path, target.before);
        }
        commit.reverted_at = now.toISOString();
        this.writeCommits(document);
        return commit;
      } catch (error) {
        for (const target of restored.reverse()) this.writeSnapshot(target.path, target.after);
        throw error;
      }
    });
  }

  listCommits(): Phase3Commit[] {
    return [...this.readCommits().commits].reverse();
  }

  private planTargets(artifact: SkillArtifact, homes: ClientHomes): Phase3TargetSnapshot[] {
    const after = snapshotForArtifact(artifact);
    const targets = (["codex", "claude"] as SetupClient[]).map((client) => {
      const clientHome = resolve(homes[client]);
      const path = safeSkillTarget(clientHome, artifact.name);
      return { client, client_home: clientHome, path, before: this.snapshotDirectory(path), after };
    });
    if (targets[0].path.toLowerCase() === targets[1].path.toLowerCase()) {
      throw new Error("Codex and Claude client homes resolve to the same skill target; choose two distinct homes.");
    }
    return targets;
  }

  private snapshotDirectory(path: string): SkillDirectorySnapshot | null {
    if (!existsSync(path)) return null;
    const root = lstatSync(path);
    if (!root.isDirectory() || root.isSymbolicLink()) {
      throw new Error(`Skill target ${path} must be a regular directory, not a file or symbolic link.`);
    }
    const directories: string[] = [];
    const files: SnapshotFile[] = [];
    const walk = (dir: string, prefix: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const absolute = join(dir, entry.name);
        const itemPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isSymbolicLink()) throw new Error(`Skill target ${path} contains unsupported symbolic link ${itemPath}.`);
        if (entry.isDirectory()) {
          directories.push(itemPath);
          walk(absolute, itemPath);
          continue;
        }
        if (!entry.isFile()) throw new Error(`Skill target ${path} contains unsupported entry ${itemPath}.`);
        const content = readFileSync(absolute);
        files.push({ path: itemPath, content_base64: content.toString("base64"), sha256: digest(content) });
      }
    };
    walk(path, "");
    return finishSnapshot(directories, files);
  }

  private writeSnapshot(path: string, snapshot: SkillDirectorySnapshot): void {
    if (existsSync(path)) rmSync(path, { recursive: true, force: true });
    mkdirSync(path, { recursive: true });
    for (const dir of snapshot.directories) mkdirSync(join(path, ...dir.split("/")), { recursive: true });
    for (const file of snapshot.files) {
      const absolute = join(path, ...file.path.split("/"));
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, Buffer.from(file.content_base64, "base64"));
    }
  }

  private restoreTarget(path: string, snapshot: SkillDirectorySnapshot | null): void {
    if (snapshot === null) {
      if (existsSync(path)) rmSync(path, { recursive: true, force: true });
      return;
    }
    this.writeSnapshot(path, snapshot);
  }

  private phase3Dir(): string { return join(this.projectRoot, CODETRAP_DIR, PHASE3_DIR); }
  private commitsPath(): string { return join(this.phase3Dir(), "skill-commits.json"); }
  private readCommits(): CommitDocument {
    return existsSync(this.commitsPath())
      ? readJsonFile<CommitDocument>(this.commitsPath(), "Phase 3 skill commits")
      : { version: 1, commits: [] };
  }
  private writeCommits(document: CommitDocument): void {
    mkdirSync(this.phase3Dir(), { recursive: true });
    writeFileAtomic(this.commitsPath(), `${JSON.stringify(document, null, 2)}\n`);
  }
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
  const name = requiredText(payload.name, "payload.name");
  if (!SKILL_NAME.test(name) || name.length > 64) {
    throw new Error("payload.name must be 1-64 lowercase letters, digits, and single hyphen-separated segments.");
  }
  const rawFiles = payload.files;
  if (!rawFiles || typeof rawFiles !== "object" || Array.isArray(rawFiles)) {
    throw new Error("payload.files must be an object.");
  }
  const fileRecord = rawFiles as Record<string, unknown>;
  const unexpected = Object.keys(fileRecord).filter((path) => !REQUIRED_FILES.includes(path as SkillFilePath));
  if (unexpected.length > 0) throw new Error(`Unsupported skill files: ${unexpected.join(", ")}.`);
  const files: Record<SkillFilePath, string> = {
    "SKILL.md": requiredText(fileRecord["SKILL.md"], "payload.files.SKILL.md"),
    "agents/openai.yaml": requiredText(fileRecord["agents/openai.yaml"], "payload.files.agents/openai.yaml"),
  };
  if (!files["SKILL.md"].includes(`name: ${name}`)) throw new Error(`SKILL.md frontmatter must declare name: ${name}.`);
  if (files["SKILL.md"].includes("TODO")) throw new Error("SKILL.md still contains TODO markers.");
  if (!files["agents/openai.yaml"].includes(`$${name}`)) {
    throw new Error(`agents/openai.yaml default prompt must explicitly mention $${name}.`);
  }
  return { name, files };
}

function safeSkillTarget(clientHome: string, name: string): string {
  const skillsRoot = resolve(clientHome, "skills");
  const target = resolve(skillsRoot, name);
  if (relative(skillsRoot, target).replace(/\\/g, "/") !== name) {
    throw new Error(`Unsafe Phase 3 skill target for ${name}.`);
  }
  return target;
}

function snapshotForArtifact(artifact: SkillArtifact): SkillDirectorySnapshot {
  const files = REQUIRED_FILES.map((path) => {
    const content = Buffer.from(artifact.files[path], "utf-8");
    return { path, content_base64: content.toString("base64"), sha256: digest(content) };
  });
  return finishSnapshot(["agents"], files);
}

function finishSnapshot(directories: string[], files: SnapshotFile[]): SkillDirectorySnapshot {
  directories.sort();
  files.sort((a, b) => a.path.localeCompare(b.path));
  const sha256 = digest(Buffer.from(JSON.stringify({
    directories,
    files: files.map((file) => ({ path: file.path, sha256: file.sha256 })),
  })));
  return { directories, files, sha256 };
}

function digest(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required.`);
  return value;
}
