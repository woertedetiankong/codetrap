import { describe, expect, test } from "bun:test";
import type { Trap, TrapSearchResult } from "../domain/trap";
import { TrapSearchPolicy } from "../lib/search-policy";

function result(id: number, textLength: number): TrapSearchResult {
  const body = "x".repeat(textLength);
  return {
    trap: { id, context: body, mistake: body, fix: body } as Trap,
    rank: 0,
  };
}

describe("TrapSearchPolicy.fuse length handling (M10)", () => {
  test("does not demote a longer trap that outranks a short one in both signals", () => {
    const policy = new TrapSearchPolicy();
    const long = result(1, 20_000);
    const short = result(2, 50);

    // The long trap is the better match in both FTS and semantic lists.
    const fused = policy.fuse([long, short], [long, short], "query", { rerank: false }, 10);

    // Before M10, sqrt(500/20000) ≈ 0.16 pushed the long trap below the short one.
    expect(fused.map((r) => r.trap.id)).toEqual([1, 2]);
    expect(fused[0]!.score!).toBeGreaterThan(fused[1]!.score!);
  });
});
