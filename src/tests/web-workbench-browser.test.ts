import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { learningFixture } from "./web-learning-fixture";
import { ObservationRunRecorder } from "../lib/observation-recorder";

const chrome = [process.env.CODETRAP_TEST_BROWSER, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/chromium", "/usr/bin/google-chrome"].find(path => path && existsSync(path));
const browserTest = chrome ? test : test.skip;
async function launch() { const { chromium } = await import("playwright-core"); return chromium.launch({ executablePath: chrome!, headless: true }); }

browserTest("search settings recover from a failed load and preserve unsaved provider fields after a failed save", async () => {
  const fixture = learningFixture();
  let failRead = true, writes = 0, release = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async request => {
    const path = new URL(request.url).pathname;
    if (path === "/api/embeddings" && failRead) return Response.json({ error: "Fixture unavailable" }, { status: 503 });
    if (path === "/api/embeddings/use") {
      writes++; await pending;
      return Response.json({ error: "Fixture save failed" }, { status: 503 });
    }
    return fixture.handler(request);
  } });
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); page.setDefaultTimeout(5000);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.port}/?token=learning-token#/embeddings`);
    await page.locator("#detail [data-embedding-retry]").waitFor();
    expect(await page.locator("#embedding-form").count()).toBe(0);
    failRead = false;
    await page.locator("#detail [data-embedding-retry]").click();
    await page.locator('[data-embedding-provider="ollama"]').click();
    await page.locator("#embedding-model").fill("a-model-name-that-must-survive-provider-switching");
    await page.locator('[data-embedding-provider="jina"]').click();
    await page.locator('[data-embedding-provider="ollama"]').click();
    expect(await page.locator("#embedding-model").inputValue()).toBe("a-model-name-that-must-survive-provider-switching");
    expect(await page.locator('[data-embedding-provider="ollama"]').getAttribute("aria-pressed")).toBe("true");
    await page.locator('#embedding-form [type="submit"]').click();
    expect(await page.locator('#embedding-form [type="submit"]').isDisabled()).toBe(true);
    expect(await page.locator("#embedding-reindex-project").isDisabled()).toBe(true);
    release();
    await page.locator("#status.error").waitFor();
    expect(await page.locator("#embedding-model").inputValue()).toBe("a-model-name-that-must-survive-provider-switching");
    expect(writes).toBe(1);
    expect(errors).toEqual([]);
  } finally { release(); await browser.close(); server.stop(true); }
}, 20000);

browserTest("Learning distinguishes filtered results from an empty library and keeps filters usable after resizing", async () => {
  const fixture = learningFixture(), server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: fixture.handler }), browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1487, height: 900 } }); page.setDefaultTimeout(5000);
    await page.goto(`http://127.0.0.1:${server.port}/?token=learning-token#/learning`);
    await page.locator("#learning-search").waitFor();
    expect(await page.locator("#learning-filters").getAttribute("open")).toBeNull();
    await page.locator("#learning-search").fill("definitely-no-matching-lesson");
    expect(await page.locator("#detail").textContent()).toContain("No notes match these filters");
    expect(await page.locator("#copy-learning-prompt").count()).toBe(0);
    await page.locator("#learning-filters summary").click();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.locator("#clear-learning-filters").isVisible()).toBe(true);
    await page.locator("#clear-learning-filters").click();
    await page.locator("[data-learning-insight]").first().click();
    await page.locator(".learning-title").waitFor();
    expect(await page.locator(".learning-title").evaluate(node => node.tagName)).toBe("H1");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await browser.close(); server.stop(true); }
}, 15000);

browserTest("Impact tabs work by keyboard and all remaining destinations fit narrow and wide viewports", async () => {
  const fixture = learningFixture();
  const recorder = new ObservationRunRecorder(fixture.a.root);
  for (const id of ["first", "second"]) {
    const context = { run_id: id, device_id: "workbench", source_ref: "workbench" };
    recorder.start({ ...context, event_id: id + "-start", source_client: "codex", source_session_ref: null, repository_revision: null, branch: null, model_provider: null, model_name: null, completeness: "complete" });
    recorder.complete({ ...context, event_id: id + "-end", status: "completed", completeness: "complete", duration_ms: 100, input_tokens: 0, output_tokens: 0 });
  }
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: fixture.handler }), browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); page.setDefaultTimeout(5000);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.port}/?token=learning-token#/impact/overview`);
    const overview = page.locator('.impact-tabs [data-impact-tab="overview"]');
    await overview.focus(); await overview.press("ArrowRight");
    expect(await page.locator('.impact-tabs [data-impact-tab="runs"]').evaluate(node => node === document.activeElement)).toBe(true);
    await page.keyboard.press("Enter");
    await page.locator("[data-impact-run-select]").waitFor();
    await page.locator("[data-impact-run-select]").selectOption("first");
    await page.waitForURL(/runs\/first/);
    expect(await page.locator(".rail").isVisible()).toBe(false);
    for (const width of [320, 390, 768, 1024, 1280, 1487]) {
      await page.setViewportSize({ width, height: 900 });
      for (const view of ["learning", "embeddings", "impact"]) {
        await page.locator(`[data-main-view="${view}"]`).click();
        if (view === "embeddings") await page.locator("#embedding-form").waitFor();
        else if (view === "learning") await page.locator("#learning-search").waitFor();
        else await page.locator(".impact-tabs").waitFor();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${view} at ${width}px`).toBe(true);
        expect(await page.locator(".app-topbar").evaluate(node => node.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
      }
    }
    expect(errors).toEqual([]);
  } finally { await browser.close(); server.stop(true); }
}, 30000);
