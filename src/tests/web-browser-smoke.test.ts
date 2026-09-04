import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildTrapInput } from "../domain/trap";
import { SessionOperations } from "../lib/session-operations";
import { SessionStore } from "../lib/session-store";
import { ObservationRunRecorder } from "../lib/observation-recorder";
import { TrapOperations } from "../lib/trap-operations";
import { TrapStore } from "../lib/store";
import { addWebProject } from "../web/project-registry";
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
      await expectText(page.locator(".learning-status-control button.active"), "Learned");
      expect(await learnedButton.getAttribute("class")).toContain("active");
      await expectText(page.locator(".collection-header"), "1 of 2 learned");

      await page.getByRole("button", { name: "Impact" }).click();
      await page.waitForSelector(".impact-hero");
      await expectText(page.locator(".impact-hero"), "What changed while Codetrap was present?");
      await expectText(page.locator(".impact-metrics"), "1");
      await page.getByRole("tab", { name: "Evals" }).click();
      await page.waitForSelector(".evals-hero");
      await expectText(page.locator(".evals-hero"), "Measure the signal. Inspect the evidence.");
      await expectText(page.locator(".eval-rate-grid"), "100%");
      expect(new URL(page.url()).hash).toBe("#/impact/evals");
      expect(await page.title()).toBe("codetrap · Evals");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector(".evals-hero");
      await expectText(page.locator(".evals-hero"), "Measure the signal. Inspect the evidence.");
      await page.getByRole("tab", { name: "Runs" }).click();
      await page.locator("[data-observation-run='run-browser-smoke']").click();
      await page.waitForSelector(".impact-timeline");
      expect(new URL(page.url()).hash).toBe("#/impact/runs/run-browser-smoke");
      expect(await page.locator(".impact-event").count()).toBe(6);
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
