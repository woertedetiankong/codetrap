import { describe, expect, test } from "bun:test";
import { bigramCJK, buildSearchText, normalizeQuery } from "../lib/search-normalizer";

describe("search normalizer", () => {
  test("creates CJK bigrams", () => {
    expect(bigramCJK("网络请求")).toEqual(["网络", "络请", "请求"]);
  });

  test("builds search text with CJK grams, ASCII tokens, and small synonym expansion", () => {
    const text = buildSearchText({
      title: "网络请求超时",
      context: "Use fetchWrapper for retries",
      tags: ["api"],
    });

    expect(text).toContain("网络");
    expect(text).toContain("请求");
    expect(text).toContain("fetchwrapper");
    expect(text).toContain("http");
    expect(text).toContain("axios");
  });

  test("normalizes queries with the same token shape as indexed text", () => {
    const query = normalizeQuery("HTTP 请求约定");
    expect(query).toContain("http");
    expect(query).toContain("请求");
    expect(query).toContain("fetch");
  });

  test("marks a single-char CJK query token as a prefix so it can match bigrams (M9)", () => {
    expect(normalizeQuery("缓")).toBe("缓*");
    // Indexed text never marks single-char CJK content as a prefix.
    expect(bigramCJK("缓")).toEqual(["缓"]);
    expect(bigramCJK("缓", { prefixSingleChar: true })).toEqual(["缓*"]);
  });
});
