import { describe, expect, test } from "bun:test";
import { openDatabase } from "../db/connection";
import { TrapRepository } from "../db/repository";
import { trap } from "./helpers";

describe("Chinese and mixed-language search", () => {
  test("finds Chinese trap text through pre-tokenized search_text", async () => {
    const repo = new TrapRepository(openDatabase(":memory:"));
    repo.add(
      trap({
        title: "网络请求超时处理",
        context: "网络请求超时时必须使用 fetchWrapper 的 retry 配置。",
        mistake: "直接调用 fetch 会绕过统一错误处理。",
        fix: "通过 fetchWrapper 设置 timeout 和 retry。",
      })
    );

    const results = await repo.search("网络请求超时", { mode: "fts" });
    expect(results[0]?.trap.title).toBe("网络请求超时处理");
  });

  test("a single-char CJK query matches multi-char content via prefix (M9)", async () => {
    const repo = new TrapRepository(openDatabase(":memory:"));
    repo.add(
      trap({
        title: "缓存失效问题",
        context: "缓存未在写入后失效，导致读到旧值。",
        mistake: "直接读取缓存而不校验版本。",
        fix: "写入后主动清除缓存条目。",
      })
    );

    const results = await repo.search("缓", { mode: "fts" });
    expect(results[0]?.trap.title).toBe("缓存失效问题");
  });

  test("mixed Chinese/English query can hit expanded coding terms", async () => {
    const repo = new TrapRepository(openDatabase(":memory:"));
    repo.add(trap());

    const results = await repo.search("HTTP 请求约定", { mode: "fts" });
    expect(results.some((result) => result.trap.title.includes("fetchWrapper"))).toBe(true);
  });
});
