import { describe, expect, test } from "bun:test";
import { openDatabase } from "../db/connection";
import { TrapRepository } from "../db/repository";
import { trap } from "./helpers";

/**
 * A3 regression guard. The `--path` glob is the one applicability dimension that
 * cannot be expressed in SQL, so it is applied in JS *after* the FTS `LIMIT`.
 * When a selective path filters out the whole first page of ranked candidates,
 * a matching trap deeper in the ranking used to be silently dropped. FTS
 * retrieval now pages through the ranked matches until it has enough applicable
 * candidates.
 */
describe("FTS --path retrieval paging (A3)", () => {
  test("returns a path-matching trap that ranks past the first candidate page", async () => {
    const repo = new TrapRepository(openDatabase(":memory:"), undefined);

    // 55 strong matches for the query, none of which apply to the target path.
    // 55 > the 50-row first page (candidateLimit = max(limit*5, 50)), so before
    // paging every one of them filled the page and the target was never fetched.
    const decoyCount = 55;
    for (let i = 0; i < decoyCount; i++) {
      repo.add(trap({
        title: `Widget rollout guard decoy ${i}`,
        category: "api",
        scope: "global",
        context: "When shipping the widget rollout guard, review the widget rollout guard checklist.",
        mistake: "Skipping the widget rollout guard breaks the widget rollout guard flow.",
        fix: "Follow the widget rollout guard runbook for the widget rollout guard.",
        path_globs: ["src/decoys/**"],
      }));
    }

    // One weak match (the phrase appears once, diluted by filler) so it ranks
    // last — but it is the only trap that applies to src/target/handler.ts.
    repo.add(trap({
      title: "Target handler note",
      category: "api",
      scope: "global",
      context:
        "This documents the widget rollout guard once amidst unrelated prose about caches, " +
        "queues, retries, serialization, migrations, telemetry, pagination, and configuration.",
      mistake: "Assorted unrelated notes fill this field to keep term frequency low.",
      fix: "Assorted unrelated notes fill this field to keep term frequency low.",
      path_globs: ["src/target/**"],
    }));

    const results = await repo.search("widget rollout guard", {
      mode: "fts",
      scope: "global",
      path: "src/target/handler.ts",
      limit: 5,
    });

    // Every decoy is excluded by the path filter, so the target is the only
    // applicable result — and paging is what makes it reachable.
    expect(results.map((r) => r.trap.title)).toContain("Target handler note");
  });

  test("no --path filter keeps the single-fetch fast path (no regression)", async () => {
    const repo = new TrapRepository(openDatabase(":memory:"), undefined);
    repo.add(trap({ title: "Alpha widget", scope: "global", context: "widget alpha", path_globs: [] }));
    repo.add(trap({ title: "Beta widget", scope: "global", context: "widget beta", path_globs: [] }));

    const results = await repo.search("widget", { mode: "fts", scope: "global" });
    expect(results.map((r) => r.trap.title).sort()).toEqual(["Alpha widget", "Beta widget"]);
  });
});
