import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LearningStore } from "../lib/learning-store";
import { withAdvisoryLock } from "../lib/advisory-lock";
import { fixturePathKey, tempHome, tempProjectDir } from "./helpers";

const CLI = join(import.meta.dir, "..", "index.ts");

function spawnCli(args: string[], cwd: string, home: string, clientHome?: string) {
  return Bun.spawn({
    cmd: ["bun", "run", CLI, ...args],
    cwd,
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      CODETRAP_EMBEDDING_PROVIDER: "",
      ...(clientHome ? { CODETRAP_CLIENT_HOME: clientHome } : {}),
    },
    stdout: "pipe",
    stderr: "pipe",
  });
}

type Spawned = ReturnType<typeof spawnCli>;

async function runAll(procs: Spawned[]): Promise<{ code: number; out: string }[]> {
  return Promise.all(procs.map(async (proc) => {
    const out = await new Response(proc.stdout as ReadableStream).text();
    const err = await new Response(proc.stderr as ReadableStream).text();
    return { code: await proc.exited, out: out + err };
  }));
}

// §16 1D criterion 1. These spawn real processes against one store on purpose:
// a mocked lock would prove only that the mock works.
describe("Phase 1D — concurrent writes lose nothing", () => {
  test("C1: eight concurrent captures all land in the inbox", async () => {
    const cwd = tempProjectDir("codetrap-1d-capture-race-");
    const home = tempHome();
    await runAll([spawnCli(["init"], cwd, home)]);

    const count = 8;
    const results = await runAll(
      Array.from({ length: count }, (_, index) =>
        spawnCli([
          "session", "capture", "--json",
          "--trap-json", JSON.stringify({
            title: `Concurrent lesson ${index}`,
            category: "convention",
            scope: "project",
            severity: "warning",
            context: `When capture number ${index} runs at the same time as its siblings.`,
            mistake: `Interleaved read-modify-write drops candidate ${index}.`,
            fix: "Hold a per-resource advisory lock around the candidate document.",
          }),
        ], cwd, home)
      )
    );

    expect(results.every((r) => r.code === 0)).toBe(true);

    // The union across every session document must contain all eight.
    const titles = allCandidateTitles(cwd);
    for (let index = 0; index < count; index += 1) {
      expect(titles).toContain(`Concurrent lesson ${index}`);
    }
    expect(titles).toHaveLength(count);
  }, 60_000);

  test("C1: concurrent rejects keep every suppression", async () => {
    const cwd = tempProjectDir("codetrap-1d-suppress-race-");
    const home = tempHome();
    await runAll([spawnCli(["init"], cwd, home)]);
    // One explicit session, so all candidates share a document and the race is
    // on the suppression index rather than on session creation.
    await runAll([spawnCli(["session", "start", "suppression race"], cwd, home)]);

    const count = 6;
    for (let index = 0; index < count; index += 1) {
      const proc = spawnCli([
        "session", "capture", "--json",
        "--goal", "suppression race",
        "--trap-json", JSON.stringify({
          title: `Suppressed lesson ${index}`,
          category: "convention",
          scope: "project",
          severity: "warning",
          context: `When lesson ${index} is skipped by the user.`,
          mistake: `Losing suppression ${index} to an interleaved write.`,
          fix: "Lock the suppression index around its read-modify-write.",
        }),
      ], cwd, home);
      await runAll([proc]);
    }

    const sessionId = firstSessionId(cwd);
    const ids = candidateIds(cwd, sessionId);
    expect(ids).toHaveLength(count);

    const results = await runAll(ids.map((id) =>
      spawnCli(["session", "reject", id, "--session", sessionId, "--reason", `no ${id}`, "--json"], cwd, home)
    ));
    expect(results.every((r) => r.code === 0)).toBe(true);

    // Before the lock, concurrent rejects each wrote a document containing only
    // their own record and the last rename won.
    const suppressions = new LearningStore(cwd).listSuppressions();
    expect(suppressions).toHaveLength(count);
  }, 60_000);

  test("C1: concurrent stages of different reviews lose no candidate", async () => {
    const cwd = tempProjectDir("codetrap-1d-stage-race-");
    const home = tempHome();
    const clientHome = tempHome("codetrap-client-home-");
    await runAll([spawnCli(["init"], cwd, home)]);
    writeClaudeSession(clientHome, "s1", cwd);

    const reviewCount = 4;
    const dirs: string[] = [];
    for (let index = 0; index < reviewCount; index += 1) {
      const [result] = await runAll([
        spawnCli(["learn", "review", "--source", "claude-code-sessions", "--json"], cwd, home, clientHome),
      ]);
      const review = JSON.parse(result.out);
      const pack = JSON.parse(readFileSync(review.evidence_pack_path, "utf-8"));
      writeFileSync(join(review.review_dir, "lesson-candidates.json"), JSON.stringify([{
        title: `Staged from review ${index}`,
        trigger: `When review ${index} stages at the same moment as the others.`,
        lesson: `Interleaved staging drops candidate ${index}.`,
        recommended_action: "Serialize the candidate-document write behind a lock.",
        evidence: [{ ref: pack.items[0].ref }],
      }]));
      dirs.push(review.review_dir);
    }

    const results = await runAll(dirs.map((dir) =>
      spawnCli(["learn", "stage", "--review-dir", dir, "--apply", "--json"], cwd, home, clientHome)
    ));
    expect(results.every((r) => r.code === 0)).toBe(true);

    const titles = allCandidateTitles(cwd);
    for (let index = 0; index < reviewCount; index += 1) {
      expect(titles).toContain(`Staged from review ${index}`);
    }
  }, 90_000);
});

describe("Phase 1D — the advisory lock itself", () => {
  test("serializes two holders and reports the wait", () => {
    const dir = tempProjectDir("codetrap-1d-lock-");
    const lock = join(dir, ".lock");
    let inside = 0;
    let maxConcurrent = 0;

    const first = withAdvisoryLock(lock, () => {
      inside += 1;
      maxConcurrent = Math.max(maxConcurrent, inside);
      inside -= 1;
      return "a";
    });
    expect(first.value).toBe("a");
    expect(first.lock_wait_ms).toBeGreaterThanOrEqual(0);
    expect(maxConcurrent).toBe(1);

    // The lock is released on the way out, so the next acquire succeeds.
    expect(withAdvisoryLock(lock, () => "b").value).toBe("b");
    expect(existsSync(lock)).toBe(false);
  });

  test("releases the lock even when the critical section throws", () => {
    const dir = tempProjectDir("codetrap-1d-lock-throw-");
    const lock = join(dir, ".lock");
    expect(() => withAdvisoryLock(lock, () => { throw new Error("boom"); })).toThrow("boom");
    expect(existsSync(lock)).toBe(false);
    expect(withAdvisoryLock(lock, () => "recovered").value).toBe("recovered");
  });

  test("times out with an actionable message rather than hanging", () => {
    const dir = tempProjectDir("codetrap-1d-lock-timeout-");
    const lock = join(dir, ".lock");
    mkdirSync(lock);
    expect(() => withAdvisoryLock(lock, () => "never", { timeoutMs: 60, staleMs: 60_000 }))
      .toThrow(/Timed out after 60ms waiting for the lock/);
  });

  test("reclaims a lock left behind by a dead process", () => {
    const dir = tempProjectDir("codetrap-1d-lock-stale-");
    const lock = join(dir, ".lock");
    mkdirSync(lock);
    const outcome = withAdvisoryLock(lock, () => "reclaimed", { staleMs: 0 });
    expect(outcome.value).toBe("reclaimed");
    expect(outcome.stole_stale_lock).toBe(true);
  });

  test("never steals an old lock from a live synchronous owner", () => {
    const dir = tempProjectDir("codetrap-1d-lock-live-");
    const lock = join(dir, ".lock");
    mkdirSync(lock);
    writeFileSync(join(lock, "owner"), `${process.pid}.live-holder`);
    const old = new Date(Date.now() - 60_000);
    utimesSync(lock, old, old);

    expect(() => withAdvisoryLock(lock, () => "never", { timeoutMs: 60, staleMs: 0 }))
      .toThrow(/Timed out after 60ms waiting for the lock/);
    expect(readFileSync(join(lock, "owner"), "utf-8")).toBe(`${process.pid}.live-holder`);
  });
});

function sessionDirs(cwd: string): string[] {
  const root = join(cwd, ".codetrap", "sessions");
  if (!existsSync(root)) return [];
  return require("node:fs").readdirSync(root, { withFileTypes: true })
    .filter((entry: { isDirectory: () => boolean; name: string }) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry: { name: string }) => entry.name);
}

function allCandidateTitles(cwd: string): string[] {
  const titles: string[] = [];
  for (const id of sessionDirs(cwd)) {
    const path = join(cwd, ".codetrap", "sessions", id, "candidate-traps.json");
    if (!existsSync(path)) continue;
    for (const candidate of JSON.parse(readFileSync(path, "utf-8")).candidates) {
      titles.push(candidate.trap.title);
    }
  }
  return titles;
}

function firstSessionId(cwd: string): string {
  const [id] = sessionDirs(cwd);
  if (!id) throw new Error("no session directory found");
  return id;
}

function candidateIds(cwd: string, sessionId: string): string[] {
  const path = join(cwd, ".codetrap", "sessions", sessionId, "candidate-traps.json");
  return JSON.parse(readFileSync(path, "utf-8")).candidates.map((c: { id: string }) => c.id);
}

function writeClaudeSession(clientHome: string, sessionId: string, cwd: string): void {
  const dir = join(clientHome, ".claude", "projects", fixturePathKey(cwd));
  mkdirSync(dir, { recursive: true });
  const base = { sessionId, cwd, version: "2.1.204", gitBranch: "main" };
  writeFileSync(join(dir, `${sessionId}.jsonl`), `${[
    JSON.stringify({ ...base, type: "user", timestamp: "2026-07-01T10:00:00.000Z", message: { role: "user", content: [{ type: "text", text: "The build keeps timing out at two minutes." }] } }),
    JSON.stringify({ ...base, type: "assistant", timestamp: "2026-07-01T10:00:05.000Z", message: { role: "assistant", content: [{ type: "text", text: "That is the default Bash timeout." }] } }),
  ].join("\n")}\n`);
}
