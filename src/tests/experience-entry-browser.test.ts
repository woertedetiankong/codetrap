import { expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "playwright-core";
import { launchBrowser, configureBrowserPage, browserTestTimeout } from "./browser-helper";
import { learningFixture } from "./web-learning-fixture";
import { trap } from "./helpers";
import { ObservationRunRecorder } from "../lib/observation-recorder";

async function screenshot(page: Page, name: string) {
  const output = process.env.CODETRAP_TEST_SCREENSHOTS;
  if (!output) return;
  mkdirSync(output, { recursive: true });
  await page.screenshot({ path: join(output, name + ".png") });
}

test("empty Review and Library share a correction draft while Learning stays independent, including mobile", async () => {
  const f = learningFixture(), server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: f.handler });
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    configureBrowserPage(page);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem("codetrap-queue-collapsed", "false");
      localStorage.setItem("codetrap-locale", "zh");
      Object.defineProperty(navigator, "clipboard", { value: { writeText: async (text: string) => { (window as any).copied = text; } } });
    });
    await page.goto(`http://127.0.0.1:${server.port}/?token=learning-token#/review?project=${f.a.ref}`);
    const correction = "修改 API 返回结构后，要同步更新客户端解析，并一起验证。";
    await page.locator("#review-memory-handoff textarea").first().fill(correction);
    expect(await page.locator("#review-memory-handoff select").count()).toBe(0);
    await page.locator("#review-memory-handoff button").click();
    await page.waitForFunction(() => Boolean((window as any).copied));
    const prompt = await page.evaluate(() => (window as any).copied);
    expect(prompt).toContain(correction);
    expect(prompt).toContain(f.a.root);
    expect(prompt).toContain("codetrap-capture");
    expect(prompt).not.toContain("ASCII");
    expect(f.a.traps.list()).toEqual([]);
    await page.locator('[data-main-view="library"]').click();
    const libraryDraft = page.locator("#library-memory-handoff textarea").first();
    await libraryDraft.waitFor();
    expect(await libraryDraft.inputValue()).toBe(correction);
    await screenshot(page, "empty-library-desktop");
    await page.locator('[data-main-view="learning"]').click();
    await page.locator(".ai-handoff-launch > summary").click();
    const learning = page.locator("#ai-handoff-catalog");
    expect(await learning.locator("select").nth(1).inputValue()).toBe("learning");
    expect(await learning.locator("textarea").first().inputValue()).toBe("");
    await learning.locator("textarea").first().fill("https://example.com/learning-source");
    await page.locator('[data-main-view="library"]').click();
    await libraryDraft.waitFor();
    expect(await libraryDraft.inputValue()).toBe(correction);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#library-start-experience").click();
    await libraryDraft.waitFor({ state: "visible" });
    expect(await libraryDraft.inputValue()).toBe(correction);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await screenshot(page, "empty-library-mobile");
    await page.locator('[data-main-view="review"]').click();
    await page.locator("#review-memory-handoff").waitFor({ state: "visible" });
    await page.locator("#reader-back").click();
    await page.locator("#review-start-experience").click();
    expect(await page.locator("#review-memory-handoff textarea").first().inputValue()).toBe(correction);
    expect(errors).toEqual([]);
  } finally { await browser.close(); server.stop(true); }
}, browserTestTimeout(30_000));

test("filtered empty Library offers recovery and details connect source, applicability and actual task evidence", async () => {
  const f = learningFixture();
  const { id } = f.a.traps.add(trap({ scope: "project", title: "同步更新 API 返回结构与客户端解析", module: "api", path_globs: ["src/api/**"],
    context: "修改 API 返回结构时，服务端和客户端需要一起检查。",
    mistake: "服务端返回对象，客户端仍按数组解析，导致页面报错。",
    fix: "同步更新客户端解析，并验证服务端响应和页面渲染。" }));
  f.a.traps.addEvidence(id, { source_type: "conversation", source_ref: "session:parser-correction", note: "The client expected an array but the response returned an object.", related_files: ["src/api/client.ts"] }, "project");
  const recorder = new ObservationRunRecorder(f.a.root);
  const context = { run_id: "parser-task", device_id: "test" };
  recorder.start({ ...context, source_client: "codex", source_session_ref: null, repository_revision: null, branch: null, model_provider: null, model_name: null, completeness: "complete" });
  recorder.search(context, { query: "API response", mode: "fts", path: null, module: "api", results: [{ trap_id: id, revision: `project:${f.a.traps.get(id, "project")!.trap.updated_at}`, rank: 1 }], diagnostics: [], duration_ms: 1 });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: f.handler }), browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    configureBrowserPage(page);
    await page.addInitScript(() => {
      localStorage.setItem("codetrap-queue-collapsed", "false");
      localStorage.setItem("codetrap-locale", "zh");
    });
    await page.goto(`http://127.0.0.1:${server.port}/?token=learning-token#/library?project=${f.a.ref}`);
    await page.locator("[data-trap-key]").first().waitFor();
    await page.locator("#trap-search").fill("unmatched-query");
    await page.locator("#library-clear-empty").waitFor();
    expect(await page.locator("#library-memory-handoff").count()).toBe(0);
    await page.locator("#library-clear-empty").click();
    await page.locator("#library-filters summary").click();
    await page.locator("#trap-filter-module").fill("missing-module");
    await page.locator("#trap-filter-module").press("Enter");
    await page.locator("#library-clear-empty").waitFor();
    expect(await page.locator("#library-memory-handoff").count()).toBe(0);
    await page.locator("#library-clear-empty").click();
    await page.locator("[data-trap-key]").first().click();
    await page.locator(".experience-evidence[open]").waitFor();
    expect(await page.locator(".experience-evidence").innerText()).toContain("session:parser-correction");
    expect(await page.locator(".experience-applicability[open]").innerText()).toContain("src/api/**");
    await page.locator('[data-experience-run="parser-task"]').waitFor();
    expect(await page.locator('[data-experience-run="parser-task"]').innerText()).toMatch(/Run checks: Unknown|任务验证：未知/);
    await screenshot(page, "experience-detail-desktop");
    await page.setViewportSize({ width: 390, height: 844 });
    // The responsive breakpoint rebuilds the reader; settle that render before scrolling.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.locator(".experience-evidence").scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await screenshot(page, "experience-evidence-mobile");
    await page.locator('[data-experience-run="parser-task"]').click();
    await page.waitForFunction(() => location.hash.includes("parser-task"));
  } finally { await browser.close(); server.stop(true); }
}, browserTestTimeout(30_000));
