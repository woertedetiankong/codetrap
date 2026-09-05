import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildTrapInput } from "../domain/trap";
import { LearningImpactOperations } from "../lib/learning-impact";
import { SessionOperations } from "../lib/session-operations";
import { SessionStore } from "../lib/session-store";
import { ObservationRunRecorder } from "../lib/observation-recorder";
import { configureObservationIntegration } from "../lib/observation-integration";
import { observationLedgerPath } from "../lib/observation-ledger";
import { TrapOperations } from "../lib/trap-operations";
import { TrapStore } from "../lib/store";
import { parseWorkspaceRoute } from "../web/client-route";
import { addWebProject, webProjectRouteRef } from "../web/project-registry";
import { createWebHandler } from "../web/server";
import { runCliAsync, tempHome, tempProjectDir } from "./helpers";

const TOKEN = "browser-smoke-token";

describe("web command", () => {
  test("web --help prints usage without starting the server", async () => {
    const cwd = tempProjectDir("codetrap-web-help-", { realpath: true });
    const home = tempHome("codetrap-web-browser-home-", { realpath: true, initCodetrap: true });
    const direct = await runCliAsync(["web", "--help"], cwd, home);
    expect(direct.exitCode).toBe(0);
    expect(direct.stdout).toContain("Usage:");
    expect(direct.stdout).toContain("codetrap web [--project <path>]");
    expect(direct.stdout).toContain("--project <path>");
    expect(direct.stdout).not.toContain("listening on");
    expect(direct.stderr).toBe("");

    const afterOption = await runCliAsync(["web", "--project", cwd, "--help"], cwd, home);
    expect(afterOption.exitCode).toBe(0);
    expect(afterOption.stdout).toContain("Usage:");
    expect(afterOption.stdout).not.toContain("listening on");
  });
});

const chromePath = chromeExecutablePath();
const browserTest = chromePath ? test : test.skip;

describe("web browser smoke", () => {
  browserTest("keeps missing project and item links explicit on mobile and recovers through project selection", async () => {
    const { chromium } = await import("playwright-core");
    const home = tempHome("codetrap-route-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-route-missing-", { realpath: true });
    addWebProject(project, home);
    seedBrowserSmokeData(project, home);
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project }) });
    const browser = await chromium.launch({ executablePath: chromePath!, headless: true, args: ["--no-sandbox"] });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      page.setDefaultTimeout(5_000);
      const root = `http://127.0.0.1:${server.port}/?token=${TOKEN}`;
      const ref = webProjectRouteRef(project);
      for (const hash of [`#/library/project/999?project=${ref}`, `#/learning/${ref}/missing?project=${ref}`]) {
        await page.goto(root + hash);
        await page.locator("#detail .route-unavailable").waitFor();
        expect(new URL(page.url()).hash).toBe(hash);
        expect(await page.locator(".rail").isVisible()).toBe(false);
        expect(await page.locator("#detail").textContent()).not.toContain("Browser smoke confirmed trap");
        await page.reload();
        await page.locator("#detail .route-unavailable").waitFor();
        expect(new URL(page.url()).hash).toBe(hash);
      }
      await page.goto(root + "#/library/project/1?project=p-" + "0".repeat(24));
      await page.locator("#route-choose-project").click();
      await page.locator("[data-project]").click();
      await page.locator("[data-trap-key='project:1']").waitFor();
      expect(parseWorkspaceRoute(new URL(page.url()).hash)).toMatchObject({ projectRef: ref, trapId: null });
      await page.getByRole("button", { name: "Learning", exact: true }).click();
      await page.locator("[data-learning-insight]").first().waitFor();
      expect(await page.locator("#learning-filters").getAttribute("open")).toBeNull();
      await page.locator("#learning-filters summary").click();
      expect(await page.locator("#learning-status-filter").isVisible()).toBe(true);
      await page.locator("[data-learning-insight]").first().click();
      await page.locator("#learning-practice-note").fill("unsaved phone practice");
      // Focus scroll and async detail hydration must settle before sampling.
      await page.locator("#learning-practice-note").scrollIntoViewIfNeeded();
      const readingPosition = await page.evaluate(async () => {
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        return document.querySelector("#detail > .scroll")!.scrollTop;
      });
      await page.locator("#reader-back").click();
      expect(await page.locator(".detail").isVisible()).toBe(false);
      await page.goBack();
      await page.locator("#learning-practice-note").waitFor();
      await page.waitForFunction((position) => Math.abs((document.querySelector("#detail > .scroll")?.scrollTop || 0) - position) < 2, readingPosition);
      expect(await page.locator("#learning-practice-note").inputValue()).toBe("unsaved phone practice");
      await page.goForward();
      await page.locator("[data-learning-insight]").first().waitFor();
      await page.locator("[data-learning-insight]").first().click();
      expect(await page.locator("#learning-practice-note").inputValue()).toBe("unsaved phone practice");
      const height = await page.locator("#detail > .scroll").evaluate((node) => node.clientHeight);
      expect(height).toBeGreaterThan(450);
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(845);
    } finally { await browser.close(); server.stop(true); }
  }, 20_000);

  browserTest("loads the review console and renders live project data", async () => {
    const { chromium } = await import("playwright-core");
    const home = tempHome("codetrap-web-browser-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-web-browser-", { realpath: true });
    addWebProject(project, home);
    seedBrowserSmokeData(project, home);

    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: createWebHandler({
        token: TOKEN,
        cwd: project,
        home,
        currentProjectRoot: project,
      }),
    });
    const browser = await chromium.launch({
      executablePath: chromePath!,
      headless: true,
      args: ["--no-sandbox"],
    });
    const errors: string[] = [];

    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));

      await page.goto(`http://127.0.0.1:${server.port}/?token=${TOKEN}`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForSelector("text=Browser smoke candidate");
      await page.locator('#title').fill('Unsaved review after browser migration');
      await page.route('**/api/sessions?*', async route => {
        const response = await route.fetch();
        const data = await response.json();
        data.sessions[0].pending_count += 1;
        await route.fulfill({ response, json: data });
      });
      await page.getByText('External changes detected; your unsaved draft was preserved', { exact: true }).waitFor({ timeout: 8000 });
      expect(await page.locator('#title').inputValue()).toBe('Unsaved review after browser migration');
      await page.unroute('**/api/sessions?*');
      // Navigation lives in the topbar now, so it stays on one row at every
      // desktop width instead of wrapping once the rail gets narrow.
      await expectTopbarNavigationLayout(page);
      await page.setViewportSize({ width: 1920, height: 800 });
      await expectTopbarNavigationLayout(page);
      await page.setViewportSize({ width: 1440, height: 800 });
      await expectTopbarNavigationLayout(page);
      await expectText(page.locator("#review-summary"), "1 pending");

      await page.getByRole("button", { name: "Library" }).click();
      await page.waitForSelector("text=Browser smoke confirmed trap");
      await expectTextContent(page.locator('[data-trap-health="needs-validation"]'), "Needs validation");

      await page.getByRole("button", { name: "Learning" }).click();
      await page.waitForSelector("text=Browser smoke learning insight");
      await expectText(page.locator(".collection-title-line"), "Browser smoke study set");
      await expectText(page.locator(".collection-header"), "0 of 2 learned");
      await expectText(page.locator(".collection-audit-status"), "source not audited");
      await page.getByRole("button", { name: "Collapse Browser smoke study set" }).click();
      expect(await page.locator(".collection-chapters").isHidden()).toBe(true);
      await page.getByRole("button", { name: "Expand Browser smoke study set" }).click();
      expect(await page.locator(".collection-chapters").isVisible()).toBe(true);
      await page.getByRole("button", { name: /Browser smoke learning insight/ }).click();
      await expectTextContent(page.locator("#detail"), "Learning status");
      // The learning state lives on the detail status control, not the queue.
      // A freshly shelved insight may carry no progress row at all, so assert the
      // transition rather than a default selection.
      expect(await page.locator('.learning-status-control button[data-learning-status="learned"].active').count()).toBe(0);
      await expectText(page.locator(".source-coverage-panel"), "legacy collection");
      await expectText(page.locator(".source-coverage-panel"), "cannot verify whether anything was omitted");
      await expectText(page.locator(".learning-breadcrumb"), "1 / 2");
      await expectText(page.locator("pre.learning-code"), "[source] -> [agent] -> [insight]");
      expect(await page.locator("a.source-link").getAttribute("href")).toBe("https://example.com/learning-source");
      // Recording "learned" is the status control itself; there is no separate
      // confirm button, so the click and its effect are asserted on that control.
      const learnedButton = page.locator('.learning-status-control button[data-learning-status="learned"]');
      await learnedButton.click();
      await page.locator('.learning-status-control button[data-learning-status="learned"].active').waitFor();
      await expectText(page.locator(".learning-status-control button.active"), "Learned");
      expect(await learnedButton.getAttribute("class")).toContain("active");
      await expectText(page.locator(".collection-header"), "1 of 2 learned");

      await page.getByRole("button", { name: "Impact" }).click();
      await page.waitForSelector(".impact-hero");
      await expectText(page.locator(".impact-hero"), "See where your experience helps.");
      await expectText(page.locator(".overview-metrics"), "1 / 2");
      expect(await page.locator(".rail").isHidden()).toBe(true);
      await page.locator('[data-overview-run="run-browser-smoke"]').click();
      await page.waitForSelector(".impact-timeline");
      expect(await page.locator(".rail").isVisible()).toBe(true);
      await page.locator(".impact-event.cat-expose").nth(1).locator("summary").click();
      await page.locator('.impact-event.cat-expose [data-impact-trap="1"][data-trap-scope="global"]').click();
      await page.waitForSelector("text=Browser smoke global trap");
      expect(new URL(page.url()).hash).toContain("library");
      await page.getByRole("button", { name: "Impact", exact: true }).click();
      await page.getByRole("tab", { name: "Evals" }).click();
      await page.waitForSelector(".evals-hero");
      await expectText(page.locator(".evals-hero"), "Is your experience helping?");
      await expectText(page.locator(".eval-rate-grid"), "50%");
      expect(new URL(page.url()).hash).toBe("#/impact/evals?project=" + webProjectRouteRef(project));
      expect(await page.title()).toBe("codetrap · Evals");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector(".evals-hero");
      await expectText(page.locator(".evals-hero"), "Is your experience helping?");
      await page.getByRole("tab", { name: "Runs" }).click();
      await page.locator("[data-observation-run='run-browser-smoke']").click();
      await page.waitForSelector(".impact-timeline");
      expect(new URL(page.url()).hash).toBe("#/impact/runs/run-browser-smoke?project=" + webProjectRouteRef(project));
      expect(await page.locator(".impact-event").count()).toBe(9);
      await expectText(page.locator("#detail"), "Trap search completed");
      expect((await page.locator("#detail").textContent()) || "").not.toContain("BROWSER_RAW_SECRET");

      await page.setViewportSize({ width: 500, height: 900 });
      const impactColumns = await page.locator(".impact-run-meta").evaluate((node) =>
        getComputedStyle(node).gridTemplateColumns.split(" ").filter(Boolean).length
      );
      expect(impactColumns).toBe(2);

      expect(errors).toEqual([]);
    } finally {
      await browser.close();
      server.stop(true);
    }
  }, 20_000);

  browserTest("keeps practice drafts and follows accepted experience across project boundaries", async () => {
    const { chromium } = await import("playwright-core");
    const home = tempHome("codetrap-experience-browser-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-experience-browser-", { realpath: true });
    const source = tempProjectDir("codetrap-experience-source-", { realpath: true });
    for (const root of [project, source]) { addWebProject(root, home); seedBrowserSmokeData(root, home); }
    const learning = new LearningImpactOperations(source, new SessionOperations(new SessionStore(source), new TrapOperations(new TrapStore(source, undefined, home))));
    const promoted = learning.createCandidate("ins-browser-smoke", learning.preview("ins-browser-smoke").draft);
    new SessionStore(source).acceptCandidate(promoted.candidate.id, { sessionId: promoted.session_id, trapId: 1, scope: "global", evidenceId: null });
    learning.linkRun("ins-browser-smoke", "run-browser-smoke");
    // Exercise the bundled inline script: function names may differ from source execution.
    const bundle = await Bun.build({ entrypoints: [fileURLToPath(new URL("../web/static.ts", import.meta.url))], target: "bun", format: "esm" });
    expect(bundle.success).toBe(true);
    const bundlePath = join(home, "bundled-web.mjs");
    await Bun.write(bundlePath, bundle.outputs[0]!);
    const bundled = await import(pathToFileURL(bundlePath).href);
    const handler = createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project });
    let releaseSave: (() => void) | undefined;
    let saveArrived: (() => void) | undefined;
    const arrived = new Promise<void>((resolve) => { saveArrived = resolve; });
    let delaySave = false;
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (request) => {
      if (delaySave && new URL(request.url).pathname === "/api/learning/practice-note") {
        await new Promise<void>((resolve) => { releaseSave = resolve; saveArrived?.(); });
        delaySave = false;
      }
      if (new URL(request.url).pathname === "/") return new Response(bundled.WEB_INDEX_HTML, { headers: { "content-type": "text/html" } });
      return handler(request);
    } });
    const browser = await chromium.launch({ executablePath: chromePath!, headless: true, args: ["--no-sandbox"] });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      page.setDefaultTimeout(5000);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.port}/?token=${TOKEN}#/learning`);
      const insightSelector = '[data-learning-insight="' + source + '::ins-browser-smoke"]';
      await page.locator(insightSelector).click();
      await page.locator("#open-learning-confirmed-trap").waitFor();
      await page.locator("#learning-practice-note").fill("PRIVATE practice: inspect the result");
      await page.locator("#next-learning").click();
      await page.locator("#previous-learning").click();
      expect(await page.locator("#learning-practice-note").inputValue()).toBe("PRIVATE practice: inspect the result");
      // Do not discard newer typing when an earlier save finishes.
      delaySave = true;
      await page.locator("#save-learning-practice").click();
      await arrived;
      await page.locator("#learning-practice-note").fill("PRIVATE newer draft");
      releaseSave!();
      await page.locator("#save-learning-practice:not([disabled])").waitFor();
      expect(await page.locator("#learning-practice-note").inputValue()).toBe("PRIVATE newer draft");
      await expectTextContent(page.locator("#learning-practice-state"), "Unsaved changes");
      await page.locator("#save-learning-practice").click();
      await page.locator("#save-learning-practice:not([disabled])").waitFor();
      const learningLocation = page.url();
      expect(parseWorkspaceRoute(new URL(learningLocation).hash)).toMatchObject({ projectRef: webProjectRouteRef(project), insightProjectRef: webProjectRouteRef(source), insightId: "ins-browser-smoke" });
      expect(learningLocation).not.toContain(encodeURIComponent(source));
      await page.reload();
      await page.locator("#learning-practice-note").waitFor();
      expect(await page.locator("#learning-practice-note").inputValue()).toBe("PRIVATE newer draft");
      await page.locator("#open-learning-confirmed-trap").click();
      await page.locator(".experience-path").waitFor();
      expect(parseWorkspaceRoute(new URL(page.url()).hash)).toMatchObject({ projectRef: webProjectRouteRef(source), trapScope: "global", trapId: 1 });
      await page.reload();
      await page.locator(".experience-path").waitFor();
      await expectTextContent(page.locator("#detail"), "Browser smoke global trap");
      await page.goBack();
      await page.locator("#learning-practice-note").waitFor();
      expect(await page.locator("#learning-practice-note").inputValue()).toBe("PRIVATE newer draft");
      expect(page.url()).toBe(learningLocation);
      await page.goForward();
      await page.locator(".experience-path").waitFor();
      await expectTextContent(page.locator(".experience-facts"), "0 helpful · 0 irrelevant · 1 harmful");
      expect(await page.locator("[data-experience-insight]").count()).toBe(1);
      expect(await page.locator("#trap-experience-panel").textContent()).not.toContain("PRIVATE");
      expect(await page.locator(".experience-path li").count()).toBe(4);
      // An evidence outage must not hide the confirmed lesson or strand retry.
      await page.route("**/api/trap/experience?*", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "test outage" }) }));
      await page.locator("[data-experience-retry]").click();
      await page.getByText("Could not load the experience path. Your lesson is still available.").waitFor();
      await expectTextContent(page.locator("#detail"), "Browser smoke global trap");
      await page.unroute("**/api/trap/experience?*");
      await page.locator("[data-experience-retry]").click();
      await page.locator(".experience-path").waitFor();
      // A slow project-trap response cannot replace a subsequently selected global trap.
      await page.locator("#trap-filter-scope").selectOption("");
      await page.locator('[data-trap-key="project:1"]').waitFor();
      await page.locator('[data-trap-key="global:1"]').click();
      await page.locator(".experience-facts").filter({ hasText: "0 helpful · 0 irrelevant · 1 harmful" }).waitFor();
      let releaseEvidence!: () => void;
      let evidenceArrived!: () => void;
      const pendingEvidence = new Promise<void>((resolve) => { evidenceArrived = resolve; });
      await page.route("**/api/trap/experience?*", async (route) => {
        if (new URL(route.request().url()).searchParams.get("scope") === "project") {
          await new Promise<void>((resolve) => { releaseEvidence = resolve; evidenceArrived(); });
        }
        await route.continue();
      });
      await page.locator('[data-trap-key="project:1"]').click();
      await Promise.race([pendingEvidence, new Promise((_, reject) => setTimeout(() => reject(new Error("delayed experience request did not arrive")), 5000))]);
      await page.locator('[data-trap-key="global:1"]').click();
      await page.locator(".experience-path").waitFor();
      const delayed = page.waitForResponse((response) => response.url().includes("/api/trap/experience?") && new URL(response.url()).searchParams.get("scope") === "project");
      releaseEvidence();
      await delayed;
      await expectTextContent(page.locator(".experience-facts"), "0 helpful · 0 irrelevant · 1 harmful");
      await page.unroute("**/api/trap/experience?*");
      // The old global detail has the same rating text. Wait for evidence from
      // this filter refresh so the assertion cannot succeed against stale DOM.
      const filteredEvidence = page.waitForResponse(response => response.url().includes("/api/trap/experience?")
        && new URL(response.url()).searchParams.get("scope") === "global"
        && new URL(response.url()).searchParams.get("project") === source);
      await page.locator("#trap-filter-scope").selectOption("global");
      await filteredEvidence;
      try { await page.locator(".experience-facts").filter({ hasText: "0 helpful · 0 irrelevant · 1 harmful" }).waitFor(); }
      catch (error) { console.log(JSON.stringify({ url: page.url(), body: (await page.locator("#detail").textContent())?.slice(0, 1800), errors })); throw error; }

      try { await page.locator('[data-experience-run="run-browser-smoke"]').click(); }
      catch (error) { console.log(JSON.stringify({ url: page.url(), body: (await page.locator("#detail").textContent())?.slice(0, 2400), errors })); throw error; }
      await page.locator(".impact-timeline").waitFor();
      expect(new URL(page.url()).hash).toBe("#/impact/runs/run-browser-smoke?project=" + webProjectRouteRef(source));
      await page.getByRole("button", { name: "Library", exact: true }).click();
      await page.locator(".experience-path").waitFor();
      await page.locator('[data-experience-insight="ins-browser-smoke"]').click();
      await page.locator("#learning-practice-note").waitFor();
      expect(await page.locator("#learning-practice-note").inputValue()).toBe("PRIVATE newer draft");
      await page.locator("#open-learning-linked-run").click();
      await page.locator(".impact-timeline").waitFor();
      await page.getByRole("button", { name: "Library", exact: true }).click();
      await page.locator(".experience-path").waitFor();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('[data-trap-key="global:1"]').click();
      await page.locator("#reader-back").waitFor();
      expect(await page.locator(".rail").isVisible()).toBe(false);
      await page.locator("#reader-back").click();
      expect(await page.locator(".rail").isVisible()).toBe(true);
      expect(await page.locator(".detail").isVisible()).toBe(false);
      expect(await page.locator("#library-filters").getAttribute("open")).toBeNull();
      await page.locator("#library-filters summary").click();
      expect(await page.locator("#trap-filter-category").isVisible()).toBe(true);
      await page.locator("#library-filters summary").click();
      await page.locator('[data-trap-key="global:1"]').click();
      await page.reload();
      await page.locator(".experience-path").waitFor();
      expect(await page.locator(".rail").isVisible()).toBe(false);

      await page.getByRole("button", { name: "中文", exact: true }).click();
      await page.locator(".experience-path").waitFor();
      expect(await page.locator(".experience-path").evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length)).toBe(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
      expect(await page.locator("#trap-experience-panel").textContent()).not.toContain("experience.");
      expect(errors).toEqual([]);
    } finally { releaseSave?.(); await browser.close(); server.stop(true); }
  }, 30_000);

  browserTest("empty Impact explains setup, keeps its demo disposable, and fits a phone", async () => {
    const { chromium } = await import("playwright-core");
    const home = tempHome("codetrap-overview-home-", { realpath: true, initCodetrap: true });
    const project = tempProjectDir("codetrap-overview-empty-", { realpath: true });
    addWebProject(project, home);
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0,
      fetch: createWebHandler({ token: TOKEN, cwd: project, home, currentProjectRoot: project }) });
    const browser = await chromium.launch({ executablePath: chromePath!, headless: true, args: ["--no-sandbox"] });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      page.setDefaultTimeout(5_000);
      await page.goto(`http://127.0.0.1:${server.port}/?token=${TOKEN}#/impact/overview`);
      await page.waitForSelector(".overview-welcome");
      expect(await page.locator(".rail").isHidden()).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
      for (const language of ["EN", "中文"]) {
        await page.getByRole("button", { name: language, exact: true }).click();
        const navigation = await page.locator(".app-topbar").evaluate((node) => {
          const buttons = [...node.querySelectorAll("button")];
          return buttons.map((button) => ({
            text: button.textContent,
            left: button.getBoundingClientRect().left,
            right: button.getBoundingClientRect().right,
            height: button.getBoundingClientRect().height,
            clipped: button.scrollWidth > button.clientWidth + 1,
          }));
        });
        expect(navigation).toHaveLength(9);
        expect(navigation.filter((item) => item.left < 0 || item.right > 390 || item.height > 48 || item.clipped)).toEqual([]);
      }
      await page.locator("[data-impact-guide]").click();
      await page.waitForSelector(".impact-connection-guide");
      await expectTextContent(page.locator(".impact-connection-guide"), "codetrap observe enable codex");
      await page.locator("[data-impact-demo-preview]").click();
      await page.waitForSelector(".impact-timeline");
      expect(await page.locator(".impact-event").count()).toBe(5);
      expect(existsSync(join(project, ".codetrap", "observations", "ledger.sqlite"))).toBe(false);
      await page.locator("[data-impact-demo-exit]").click();
      await page.locator('[data-connection-state="not_configured"]').waitFor();
      configureObservationIntegration(project, "codex", "enable", true);
      await page.reload();
      await page.locator('[data-connection-state="awaiting_run"]').waitFor();
      expect(existsSync(observationLedgerPath(project))).toBe(false);
      const ledger = observationLedgerPath(project);
      mkdirSync(join(project, ".codetrap", "observations"), { recursive: true });
      writeFileSync(ledger, "broken ledger");
      await page.reload();
      await page.locator('[data-connection-state="unavailable"]').waitFor();
      expect(await page.locator(".overview-welcome").count()).toBe(0);
      expect(await page.locator("[data-impact-retry]").isVisible()).toBe(true);
    } finally { await browser.close(); server.stop(true); }
  }, 20_000);

});

/**
 * The topbar must present every view on one row with its label intact. The
 * previous rail-hosted header wrapped to a second row and hard-clipped the
 * longest label, so assert against both failure modes directly.
 */
async function expectTopbarNavigationLayout(
  page: { evaluate: <T>(fn: () => T) => Promise<T> }
): Promise<void> {
  const layout = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll(".app-topbar .main-nav button")] as HTMLElement[];
    const topbar = document.querySelector(".app-topbar")!.getBoundingClientRect();
    const panes = document.querySelector(".rail")!.getBoundingClientRect();
    return {
      count: buttons.length,
      rows: new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().y))).size,
      clipped: buttons
        .filter((button) => button.scrollWidth > button.clientWidth + 1)
        .map((button) => button.textContent),
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      topbarBottom: topbar.bottom,
      railTop: panes.top,
    };
  });

  expect(layout.count).toBe(5);
  expect(layout.rows).toBe(1);
  expect(layout.clipped).toEqual([]);
  expect(layout.documentOverflow).toBeLessThanOrEqual(0);
  expect(layout.topbarBottom).toBeLessThanOrEqual(layout.railTop + 1);
}

/**
 * Compare rendered text case-insensitively: innerText reflects CSS
 * text-transform, so an uppercased label would otherwise fail against the
 * source string it is rendered from.
 */
async function expectText(locator: { innerText: () => Promise<string> }, expected: string): Promise<void> {
  expect((await locator.innerText()).toLowerCase()).toContain(expected.toLowerCase());
}

async function expectTextContent(locator: { textContent: () => Promise<string | null> }, expected: string): Promise<void> {
  expect(await locator.textContent()).toContain(expected);
}

function seedBrowserSmokeData(project: string, home: string): void {
  const traps = new TrapOperations(new TrapStore(project, undefined, home));
  traps.addTrap({ ...buildTrapInput({
    title: "Browser smoke confirmed trap",
    category: "api",
    scope: "project",
    context: "When verifying the web console in a browser.",
    mistake: "Only testing HTTP handlers can miss browser-side regressions.",
    fix: "Open the console in a browser and verify visible content.",
    tags: ["web", "smoke"],
    severity: "warning",
    module: "web",
    path_globs: ["src/web/**"],
  }) });

  traps.addTrap({ ...buildTrapInput({
    title: "Browser smoke global trap", category: "api", scope: "global",
    context: "Global browser lesson.", mistake: "Guessing a scope opens the wrong lesson.",
    fix: "Use the observed scope.", tags: ["web"], severity: "warning",
  }) });

  const sessions = new SessionOperations(new SessionStore(project), traps);
  const session = sessions.startSession({
    goal: "browser smoke review",
    module: "web",
    owner: "local",
  });
  sessions.addNote({
    kind: "review",
    text: [
      "Title: Browser smoke candidate",
      "Category: api",
      "Context: When reviewing candidate traps in the web console.",
      "Mistake: Shipping the console without a browser-level smoke check can miss blank pages.",
      "Fix: Keep a small browser smoke test for the review inbox and library view.",
      "Severity: warning",
      "Tags: web, smoke",
      "Path globs: src/web/**",
    ].join("\n"),
  });
  sessions.closeSession(session.id, true);

  const insightDir = join(project, ".codetrap", "phase2");
  mkdirSync(insightDir, { recursive: true });
  writeFileSync(join(insightDir, "insights.json"), `${JSON.stringify({
    version: 2,
    insights: [{
      id: "ins-browser-smoke",
      title: "Browser smoke learning insight",
      summary: "This note is intentionally kept out of trap retrieval.",
      body: "```text\n[source] -> [agent] -> [insight]\n```\n\nExample: review the note before shelving it.",
      tags: ["learning", "smoke"],
      source_refs: ["https://example.com/learning-source"],
      shelved_at: "2026-08-09T12:00:00.000Z",
      consulted_count: 0,
      last_consulted_at: null,
      source_type: "article",
      topics: ["Web testing"],
    }, {
      id: "ins-browser-smoke-next",
      title: "Browser smoke next chapter",
      summary: "The second ordered note proves collection navigation.",
      body: "Second chapter body.",
      tags: ["learning", "smoke"],
      source_refs: ["https://example.com/learning-source"],
      shelved_at: "2026-08-09T12:01:00.000Z",
      consulted_count: 0,
      last_consulted_at: null,
      source_type: "article",
      topics: ["Web testing"],
    }],
    collections: [{
      id: "col-browser-smoke",
      title: "Browser smoke study set",
      summary: "A browser-level ordered collection.",
      source_type: "article",
      source_refs: ["https://example.com/learning-source"],
      topics: ["Web testing"],
      created_at: "2026-08-09T12:00:00.000Z",
      updated_at: "2026-08-09T12:01:00.000Z",
    }],
    collection_items: [
      { collection_id: "col-browser-smoke", insight_id: "ins-browser-smoke", position: 1 },
      { collection_id: "col-browser-smoke", insight_id: "ins-browser-smoke-next", position: 2 },
    ],
  }, null, 2)}\n`);

  const recorder = new ObservationRunRecorder(project, () => new Date("2026-08-30T12:00:00.000Z"));
  const context = { run_id: "run-browser-smoke", device_id: "browser-smoke", source_ref: "browser-smoke" };
  recorder.start({
    ...context,
    event_id: "browser-impact-start",
    source_client: "codex",
    source_session_ref: null,
    repository_revision: null,
    branch: null,
    model_provider: "openai",
    model_name: null,
    completeness: "complete",
  });
  recorder.search({ ...context, event_id: "browser-impact-search" }, {
    query: "BROWSER_RAW_SECRET",
    mode: "hybrid",
    path: "D:/BROWSER_RAW_SECRET/private.ts",
    module: "BROWSER_RAW_SECRET",
    results: [{ trap_id: 1, revision: "project:browser", rank: 1 }],
    diagnostics: [],
    duration_ms: 12,
  });
  recorder.search({ ...context, event_id: "browser-global-search" }, {
    query: "scope", mode: "fts", path: null, module: null,
    results: [{ trap_id: 1, revision: "global:browser", rank: 1 }], diagnostics: [], duration_ms: 1,
  });
  recorder.feedback({ ...context, event_id: "browser-global-feedback",
    trap_id: 1, revision: "global:browser", feedback: "harmful", note: null });
  recorder.validation({
    ...context,
    event_id: "browser-impact-validation",
    kind: "test",
    command: "bun test BROWSER_RAW_SECRET",
    status: "passed",
    passed: 1,
    failed: 0,
    duration_ms: 80,
  });
  recorder.feedback({
    ...context,
    event_id: "browser-impact-feedback",
    trap_id: 1,
    revision: "project:browser",
    feedback: "helpful",
    note: "BROWSER_RAW_SECRET",
  });
  recorder.complete({
    ...context,
    event_id: "browser-impact-complete",
    status: "completed",
    completeness: "complete",
    duration_ms: 1_200,
    input_tokens: 100,
    output_tokens: 40,
  });
}

function chromeExecutablePath(): string | null {
  const programFiles = process.env["ProgramFiles"] ?? "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const localAppData = process.env["LOCALAPPDATA"];
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    // Without these the smoke test silently skips on Windows, so browser-visible
    // regressions stay invisible on the platform this project is developed on.
    join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
    join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
    ...(localAppData ? [join(localAppData, "Google", "Chrome", "Application", "chrome.exe")] : []),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}
