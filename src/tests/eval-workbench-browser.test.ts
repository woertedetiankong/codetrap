import { test, expect } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { browserTestTimeout, chromeExecutablePath, configureBrowserPage, launchBrowser } from "./browser-helper";
import { webSuiteFixture } from "./project-eval-suite-fixture";
import { ControlledEvalOperations } from "../lib/controlled-eval";
import { webProjectRouteRef } from "../web/project-registry";
import { createWebHandler } from "../web/server";
import { revisionFixture } from "./experience-revision-fixture";
const browserTest = chromeExecutablePath() ? test : test.skip;

browserTest("result-first comparison supports filters, frozen top-five detail, keyboard return and narrow Chinese layout", async () => {
  const f = webSuiteFixture();
  mkdirSync(join(f.project, ".codetrap/evals"), { recursive: true });
  writeFileSync(join(f.project, ".codetrap/evals/suite.json"), readFileSync(new URL("./fixtures/search-eval.json", import.meta.url)));
  const ops = new ControlledEvalOperations(f.project);
  const policy = await ops.run({ profile: "retrieval_policy_v1", trials: 2, seed: "browser" });
  const memory = await ops.run({ profile: "memory_contribution_v1", trials: 2, seed: "browser" });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: f.handler }), browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    configureBrowserPage(page); const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.port}/?token=suite-token#/impact/evals?project=${webProjectRouteRef(f.project)}`);
    await page.locator('[data-ia="verify-tab"][data-tab="retrieval"]').click();
    await page.locator(".bench-case-table").waitFor();
    expect(await page.locator(".rail").isVisible()).toBe(false);
    expect(await page.locator(".bench-case-table").evaluate(node => node.getBoundingClientRect().top < window.innerHeight - 60)).toBe(true);
    expect(await page.locator(".ia-new-check > summary").evaluate(node => node.getBoundingClientRect().top < 600)).toBe(true);
    expect(await page.locator('[data-eval-disclosure="suite"]').getAttribute("open")).toBeNull();
    const item = memory.cases.find(item => item.candidate.top_results.length > 1)!;
    const rowButton = page.locator(`[data-controlled-case-id="${item.id}"]`);
    await rowButton.click();
    const dialog = page.locator(".bench-case-dialog");
    await dialog.waitFor();
    expect(await dialog.locator("h2").textContent()).toBe(item.query);
    expect(await dialog.locator(".bench-detail-pair > section").nth(1).locator("li").count()).toBe(item.candidate.top_results.length);
    expect(await dialog.textContent()).toContain("frozen experiment snapshot");
    await page.keyboard.press("Escape"); await dialog.waitFor({ state: "detached" }); expect(await dialog.count()).toBe(0);
    expect(await rowButton.evaluate(node => document.activeElement === node)).toBe(true);
    await page.locator('[data-controlled-case-filter="regressed"]').click();
    expect(await page.locator("[data-controlled-case-id]").count()).toBe(0);
    await page.locator('[data-controlled-case-filter="all"]').click();
    expect(await page.locator("[data-controlled-case-id]").count()).toBe(24);
    await page.locator("[data-controlled-history]").selectOption(policy.id);
    expect(await page.locator("[data-controlled-case-id]").count()).toBe(policy.cases.filter(item => item.classification !== "unchanged_pass").length);
    await page.locator('[data-ia="locale"]').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("[data-controlled-case-id]").first().click();
    expect(await dialog.textContent()).toContain("预期内容来自该实验的冻结快照");
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    const before = await dialog.locator("h2").textContent(); await dialog.locator("[data-case-next]").click();
    expect(await dialog.locator("h2").textContent()).not.toBe(before);
    await dialog.locator("[data-case-close]").click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.locator('[data-ia="menu"]').click();
    await page.locator('.ia-sheet [data-ia="workspace"]').click();
    expect(await page.locator(".shell").evaluate(node => node.classList.contains("impact-evals-mode"))).toBe(false);
    expect(errors).toEqual([]);
  } finally { await browser.close(); server.stop(true); }
}, browserTestTimeout(25000));

browserTest("Overview next action opens the exposed task and leaves feedback to the user", async () => {
  const f = revisionFixture(); let writes = 0;
  const handler = createWebHandler({ token: "revision-test-token", cwd: f.project, currentProjectRoot: f.project, home: f.home });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: req => { if (req.method === "POST") writes++; return handler(req); } }), browser = await launchBrowser();
  try {
    const page = await browser.newPage(); configureBrowserPage(page);
    await page.goto(`http://127.0.0.1:${server.port}/?token=revision-test-token#/impact/overview?project=${webProjectRouteRef(f.project)}`);
    await page.locator(`.ia-attention [data-ia="run"][data-id="${f.call.run_id}"]`).click();
    await page.locator('[data-ia="feedback"][data-feedback="helpful"]').waitFor();
    expect(await page.locator(".ia-lesson").textContent()).toContain("Animation timing");
    expect(writes).toBe(0);
  } finally { await browser.close(); server.stop(true); }
}, browserTestTimeout(15000));
