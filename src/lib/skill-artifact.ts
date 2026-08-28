import { createHash } from "node:crypto";

export type SnapshotFile = {
  path: string;
  content_base64: string;
  sha256: string;
  /** POSIX permission bits. Absent only on legacy snapshots that never recorded them. */
  mode?: number;
};

export type SkillDirectorySnapshot = {
  directories: string[];
  files: SnapshotFile[];
  /** Content/path identity retained for patch-base and legacy compatibility. */
  sha256: string;
  /** Content plus permission identity for new installs and rollback checks. */
  metadata_sha256?: string;
  root_mode?: number;
  directory_modes?: Record<string, number>;
};

export type SkillSnapshotMetadata = {
  root_mode?: number;
  directory_modes?: Record<string, number>;
};

export type SkillPatchOperation =
  | { op: "write_text"; path: string; content: string }
  | { op: "write_base64"; path: string; content_base64: string }
  | { op: "replace_text"; path: string; old_text: string; new_text: string }
  | { op: "append_text"; path: string; content: string }
  | { op: "delete"; path: string };

export type ReplacementSkillProposal = {
  mode: "replace";
  name: string;
  files: Record<string, string | { content_base64: string }>;
};

export type PatchSkillProposal = {
  mode: "patch";
  name: string;
  base_sha256: string;
  operations: SkillPatchOperation[];
};

export type SkillProposal = ReplacementSkillProposal | PatchSkillProposal;

export type SkillFileChange = {
  path: string;
  status: "added" | "modified" | "deleted" | "unchanged";
  before_sha256: string | null;
  after_sha256: string | null;
};

const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256 = /^[a-f0-9]{64}$/;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const WINDOWS_INVALID = /[<>:"|?*\u0000-\u001f]/;
const MAX_OPERATIONS = 100;
const MAX_FILE_BYTES = 1_000_000;
const MAX_PATCH_BYTES = 5_000_000;
const MAX_SKILL_FILES = 2_000;
const MAX_SKILL_BYTES = 20_000_000;
export const DEFAULT_SKILL_FILE_MODE = 0o644;
export const DEFAULT_SKILL_DIRECTORY_MODE = 0o755;

export function parseSkillPayload(payload: Record<string, unknown>): SkillProposal {
  const name = parseSkillName(payload.name);
  const mode = payload.mode === undefined ? "replace" : requiredString(payload.mode, "payload.mode");
  if (mode === "replace") {
    const rawFiles = requiredRecord(payload.files, "payload.files");
    const entries = Object.entries(rawFiles);
    if (entries.length === 0) throw new Error("payload.files must contain SKILL.md.");
    if (entries.length > MAX_SKILL_FILES) throw new Error(`payload.files may contain at most ${MAX_SKILL_FILES} files.`);
    const files: ReplacementSkillProposal["files"] = {};
    const seen = new Set<string>();
    let totalBytes = 0;
    for (const [rawPath, rawContent] of entries) {
      const path = safeSkillPath(rawPath, `payload.files.${rawPath}`);
      assertUniquePath(seen, path, "payload.files");
      if (typeof rawContent === "string") {
        totalBytes += Buffer.byteLength(rawContent, "utf-8");
        files[path] = rawContent;
      } else {
        const record = requiredRecord(rawContent, `payload.files.${path}`);
        const contentBase64 = canonicalBase64(record.content_base64, `payload.files.${path}.content_base64`);
        totalBytes += Buffer.from(contentBase64, "base64").byteLength;
        files[path] = { content_base64: contentBase64 };
      }
      if (totalBytes > MAX_SKILL_BYTES) throw new Error(`payload.files exceed the ${MAX_SKILL_BYTES} byte Skill limit.`);
    }
    return { mode: "replace", name, files };
  }
  if (mode !== "patch") throw new Error("payload.mode must be replace or patch.");
  const baseSha256 = requiredString(payload.base_sha256, "payload.base_sha256").toLowerCase();
  if (!SHA256.test(baseSha256)) throw new Error("payload.base_sha256 must be a lowercase SHA-256 hash.");
  const operations = parsePatchOperations(payload.operations);
  return { mode: "patch", name, base_sha256: baseSha256, operations };
}

export function createSkillPatchPayload(
  nameInput: unknown,
  baseSha256: string,
  operationsInput: unknown
): Record<string, unknown> {
  const parsed = parseSkillPayload({
    mode: "patch",
    name: nameInput,
    base_sha256: baseSha256,
    operations: operationsInput,
  });
  if (parsed.mode !== "patch") throw new Error("Expected a patch Skill proposal.");
  return {
    mode: parsed.mode,
    name: parsed.name,
    base_sha256: parsed.base_sha256,
    operations: parsed.operations,
  };
}

export function applySkillProposal(
  proposal: SkillProposal,
  before: SkillDirectorySnapshot | null
): SkillDirectorySnapshot {
  const after = proposal.mode === "replace"
    ? snapshotFromReplacement(proposal)
    : snapshotFromPatch(proposal, before);
  validateFinalSkill(proposal.name, after);
  if (proposal.mode === "patch" && before?.sha256 === after.sha256) {
    throw new Error("Skill patch produces no directory change.");
  }
  return after;
}

export function finishSkillSnapshot(
  directoriesInput: Iterable<string>,
  filesInput: Iterable<SnapshotFile>,
  metadata: SkillSnapshotMetadata = {}
): SkillDirectorySnapshot {
  const directories = [...new Set(directoriesInput)].sort();
  const directoryKeys = new Set<string>();
  for (const directory of directories) {
    safeSkillPath(directory, `Skill directory ${directory}`);
    const key = directory.toLowerCase();
    if (directoryKeys.has(key)) throw new Error(`Skill snapshot contains case-colliding directory ${directory}.`);
    directoryKeys.add(key);
  }
  let files = [...filesInput].map((file) => ({ ...file })).sort((a, b) => a.path.localeCompare(b.path));
  if (files.length > MAX_SKILL_FILES) throw new Error(`Skill contains more than ${MAX_SKILL_FILES} files.`);
  const seen = new Set<string>();
  let totalBytes = 0;
  for (const file of files) {
    safeSkillPath(file.path, `Skill file ${file.path}`);
    assertUniquePath(seen, file.path, "Skill snapshot");
    if (directoryKeys.has(file.path.toLowerCase())) {
      throw new Error(`Skill path ${file.path} cannot be both a file and a directory.`);
    }
    const content = Buffer.from(file.content_base64, "base64");
    totalBytes += content.byteLength;
    if (totalBytes > MAX_SKILL_BYTES) throw new Error(`Skill exceeds the ${MAX_SKILL_BYTES} byte size limit.`);
    if (digest(content) !== file.sha256) throw new Error(`Skill file ${file.path} has an invalid content hash.`);
    if (file.mode !== undefined) permissionMode(file.mode, `Skill file ${file.path} mode`);
  }
  const sha256 = digest(Buffer.from(JSON.stringify({
    directories,
    files: files.map((file) => ({ path: file.path, sha256: file.sha256 })),
  })));
  const suppliedDirectoryModes = metadata.directory_modes ?? {};
  for (const directory of Object.keys(suppliedDirectoryModes)) {
    if (!directories.includes(directory)) throw new Error(`Permission metadata references unknown Skill directory ${directory}.`);
  }
  const hasMetadata = metadata.root_mode !== undefined
    || Object.keys(suppliedDirectoryModes).length > 0
    || files.some((file) => file.mode !== undefined);
  if (!hasMetadata) return { directories, files, sha256 };

  const rootMode = permissionMode(metadata.root_mode ?? DEFAULT_SKILL_DIRECTORY_MODE, "Skill root mode");
  const directoryModes = Object.fromEntries(directories.map((directory) => [
    directory,
    permissionMode(suppliedDirectoryModes[directory] ?? DEFAULT_SKILL_DIRECTORY_MODE, `Skill directory ${directory} mode`),
  ]));
  files = files.map((file) => ({
    ...file,
    mode: permissionMode(file.mode ?? DEFAULT_SKILL_FILE_MODE, `Skill file ${file.path} mode`),
  }));
  const metadataSha256 = digest(Buffer.from(JSON.stringify({
    sha256,
    root_mode: rootMode,
    directory_modes: directories.map((directory) => ({ path: directory, mode: directoryModes[directory] })),
    files: files.map((file) => ({ path: file.path, sha256: file.sha256, mode: file.mode })),
  })));
  return {
    directories,
    files,
    sha256,
    metadata_sha256: metadataSha256,
    root_mode: rootMode,
    directory_modes: directoryModes,
  };
}

export function snapshotIdentity(snapshot: SkillDirectorySnapshot): string {
  return snapshot.metadata_sha256 ?? snapshot.sha256;
}

export function diffSkillSnapshots(
  before: SkillDirectorySnapshot | null,
  after: SkillDirectorySnapshot
): { changes: SkillFileChange[]; summary: Record<SkillFileChange["status"], number> } {
  const beforeFiles = new Map((before?.files ?? []).map((file) => [file.path, file]));
  const afterFiles = new Map(after.files.map((file) => [file.path, file]));
  const paths = [...new Set([...beforeFiles.keys(), ...afterFiles.keys()])].sort();
  const changes = paths.map((path): SkillFileChange => {
    const previous = beforeFiles.get(path);
    const next = afterFiles.get(path);
    const status = previous === undefined ? "added"
      : next === undefined ? "deleted"
      : previous.sha256 === next.sha256 ? "unchanged"
      : "modified";
    return {
      path,
      status,
      before_sha256: previous?.sha256 ?? null,
      after_sha256: next?.sha256 ?? null,
    };
  });
  const summary = { added: 0, modified: 0, deleted: 0, unchanged: 0 };
  for (const change of changes) summary[change.status] += 1;
  return { changes, summary };
}

function snapshotFromReplacement(proposal: ReplacementSkillProposal): SkillDirectorySnapshot {
  const files: SnapshotFile[] = [];
  const directories = new Set<string>();
  const directoryModes = new Map<string, number>();
  const metadataAware = process.platform !== "win32";
  for (const [path, input] of Object.entries(proposal.files)) {
    const content = typeof input === "string"
      ? Buffer.from(input, "utf-8")
      : Buffer.from(input.content_base64, "base64");
    files.push(snapshotFile(path, content, metadataAware ? DEFAULT_SKILL_FILE_MODE : undefined));
    addParentDirectories(directories, path, metadataAware ? directoryModes : undefined);
  }
  return finishSkillSnapshot(directories, files, metadataAware ? {
    root_mode: DEFAULT_SKILL_DIRECTORY_MODE,
    directory_modes: Object.fromEntries(directoryModes),
  } : {});
}

function snapshotFromPatch(
  proposal: PatchSkillProposal,
  before: SkillDirectorySnapshot | null
): SkillDirectorySnapshot {
  if (!before) throw new Error(`Skill ${proposal.name} does not exist; patch candidates require an existing Skill.`);
  if (before.sha256 !== proposal.base_sha256) {
    throw new Error(
      `Skill ${proposal.name} changed from patch base ${proposal.base_sha256} to ${before.sha256}; create a new improvement candidate.`
    );
  }
  const directories = new Set(before.directories);
  const files = new Map(before.files.map((file) => [file.path, { ...file }]));
  const metadataAware = before.metadata_sha256 !== undefined;
  const directoryModes = new Map(Object.entries(before.directory_modes ?? {}));
  for (const operation of proposal.operations) {
    switch (operation.op) {
      case "write_text": {
        const mode = files.get(operation.path)?.mode ?? (metadataAware ? DEFAULT_SKILL_FILE_MODE : undefined);
        files.set(operation.path, snapshotFile(operation.path, Buffer.from(operation.content, "utf-8"), mode));
        addParentDirectories(directories, operation.path, metadataAware ? directoryModes : undefined);
        break;
      }
      case "write_base64": {
        const mode = files.get(operation.path)?.mode ?? (metadataAware ? DEFAULT_SKILL_FILE_MODE : undefined);
        files.set(operation.path, snapshotFile(operation.path, Buffer.from(operation.content_base64, "base64"), mode));
        addParentDirectories(directories, operation.path, metadataAware ? directoryModes : undefined);
        break;
      }
      case "replace_text": {
        const mode = files.get(operation.path)?.mode;
        const current = requiredExistingText(files, operation.path, operation.op);
        const first = current.indexOf(operation.old_text);
        const second = first < 0 ? -1 : current.indexOf(operation.old_text, first + operation.old_text.length);
        if (first < 0 || second >= 0) {
          throw new Error(`replace_text for ${operation.path} must match old_text exactly once.`);
        }
        const next = `${current.slice(0, first)}${operation.new_text}${current.slice(first + operation.old_text.length)}`;
        files.set(operation.path, snapshotFile(operation.path, Buffer.from(next, "utf-8"), mode));
        break;
      }
      case "append_text": {
        const mode = files.get(operation.path)?.mode;
        const current = requiredExistingText(files, operation.path, operation.op);
        files.set(operation.path, snapshotFile(operation.path, Buffer.from(`${current}${operation.content}`, "utf-8"), mode));
        break;
      }
      case "delete":
        if (!files.delete(operation.path)) throw new Error(`delete requires existing Skill file ${operation.path}.`);
        break;
    }
  }
  return finishSkillSnapshot(directories, files.values(), metadataAware ? {
    root_mode: before.root_mode,
    directory_modes: Object.fromEntries(directoryModes),
  } : {});
}

function validateFinalSkill(name: string, snapshot: SkillDirectorySnapshot): void {
  const files = new Map(snapshot.files.map((file) => [file.path, file]));
  const skillMd = files.get("SKILL.md");
  if (!skillMd) throw new Error("Final Skill must contain SKILL.md.");
  const skillText = utf8Text(skillMd, "SKILL.md");
  const frontmatter = skillText.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!frontmatter) throw new Error("SKILL.md must start with YAML frontmatter.");
  if (frontmatterSkillName(frontmatter) !== name) {
    throw new Error(`SKILL.md frontmatter must declare name: ${name}.`);
  }
  if (skillText.includes("TODO")) throw new Error("SKILL.md still contains TODO markers.");
  const openai = files.get("agents/openai.yaml");
  if (openai && !utf8Text(openai, "agents/openai.yaml").includes(`$${name}`)) {
    throw new Error(`agents/openai.yaml default prompt must explicitly mention $${name}.`);
  }
}

function parsePatchOperations(value: unknown): SkillPatchOperation[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("payload.operations must be a non-empty array.");
  if (value.length > MAX_OPERATIONS) throw new Error(`payload.operations may contain at most ${MAX_OPERATIONS} items.`);
  const operations: SkillPatchOperation[] = [];
  const seen = new Set<string>();
  let totalBytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const item = requiredRecord(value[index], `payload.operations[${index}]`);
    const op = requiredString(item.op, `payload.operations[${index}].op`);
    const path = safeSkillPath(item.path, `payload.operations[${index}].path`);
    assertUniquePath(seen, path, "payload.operations");
    switch (op) {
      case "write_text": {
        const content = stringValue(item.content, `payload.operations[${index}].content`);
        totalBytes += boundedTextBytes(content, path);
        operations.push({ op, path, content });
        break;
      }
      case "write_base64": {
        const contentBase64 = canonicalBase64(item.content_base64, `payload.operations[${index}].content_base64`);
        const bytes = Buffer.from(contentBase64, "base64").byteLength;
        if (bytes > MAX_FILE_BYTES) throw new Error(`${path} exceeds the ${MAX_FILE_BYTES} byte patch file limit.`);
        totalBytes += bytes;
        operations.push({ op, path, content_base64: contentBase64 });
        break;
      }
      case "replace_text": {
        const oldText = nonEmptyString(item.old_text, `payload.operations[${index}].old_text`);
        const newText = stringValue(item.new_text, `payload.operations[${index}].new_text`);
        totalBytes += boundedTextBytes(oldText, path) + boundedTextBytes(newText, path);
        operations.push({ op, path, old_text: oldText, new_text: newText });
        break;
      }
      case "append_text": {
        const content = nonEmptyString(item.content, `payload.operations[${index}].content`);
        totalBytes += boundedTextBytes(content, path);
        operations.push({ op, path, content });
        break;
      }
      case "delete":
        operations.push({ op, path });
        break;
      default:
        throw new Error(`Unsupported patch operation ${op}.`);
    }
    if (totalBytes > MAX_PATCH_BYTES) throw new Error(`Patch content exceeds ${MAX_PATCH_BYTES} bytes.`);
  }
  return operations;
}

function safeSkillPath(value: unknown, label: string): string {
  const path = requiredString(value, label);
  if (path.length > 240) throw new Error(`${label} is longer than 240 characters.`);
  if (path.includes("\\") || path.startsWith("/") || path.endsWith("/")) {
    throw new Error(`${label} must be a relative forward-slash path.`);
  }
  const parts = path.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new Error(`${label} contains an unsafe path segment.`);
  }
  for (const part of parts) {
    if (part.length > 100 || part.endsWith(".") || part.endsWith(" ") || WINDOWS_RESERVED.test(part) || WINDOWS_INVALID.test(part)) {
      throw new Error(`${label} contains a Windows-unsafe path segment ${part}.`);
    }
  }
  return path;
}

export function parseSkillName(value: unknown, label = "payload.name"): string {
  const name = requiredString(value, label);
  if (!SKILL_NAME.test(name) || name.length > 64) {
    throw new Error(`${label} must be 1-64 lowercase letters, digits, and single hyphen-separated segments.`);
  }
  if (WINDOWS_RESERVED.test(name)) throw new Error(`${label} must not be a Windows-reserved name.`);
  return name;
}

function frontmatterSkillName(frontmatter: string): string | null {
  const declarations = frontmatter.split(/\r?\n/).filter((line) => /^name\s*:/.test(line));
  if (declarations.length !== 1) return null;
  const scalar = declarations[0].replace(/^name\s*:\s*/, "").trim();
  const quoted = scalar.match(/^(["'])([^"']*)\1\s*(?:#.*)?$/);
  if (quoted) return quoted[2];
  return scalar.match(/^([a-z0-9]+(?:-[a-z0-9]+)*)\s*(?:#.*)?$/)?.[1] ?? null;
}

function requiredExistingText(files: Map<string, SnapshotFile>, path: string, op: string): string {
  const file = files.get(path);
  if (!file) throw new Error(`${op} requires existing Skill file ${path}.`);
  return utf8Text(file, path);
}

function utf8Text(file: SnapshotFile, label: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(file.content_base64, "base64"));
  } catch {
    throw new Error(`${label} must contain valid UTF-8 text for this operation.`);
  }
}

function snapshotFile(path: string, content: Uint8Array, mode?: number): SnapshotFile {
  return {
    path,
    content_base64: Buffer.from(content).toString("base64"),
    sha256: digest(content),
    ...(mode === undefined ? {} : { mode }),
  };
}

function addParentDirectories(
  directories: Set<string>,
  path: string,
  directoryModes?: Map<string, number>
): void {
  const parts = path.split("/");
  for (let index = 1; index < parts.length; index += 1) {
    const directory = parts.slice(0, index).join("/");
    directories.add(directory);
    if (directoryModes && !directoryModes.has(directory)) directoryModes.set(directory, DEFAULT_SKILL_DIRECTORY_MODE);
  }
}

function permissionMode(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 0o777) {
    throw new Error(`${label} must contain only permission bits from 000 through 777.`);
  }
  return value;
}

function assertUniquePath(seen: Set<string>, path: string, label: string): void {
  const folded = path.toLowerCase();
  if (seen.has(folded)) throw new Error(`${label} contains duplicate or case-colliding path ${path}.`);
  seen.add(folded);
}

function canonicalBase64(value: unknown, label: string): string {
  const encoded = stringValue(value, label);
  if (encoded.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new Error(`${label} must be canonical base64.`);
  }
  const content = Buffer.from(encoded, "base64");
  if (content.toString("base64") !== encoded) throw new Error(`${label} must be canonical base64.`);
  return encoded;
}

function boundedTextBytes(value: string, path: string): number {
  const bytes = Buffer.byteLength(value, "utf-8");
  if (bytes > MAX_FILE_BYTES) throw new Error(`${path} exceeds the ${MAX_FILE_BYTES} byte patch text limit.`);
  return bytes;
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} is required.`);
  if (value !== value.trim()) throw new Error(`${label} must not have leading or trailing whitespace.`);
  return value;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  return value;
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty string.`);
  return value;
}

function digest(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}
