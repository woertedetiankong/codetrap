import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { openDatabase } from "../db/connection";
import { TrapRepository } from "../db/repository";
import { TrapStore } from "../lib/store";
import { SessionStore } from "../lib/session-store";
import { NOTES_FILE, sessionRelativeFile } from "../lib/session-codec";
import { parseTrapTags } from "../lib/trap-json-fields";
import { isoToSqliteTimestamp, sqliteTimestampToIso } from "../lib/trap-codec";
import { scoreCandidateTrap } from "../lib/trap-quality";
import { formatTrapActionCard } from "../lib/format";
import { getGlobalDir } from "../lib/scope";
import type { TrapActionCard } from "../domain/trap";
import { runCli, tempHome, tempProjectDir, trap } from "./helpers";

describe("L1 — JSON string-array codec preserves scalars", () => {
  test("a JSON scalar becomes a single element instead of being dropped", () => {
    expect(parseTrapTags("123")).toEqual(["123"]);
    expect(parseTrapTags("true")).toEqual(["true"]);
    expect(parseTrapTags('["a","b"]')).toEqual(["a", "b"]);
    expect(parseTrapTags("bare-word")).toEqual(["bare-word"]);
    expect(parseTrapTags("null")).toEqual([]);
    expect(parseTrapTags("")).toEqual([]);
  });
});

describe("L2 — viewing a trap does not bump updated_at", () => {
  test("hit increments hit_count but leaves updated_at (and list order) alone", () => {
    const repo = new TrapRepository(openDatabase(":memory:"));
    const id = repo.add(trap());
    const before = repo.get(id)!.updated_at;

    repo.hit(id);

    const after = repo.get(id)!;
    expect(after.hit_count).toBe(1);
    expect(after.updated_at).toBe(before);
  });
});

describe("L3 — evidence orders by normalized timestamp", () => {
  test("mixed ISO/space observed_at values sort by real time, not lexically", () => {
    const repo = new TrapRepository(openDatabase(":memory:"));
    const id = repo.add(trap());
    repo.addEvidence(id, { source_type: "manual", observed_at: "2026-07-07T06:00:00Z" });
    repo.addEvidence(id, { source_type: "manual", observed_at: "2026-07-07 18:00:00" });

    const evidence = repo.getDetails(id, "global")!.evidence;
    // Normalized to canonical form and ordered newest-first (18:00 before 06:00).
    expect(evidence[0]!.observed_at).toBe("2026-07-07 18:00:00");
    expect(evidence[1]!.observed_at).toBe("2026-07-07 06:00:00");
  });
});

describe("L4 — export timestamps round-trip through zoned RFC-3339", () => {
  test("sqlite ↔ ISO conversions are inverse and canonical", () => {
    // Typed as string (not literals) so the generic return type stays `string`.
    const sqliteTs: string = "2026-07-07 12:00:00";
    const isoTs: string = "2026-07-07T12:00:00Z";
    expect(sqliteTimestampToIso(sqliteTs)).toBe("2026-07-07T12:00:00Z");
    expect(isoToSqliteTimestamp(isoTs)).toBe("2026-07-07 12:00:00");
    // Canonical values are left untouched on import; nullish passes through.
    expect(isoToSqliteTimestamp(sqliteTs)).toBe("2026-07-07 12:00:00");
    expect(sqliteTimestampToIso(null)).toBeNull();
    expect(isoToSqliteTimestamp(undefined)).toBeUndefined();
  });
});

describe("L5 — path resolution has no filesystem side effect", () => {
  test("getGlobalDir does not create ~/.codetrap just by resolving it", () => {
    const home = tempHome("codetrap-l5-", { realpath: true });
    const dir = getGlobalDir(home);
    expect(dir).toBe(join(home, ".codetrap"));
    expect(existsSync(dir)).toBe(false);
  });
});

describe("L13 — score cards name their ranking basis", () => {
  const card = (sources: string[]): TrapActionCard =>
    ({
      trap_id: 1,
      scope: "project",
      severity: "warning",
      title: "t",
      why_relevant: "w",
      avoid: "a",
      do_instead: "d",
      score: 0.03,
      sources,
    }) as unknown as TrapActionCard;

  test("labels rrf / bm25 / cosine so the score magnitude is legible", () => {
    expect(formatTrapActionCard(card(["fts", "semantic"]))).toContain("(fts+semantic, rrf)");
    expect(formatTrapActionCard(card(["fts"]))).toContain("(fts, bm25)");
    expect(formatTrapActionCard(card(["semantic"]))).toContain("(semantic, cosine)");
  });
});

describe("L14 — --limit is a budget across scopes, not per scope", () => {
  test("total returned results never exceed the requested limit", async () => {
    const home = tempHome("codetrap-l14-home-", { realpath: true, initCodetrap: true });
    const cwd = tempProjectDir("codetrap-l14-project-", { realpath: true });
    const store = new TrapStore(cwd, undefined, home);
    for (let i = 0; i < 3; i++) {
      store.add(trap({ scope: "project", title: `project fetchWrapper trap ${i}` }));
      store.add(trap({ scope: "global", title: `global fetchWrapper trap ${i}` }));
    }

    const { groups } = await store.search("fetchWrapper", { mode: "fts", limit: 2 });
    const total = groups.reduce((sum, group) => sum + group.results.length, 0);
    expect(total).toBeLessThanOrEqual(2);
  });
});

describe("L15 — staleness_risk is derived, not hardcoded", () => {
  const draft = (overrides: Record<string, unknown>) =>
    ({
      trap: {
        title: "Pin fetch behavior",
        category: "api",
        context: "When calling the API, use the wrapper.",
        mistake: "Direct calls bypass handling.",
        fix: "Use the wrapper.",
        scope: "global",
        tags: ["api"],
        ...overrides,
      },
      evidence: [],
    }) as unknown as Parameters<typeof scoreCandidateTrap>[0];

  test("volatile markers raise the risk above the old hardcoded low", () => {
    const stable = scoreCandidateTrap(draft({})).quality.staleness_risk;
    expect(stable).toBe("low");

    const versioned = scoreCandidateTrap(
      draft({ fix: "Upgrade to v2.3.1 as of 2026 to avoid the deprecated path." })
    ).quality.staleness_risk;
    expect(versioned).toBe("high");
  });
});

describe("L18 — init refuses to run in the home directory", () => {
  test("`codetrap init` in $HOME exits non-zero with guidance", () => {
    const home = tempHome("codetrap-l18-", { realpath: true });
    const result = runCli(["init"], home, home);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("home directory");
  });
});

describe("L9 — --version prints the package version", () => {
  test("prints a semver string", () => {
    const home = tempHome("codetrap-ver-home-", { realpath: true, initCodetrap: true });
    const cwd = tempProjectDir("codetrap-ver-project-", { realpath: true });
    const result = runCli(["--version"], cwd, home);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("L21 — notes header status refreshes on close", () => {
  test("implementation-notes.md no longer claims the session is active after close", () => {
    const project = tempProjectDir("codetrap-l21-", { realpath: true });
    const store = new SessionStore(project);
    const session = store.startSession({ goal: "Ship the feature" });

    store.closeSession(undefined, false);

    const notes = readFileSync(join(project, sessionRelativeFile(session.id, NOTES_FILE)), "utf-8");
    expect(notes).toContain("Status: closed");
    expect(notes).not.toContain("Status: active");
  });
});
