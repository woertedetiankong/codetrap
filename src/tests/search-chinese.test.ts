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

  test("mixed Chinese/English query can hit expanded coding terms", async () => {
    const repo = new TrapRepository(openDatabase(":memory:"));
    repo.add(trap());

    const results = await repo.search("HTTP 请求约定", { mode: "fts" });
    expect(results.some((result) => result.trap.title.includes("fetchWrapper"))).toBe(true);
  });
});
