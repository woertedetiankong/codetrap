import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync, symlinkSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codexSessionsAdapter, readCodexSession } from "../lib/adapters/codex-sessions";
import { claudeCodeSessionsAdapter, readClaudeCodeSession } from "../lib/adapters/claude-code-sessions";
import { collectSessions, inventorySource, parseSinceDays } from "../lib/learning-sources";
import { assertInsideRoot, type SessionSourceAdapter } from "../lib/learning-source-adapter";
import { excerpt, isHarnessNoise, redact } from "../lib/learning-redaction";
import type { NormalizedSession } from "../domain/learning-source";

/**
 * The conversation both fixtures encode. Phase 1C's exit gate is that these two
 * on-disk formats normalize to the same envelope, so the shared content lives
 * in one place and each fixture writer renders it into its client's shape.
 */
const CONVERSATION = [
  { role: "user" as const, text: "The build keeps timing out at two minutes.", at: "2026-07-01T10:00:00.000Z" },
  { role: "assistant" as const, text: "That is the default Bash timeout; pass an explicit timeout for long builds.", at: "2026-07-01T10:00:05.000Z" },
  { role: "user" as const, text: "Right — and my token is sk-ant-abcdefghijklmnopqrstuvwxyz123456 if you need it.", at: "2026-07-01T10:01:00.000Z" },
];

describe("Phase 1C — dual-source adapter parity", () => {
  test("C1: equivalent histories normalize to the same envelope from both adapters", () => {
    const home = fixtureHome();
    writeCodexSession(home, "0199bead-cd4f-73c3-9377-5414357c9ef0", "/mnt/d/project");
    writeClaudeSession(home, "8f14e45f-ceea-467a-9f0b-1c2d3e4f5a6b", "/mnt/d/project");

    const codex = readOnly(codexSessionsAdapter, home);
    const claude = readOnly(claudeCodeSessionsAdapter, home);

    // Same keys, in the same order — a differently-shaped object would make the
    // compiler layer able to tell the clients apart, which §3.1 forbids.
    expect(Object.keys(codex)).toEqual(Object.keys(claude));

    // Same content, modulo the three fields that are genuinely client-specific.
    expect(clientAgnostic(codex)).toEqual(clientAgnostic(claude));

    expect(codex.source).toBe("codex-sessions");
    expect(claude.source).toBe("claude-code-sessions");
  });

  test("C1: the turn stream is identical, including redaction", () => {
    const home = fixtureHome();
    writeCodexSession(home, "codex-1", "/mnt/d/project");
    writeClaudeSession(home, "claude-1", "/mnt/d/project");

    const codex = readOnly(codexSessionsAdapter, home);
    const claude = readOnly(claudeCodeSessionsAdapter, home);

    expect(codex.turns).toEqual(claude.turns);
    expect(codex.turns).toHaveLength(3);
    expect(codex.turns[2].text).toContain("[REDACTED:anthropic-key]");
    expect(codex.turns[2].text).not.toContain("sk-ant-");
  });

  test("C1: the source manifest has the same shape from both adapters", () => {
    const home = fixtureHome();
    writeCodexSession(home, "codex-1", "/mnt/d/project");
    writeClaudeSession(home, "claude-1", "/mnt/d/project");
    const now = new Date("2026-07-02T00:00:00.000Z");

    const codex = collectSessions(codexSessionsAdapter, home, undefined, now);
    const claude = collectSessions(claudeCodeSessionsAdapter, home, undefined, now);

    expect(Object.keys(codex.manifest)).toEqual(Object.keys(claude.manifest));
    expect(Object.keys(codex.manifest.totals)).toEqual(Object.keys(claude.manifest.totals));

    // Values, not only keys: both adapters build entries through one helper, so
    // comparing key sets alone would pass no matter how far the two readers
    // diverged. These are the fields the readers actually populate themselves.
    const [codexEntry] = codex.manifest.entries;
    const [claudeEntry] = claude.manifest.entries;
    expect(codexEntry.cwd).toBe(claudeEntry.cwd);
    expect(codexEntry.first_timestamp).toBe(claudeEntry.first_timestamp);
    expect(codexEntry.last_timestamp).toBe(claudeEntry.last_timestamp);
    expect(codex.manifest.totals.redactions).toBe(claude.manifest.totals.redactions);
    expect(codex.manifest.totals.sessions).toBe(claude.manifest.totals.sessions);

    // Provenance is actually recorded, not just shaped.
    for (const manifest of [codex.manifest, claude.manifest]) {
      const entry = manifest.entries[0];
      expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(entry.bytes).toBeGreaterThan(0);
      expect(entry.first_timestamp).toBe("2026-07-01T10:00:00.000Z");
      expect(entry.last_timestamp).toBe("2026-07-01T10:01:00.000Z");
      expect(manifest.totals.redactions).toBe(1);
    }
  });

  test("the manifest accounts for files read but dropped as empty", () => {
    const home = fixtureHome();
    writeClaudeSession(home, "real", "/mnt/d/project");
    writeNoiseOnlyClaudeSession(home, "noise-only", "/mnt/d/project");

    const collected = collectSessions(claudeCodeSessionsAdapter, home, undefined, new Date("2026-07-02T00:00:00.000Z"));
    expect(collected.sessions).toHaveLength(1);
    // §3.2 requires reporting every file read — a dropped session was still
    // opened and hashed, so it must appear rather than vanishing from the audit.
    expect(collected.manifest.totals.files_read).toBe(2);
    expect(collected.manifest.totals.sessions).toBe(1);
    expect(collected.manifest.totals.skipped_empty).toBe(1);
    expect(collected.manifest.entries).toHaveLength(2);
  });

  test("a symlinked intermediate directory cannot escape the root", () => {
    const home = fixtureHome();
    const root = join(home, ".codex", "sessions");
    mkdirSync(root, { recursive: true });
    const outside = join(home, "outside");
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, "leak.jsonl"), "{}\n");
    try {
      symlinkSync(outside, join(root, "archive"));
    } catch {
      return;
    }
    // A purely lexical prefix check would accept this path.
    expect(() => assertInsideRoot(join(root, "archive", "leak.jsonl"), [root]))
      .toThrow(/outside the allowed source roots/);
  });

  test("Codex records no git branch and says so with null, rather than omitting it", () => {
    const home = fixtureHome();
    writeCodexSession(home, "codex-1", "/mnt/d/project");
    const codex = readOnly(codexSessionsAdapter, home);
    expect(codex.branch).toBeNull();
    expect("branch" in codex).toBe(true);
  });

  test("Claude Code carries the git branch through", () => {
    const home = fixtureHome();
    writeClaudeSession(home, "claude-1", "/mnt/d/project", { branch: "feature/x" });
    expect(readOnly(claudeCodeSessionsAdapter, home).branch).toBe("feature/x");
  });
});

describe("Phase 1C — source discovery and privacy", () => {
  test("discovery is scoped to the client's own root", () => {
    const home = fixtureHome();
    expect(codexSessionsAdapter.roots(home)).toEqual([join(home, ".codex", "sessions")]);
    expect(claudeCodeSessionsAdapter.roots(home)).toEqual([join(home, ".claude", "projects")]);
  });

  test("a path outside the allowed roots is refused", () => {
    const home = fixtureHome();
    const outside = join(home, "elsewhere.jsonl");
    writeFileSync(outside, "{}\n");
    expect(() => assertInsideRoot(outside, codexSessionsAdapter.roots(home)))
      .toThrow(/outside the allowed source roots/);
  });

  test("a symlink inside a root is refused rather than followed", () => {
    const home = fixtureHome();
    const root = join(home, ".codex", "sessions");
    mkdirSync(root, { recursive: true });
    const secret = join(home, "secret.jsonl");
    writeFileSync(secret, '{"type":"session_meta"}\n');
    const link = join(root, "linked.jsonl");
    try {
      symlinkSync(secret, link);
    } catch {
      return; // Filesystems without symlink support skip this.
    }
    expect(() => assertInsideRoot(link, [root])).toThrow(/it is a symlink/);
    // And discovery never offers it in the first place.
    expect(codexSessionsAdapter.discover(home).map((ref) => ref.path)).not.toContain(link);
  });

  test("--project-only keeps sessions whose cwd is inside the project", () => {
    const home = fixtureHome();
    writeClaudeSession(home, "inside", "/mnt/d/project");
    writeClaudeSession(home, "outside", "/mnt/d/other");

    const all = claudeCodeSessionsAdapter.discover(home);
    const scoped = claudeCodeSessionsAdapter.discover(home, { projectRoot: "/mnt/d/project" });
    expect(all).toHaveLength(2);
    expect(scoped).toHaveLength(1);
    expect(scoped[0].session_id).toBe("inside");
  });

  test("a missing client root reports unavailable instead of throwing", () => {
    const home = fixtureHome();
    const inventory = inventorySource(codexSessionsAdapter, home);
    expect(inventory).toMatchObject({ available: false, session_count: 0 });
  });

  test("harness noise is dropped so it cannot masquerade as a lesson", () => {
    expect(isHarnessNoise("<system-reminder>do a thing</system-reminder>")).toBe(true);
    expect(isHarnessNoise("<command-name>/model</command-name>")).toBe(true);
    expect(isHarnessNoise("Caveat: The messages below were generated")).toBe(true);
    expect(isHarnessNoise("   ")).toBe(true);
    expect(isHarnessNoise("The build keeps timing out.")).toBe(false);
  });

  test("secrets are redacted and counted", () => {
    const result = redact("key sk-ant-abcdefghijklmnopqrstuvwxyz123456 and mail a@b.com");
    expect(result.text).toContain("[REDACTED:anthropic-key]");
    expect(result.text).toContain("[REDACTED:email]");
    expect(result.total).toBe(2);
  });

  test("excerpts respect the 500-character evidence budget", () => {
    const long = "x".repeat(900);
    expect(excerpt(long).length).toBeLessThanOrEqual(500);
    expect(excerpt("  spaced   out  ")).toBe("spaced out");
  });

  test("a torn final line does not cost the whole session", () => {
    const home = fixtureHome();
    const path = writeClaudeSession(home, "torn", "/mnt/d/project");
    writeFileSync(path, `${readFileSync(path, "utf-8")}{"type":"user","timesta`);
    const session = readClaudeCodeSession({
      source: "claude-code-sessions",
      session_id: "torn",
      path,
      modified_at: new Date().toISOString(),
    }, claudeCodeSessionsAdapter.roots(home)).session;
    expect(session.turn_count).toBe(3);
  });

  test("--since parses day, week and month forms and rejects junk", () => {
    const now = new Date("2026-07-31T00:00:00.000Z");
    expect(parseSinceDays("30d", now)?.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(parseSinceDays("1w", now)?.toISOString()).toBe("2026-07-24T00:00:00.000Z");
    expect(parseSinceDays(undefined, now)).toBeUndefined();
    expect(() => parseSinceDays("last tuesday", now)).toThrow(/Invalid --since/);
  });
});

// --- fixtures -----------------------------------------------------------

function fixtureHome(): string {
  return mkdtempSync(join(tmpdir(), "codetrap-1c-home-"));
}

function readOnly(adapter: SessionSourceAdapter, home: string): NormalizedSession {
  const [ref] = adapter.discover(home);
  if (!ref) throw new Error("fixture produced no discoverable session");
  return adapter.read(ref, adapter.roots(home)).session;
}

/** Fields that are legitimately client-specific and excluded from the parity check. */
function clientAgnostic(session: NormalizedSession) {
  const { source, path, client_version, session_id, branch, ...rest } = session;
  return rest;
}

function writeCodexSession(home: string, sessionId: string, cwd: string): string {
  const dir = join(home, ".codex", "sessions", "2026", "07", "01");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `rollout-2026-07-01T10-00-00-${sessionId}.jsonl`);
  const lines = [
    JSON.stringify({
      timestamp: "2026-07-01T10:00:00.000Z",
      type: "session_meta",
      payload: { id: sessionId, timestamp: "2026-07-01T10:00:00.000Z", cwd, originator: "codex_cli_rs", cli_version: "0.42.0" },
    }),
    // Environment context is harness noise in both clients and must be dropped.
    JSON.stringify({
      timestamp: "2026-07-01T10:00:01.000Z",
      type: "response_item",
      payload: { type: "message", role: "user", content: [{ type: "input_text", text: "<environment_context>\n  <cwd>/mnt/d/project</cwd>\n</environment_context>" }] },
    }),
    ...CONVERSATION.map((turn) => JSON.stringify({
      timestamp: turn.at,
      type: "response_item",
      payload: { type: "message", role: turn.role, content: [{ type: "input_text", text: turn.text }] },
    })),
  ];
  writeFileSync(path, `${lines.join("\n")}\n`);
  return path;
}

function writeNoiseOnlyClaudeSession(home: string, sessionId: string, cwd: string): void {
  const dir = join(home, ".claude", "projects", cwd.replace(/[\\/]/g, "-"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${sessionId}.jsonl`), `${[
    JSON.stringify({ type: "mode", mode: "normal", sessionId }),
    JSON.stringify({ sessionId, cwd, type: "system", timestamp: "2026-07-01T09:00:00.000Z", content: "<command-name>/model</command-name>" }),
  ].join("\n")}\n`);
}

function writeClaudeSession(
  home: string,
  sessionId: string,
  cwd: string,
  options: { branch?: string } = {}
): string {
  const dir = join(home, ".claude", "projects", cwd.replace(/[\\/]/g, "-"));
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${sessionId}.jsonl`);
  const base = { sessionId, cwd, version: "2.1.204", gitBranch: options.branch ?? "main" };
  const lines = [
    JSON.stringify({ type: "mode", mode: "normal", sessionId }),
    JSON.stringify({
      ...base,
      type: "system",
      subtype: "local_command",
      content: "<command-name>/model</command-name>",
      timestamp: "2026-07-01T09:59:00.000Z",
    }),
    ...CONVERSATION.map((turn) => JSON.stringify({
      ...base,
      type: turn.role,
      timestamp: turn.at,
      message: { role: turn.role, content: [{ type: "text", text: turn.text }] },
    })),
  ];
  writeFileSync(path, `${lines.join("\n")}\n`);
  return path;
}
