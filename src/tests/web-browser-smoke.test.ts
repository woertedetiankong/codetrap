import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildTrapInput } from "../domain/trap";
import { SessionOperations } from "../lib/session-operations";
import { SessionStore } from "../lib/session-store";
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
      await expectWorkspaceHeaderLayout(page, 2);

      await page.setViewportSize({ width: 1920, height: 800 });
      await page.waitForFunction(() => document.querySelector(".rail")!.classList.contains("wide-header"));
      await expectWorkspaceHeaderLayout(page, 1);
      await expectText(page.locator("#review-summary"), "1 pending");

      await page.getByRole("button", { name: "Library" }).click();
      await page.waitForSelector("text=Browser smoke confirmed trap");
      await expectTextContent(page.locator('[data-trap-health="needs-validation"]'), "Needs validation");

      await page.getByRole("button", { name: "Learning" }).click();
      await page.waitForSelector("text=Browser smoke learning insight");
      await expectText(page.locator("#candidates"), "not learned");
      await page.getByRole("button", { name: /Browser smoke learning insight/ }).click();
      await expectTextContent(page.locator("#detail"), "Learning status");
      await expectText(page.locator("pre.learning-code"), "[source] -> [agent] -> [insight]");
      expect(await page.locator("a.source-link").getAttribute("href")).toBe("https://example.com/learning-source");
      await page.getByRole("button", { name: "Mark learned" }).click();
      await expectText(page.locator("#candidates"), "learned");
      expect(await page.getByRole("button", { name: "Learned" }).isDisabled()).toBe(true);

      expect(errors).toEqual([]);
    } finally {
      await browser.close();
      server.stop(true);
    }
  }, 40_000);
});

async function expectWorkspaceHeaderLayout(
  page: { evaluate: <T>(fn: () => T) => Promise<T> },
  expectedNavigationRows: number
): Promise<void> {
  const layout = await page.evaluate(() => {
    const rect = (selector: string) => {
      const box = document.querySelector(selector)!.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, bottom: box.bottom };
    };
    const navigationRows = new Set(
      [...document.querySelectorAll(".main-nav button")]
        .map((button) => Math.round(button.getBoundingClientRect().y))
    ).size;

    return {
      navigationRows,
      actions: rect(".rail-actions"),
      navigation: rect(".main-nav"),
      locale: rect(".locale-switcher"),
      refresh: rect("#refresh"),
      projectForm: rect(".project-form"),
    };
  });

  expect(layout.navigationRows).toBe(expectedNavigationRows);
  expect(Math.abs(layout.navigation.x - layout.actions.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(layout.navigation.width - layout.actions.width)).toBeLessThanOrEqual(2);
  expect(layout.navigation.bottom).toBeLessThanOrEqual(layout.locale.y);
  expect(layout.navigation.bottom).toBeLessThanOrEqual(layout.refresh.y);
  expect(Math.max(layout.locale.bottom, layout.refresh.bottom)).toBeLessThanOrEqual(layout.projectForm.y);
}

async function expectText(locator: { innerText: () => Promise<string> }, expected: string): Promise<void> {
  expect(await locator.innerText()).toContain(expected);
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
    version: 1,
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
    }],
  }, null, 2)}\n`);
}

function chromeExecutablePath(): string | null {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}
