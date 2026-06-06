import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildTrapInput } from "../domain/trap";
import { SessionOperations } from "../lib/session-operations";
import { SessionStore } from "../lib/session-store";
import { TrapOperations } from "../lib/trap-operations";
import { TrapStore } from "../lib/store";
import { addWebProject } from "../web/project-registry";
import { createWebHandler } from "../web/server";

const TOKEN = "browser-smoke-token";

describe("web command", () => {
  test("web --help prints usage without starting the server", async () => {
    const cwd = tempProjectDir("codetrap-web-help-");
    const home = tempHome();
    const direct = await runCli(["web", "--help"], cwd, home);
    expect(direct.exitCode).toBe(0);
    expect(direct.stdout).toContain("Usage:");
    expect(direct.stdout).toContain("codetrap web [--project <path>]");
    expect(direct.stdout).toContain("--project <path>");
    expect(direct.stdout).not.toContain("listening on");
    expect(direct.stderr).toBe("");

    const afterOption = await runCli(["web", "--project", cwd, "--help"], cwd, home);
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
    const home = tempHome();
    const project = tempProjectDir("codetrap-web-browser-");
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
      await expectText(page.locator("#review-summary"), "1 pending");

      await page.getByRole("button", { name: "Library" }).click();
      await page.waitForSelector("text=Browser smoke confirmed trap");

      expect(errors).toEqual([]);
    } finally {
      await browser.close();
      server.stop(true);
    }
  }, 20_000);
});

async function expectText(locator: { innerText: () => Promise<string> }, expected: string): Promise<void> {
  expect(await locator.innerText()).toContain(expected);
}

async function runCli(args: string[], cwd: string, home: string): Promise<{
  exitCode: number | "timeout";
  stdout: string;
  stderr: string;
}> {
  const proc = Bun.spawn({
    cmd: ["bun", "run", join(import.meta.dir, "..", "index.ts"), ...args],
    cwd,
    env: isolatedEnv(home),
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = new Response(proc.stdout).text();
  const stderr = new Response(proc.stderr).text();
  const exitCode = await exitOrTimeout(proc, 1_500);
  return { exitCode, stdout: await stdout, stderr: await stderr };
}

async function exitOrTimeout(proc: ReturnType<typeof Bun.spawn>, timeoutMs: number): Promise<number | "timeout"> {
  let timeout: Timer | undefined;
  const timed = new Promise<"timeout">((resolve) => {
    timeout = setTimeout(() => {
      proc.kill();
      resolve("timeout");
    }, timeoutMs);
  });
  const result = await Promise.race([proc.exited, timed]);
  if (timeout) clearTimeout(timeout);
  return result;
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

function tempHome(): string {
  const home = realpathSync(mkdtempSync(join(tmpdir(), "codetrap-web-browser-home-")));
  mkdirSync(join(home, ".codetrap"), { recursive: true });
  return home;
}

function tempProjectDir(prefix: string): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  mkdirSync(join(dir, ".codetrap"));
  return dir;
}

function isolatedEnv(home: string): Record<string, string> {
  return {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    JINA_API_KEY: "",
    CODETRAP_SEARCH_MODE: "",
    CODETRAP_SEARCH_LIMIT: "",
    CODETRAP_SEARCH_SCOPE: "",
    CODETRAP_RERANK: "",
  };
}
