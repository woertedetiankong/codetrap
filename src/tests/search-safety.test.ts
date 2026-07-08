import { describe, expect, test } from "bun:test";
import { openDatabase } from "../db/connection";
import { TrapRepository } from "../db/repository";
import { parseArgs } from "../commands/command-args";
import { prepareFTSQuery } from "../lib/fts-query";
import { trap } from "./helpers";

describe("FTS query safety", () => {
  test("special FTS syntax characters do not throw", async () => {
    const repo = new TrapRepository(openDatabase(":memory:"));
    repo.add(trap());

    for (const query of ["*test (query) -bad", "foo -bar", "hello/world", '"unterminated', "a OR b", "NEAR(a b)", "~"]) {
      const results = await repo.search(query, { mode: "fts" });
      expect(Array.isArray(results)).toBe(true);
    }
  });

  test("literal query compiler quotes user terms", () => {
    expect(prepareFTSQuery('a "quoted" -term')).toBe('"a" OR """quoted""" OR "-term"');
  });

  test("flag values are not treated as positional query text", () => {
    const parsed = parseArgs(["HTTP 请求约定", "--mode", "hybrid", "--limit", "5"]);
    expect(parsed.positionals).toEqual(["HTTP 请求约定"]);
    expect(parsed.opts).toEqual({ mode: "hybrid", limit: "5" });
  });
});
