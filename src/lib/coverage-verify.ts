import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, resolve, sep } from "node:path";
import type { CandidateCoverage } from "../domain/session";
import type { TrapOperations } from "./trap-operations";

export type CoverageClaim = {
  claim?: string | null;
  covered_by?: unknown;
  overlaps?: unknown;
};

export type CoverageContext = {
  projectRoot: string;
  traps: TrapOperations;
  /** Session-qualified keys, `<session-id>/cand-001`. */
  knownCandidateIds: Set<string>;
};

/**
 * §9.3's CLI half.
 *
 * "Agent (drafting): proposes coverage claims. CLI (staging): deterministically
 * verifies every claimed ref exists (trap IDs, file paths, section anchors,
 * candidate IDs) ... flags candidates whose claims failed verification."
 *
 * The CLI does not judge whether the coverage is *correct* — that is semantic
 * and belongs to the human. It only answers whether the thing pointed at is
 * really there, which is the part a machine can settle.
 */
export function verifyCoverage(
  raw: CoverageClaim | null | undefined,
  context: CoverageContext
): CandidateCoverage | undefined {
  if (!raw) return undefined;

  const refs = [
    ...toRefList(raw.covered_by),
    ...toRefList(raw.overlaps),
  ];
  if (refs.length === 0 && !raw.claim) return undefined;

  const verified = refs.map((ref) => verifyRef(ref, context));
  return {
    claim: typeof raw.claim === "string" && raw.claim.trim() ? raw.claim.trim() : null,
    refs: verified,
    verified_all: verified.every((entry) => entry.verified),
  };
}

function verifyRef(ref: string, context: CoverageContext): CandidateCoverage["refs"][number] {
  const trapMatch = ref.match(/^trap[:#](\d+)$/i);
  if (trapMatch) {
    const id = Number.parseInt(trapMatch[1], 10);
    const details = context.traps.getTrapDetails(id);
    return details
      ? { ref, kind: "trap", verified: true, detail: `trap #${id} in ${details.scope} scope: ${details.trap.title}` }
      : { ref, kind: "trap", verified: false, detail: `no trap #${id} in either scope` };
  }

  // Candidate ids are only unique inside one session, so a bare `cand-001`
  // exists almost everywhere and would rubber-stamp a dangling reference.
  // A qualified `<session-id>/cand-001` is checked exactly; a bare one is only
  // accepted when precisely one session has it.
  const qualified = ref.match(/^(?:cand(?:idate)?:)?([A-Za-z0-9._-]+)\/(cand-\d+)$/i);
  if (qualified) {
    const key = `${qualified[1]}/${qualified[2].toLowerCase()}`;
    return context.knownCandidateIds.has(key)
      ? { ref, kind: "candidate", verified: true, detail: `candidate ${key} exists` }
      : { ref, kind: "candidate", verified: false, detail: `no candidate ${key} in this project` };
  }

  const bare = ref.match(/^(?:cand(?:idate)?[:#])?(cand-\d+)$/i);
  if (bare) {
    const id = bare[1].toLowerCase();
    const matches = [...context.knownCandidateIds].filter((key) => key.endsWith(`/${id}`));
    if (matches.length === 1) {
      return { ref, kind: "candidate", verified: true, detail: `candidate ${matches[0]} exists` };
    }
    if (matches.length === 0) {
      return { ref, kind: "candidate", verified: false, detail: `no candidate ${id} in this project` };
    }
    return {
      ref,
      kind: "candidate",
      verified: false,
      detail: `${id} is ambiguous across ${matches.length} sessions; qualify it as <session-id>/${id}`,
    };
  }

  // `path/to/file.md#section-anchor`
  const [rawPath, anchor] = splitAnchor(ref);
  if (rawPath) return verifyFileRef(ref, rawPath, anchor, context.projectRoot);

  return { ref, kind: "unknown", verified: false, detail: "unrecognized ref form" };
}

function verifyFileRef(
  ref: string,
  rawPath: string,
  anchor: string | null,
  projectRoot: string
): CandidateCoverage["refs"][number] {
  const root = resolve(projectRoot);
  const target = isAbsolute(rawPath) ? resolve(rawPath) : resolve(join(root, rawPath));

  // A coverage ref is a pointer into the project, not a way to probe the disk.
  if (target !== root && !target.startsWith(root.endsWith(sep) ? root : root + sep)) {
    return { ref, kind: "file", verified: false, detail: "path is outside the project" };
  }
  if (!existsSync(target) || !statSync(target).isFile()) {
    return { ref, kind: "file", verified: false, detail: "file does not exist" };
  }
  if (!anchor) {
    return { ref, kind: "file", verified: true, detail: "file exists" };
  }

  const content = readFileSync(target, "utf-8");
  return headingAnchors(content).has(normalizeAnchor(anchor))
    ? { ref, kind: "file", verified: true, detail: `file exists and contains section "${anchor}"` }
    : { ref, kind: "file", verified: false, detail: `file exists but has no section "${anchor}"` };
}

function splitAnchor(ref: string): [string | null, string | null] {
  const trimmed = ref.trim();
  if (!trimmed) return [null, null];
  const hash = trimmed.indexOf("#");
  if (hash === -1) return [trimmed, null];
  return [trimmed.slice(0, hash) || null, trimmed.slice(hash + 1) || null];
}

function headingAnchors(markdown: string): Set<string> {
  const anchors = new Set<string>();
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) anchors.add(normalizeAnchor(heading[1]));
  }
  return anchors;
}

function normalizeAnchor(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-");
}

function toRefList(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}
