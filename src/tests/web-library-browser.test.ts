import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { webSuiteFixture } from "./project-eval-suite-fixture";
import { webProjectRouteRef } from "../web/project-registry";

const chrome = [process.env.CODETRAP_TEST_BROWSER,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/chromium", "/usr/bin/google-chrome",
  join(process.env.ProgramFiles ?? "C:\\Program Files", "Google/Chrome/Application/chrome.exe"),
  join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "Microsoft/Edge/Application/msedge.exe"),
].find(path => path && existsSync(path));
const browserTest = chrome ? test : test.skip;

browserTest("Library phone reader recovers separately from malformed list, missing detail and unavailable experience", async () => {
  const f = webSuiteFixture();
  let failList = true, failDetail = true, failExperience = true;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: request => {
    const path = new URL(request.url).pathname;
    if (path === "/api/traps" && failList) return Response.json({ project_root: f.project, traps: [{}] });
    if (path === "/api/trap" && failDetail) return Response.json({ error: "Missing" }, { status: 404 });
    if (path === "/api/trap/experience" && failExperience) return new Response("Offline", { status: 503 });
    return f.handler(request);
  } });
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ executablePath: chrome!, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); page.setDefaultTimeout(5000);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem("codetrap-locale", "zh"));
    const hash = `#/library/project/1?project=${webProjectRouteRef(f.project)}`;
    await page.goto(`http://127.0.0.1:${server.port}/?token=suite-token` + hash);
    await page.locator("#library-reader-retry").waitFor();
    expect(await page.locator("#detail").textContent()).toContain("暂时无法加载经验列表");
    expect(await page.locator(".rail").isVisible()).toBe(false);
    expect(new URL(page.url()).hash).toBe(hash);
    failList = false; await page.locator("#library-reader-retry").click();
    await page.locator("#library-detail-retry").waitFor();
    expect(await page.locator("#detail").textContent()).not.toContain("正在加载");
    failDetail = false; await page.locator("#library-detail-retry").click();
    await page.locator("[data-experience-retry]").waitFor();
    expect(await page.locator("#detail").textContent()).toContain("Transaction rollback");
    expect(await page.locator("#trap-experience-panel").textContent()).toContain("暂时无法加载经验足迹");
    failExperience = false; await page.locator("[data-experience-retry]").click();
    await page.locator(".experience-path").waitFor();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator("#reader-back").click();
    expect(new URL(page.url()).hash).toContain("pane=list");
    await page.goBack(); await page.locator(".experience-path").waitFor();
    expect(new URL(page.url()).hash).toBe(hash);
    await page.reload(); await page.locator(".experience-path").waitFor();
    expect(new URL(page.url()).hash).toBe(hash);
    expect(errors).toEqual([]);
  } finally { await browser.close(); server.stop(true); }
}, 20000);

browserTest("Library filter response races leave current results and history intact", async () => {
  const f = webSuiteFixture();
  let release!: () => void, requested!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const received = new Promise<void>(resolve => { requested = resolve; });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async request => {
    const url = new URL(request.url);
    if (url.pathname === "/api/traps" && url.searchParams.get("owner") === "slow") {
      requested(); await pending; return Response.json({ error: "Stale failure" }, { status: 503 });
    }
    return f.handler(request);
  } });
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ executablePath: chrome!, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }); page.setDefaultTimeout(5000);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.port}/?token=suite-token#/library?project=${webProjectRouteRef(f.project)}`);
    await page.locator("[data-trap-key='project:1']").click(); await page.locator(".experience-path").waitFor();
    await page.locator("#library-filters summary").click();
    await page.locator("#trap-filter-owner").fill("slow"); await page.locator("#trap-filter-owner").press("Enter"); await received;
    expect(await page.locator("#detail").textContent()).toContain("Loading your lessons");
    expect(await page.locator("[data-trap-key]").count()).toBe(0);
    await page.locator("#trap-filter-owner").fill(""); await page.locator("#trap-filter-owner").press("Enter");
    await page.locator(".experience-path").waitFor();
    const response = page.waitForResponse(reply => reply.url().includes("owner=slow")); release(); await response;
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    expect(await page.locator("#detail").textContent()).toContain("Transaction rollback");
    expect(await page.locator("#library-reader-retry").count()).toBe(0);
    await page.locator("[data-trap-key='project:1']").click();
    expect(new URL(page.url()).hash).toContain("/project/1");
    await page.locator("[data-trap-health='never-useful']").click();
    expect(new URL(page.url()).hash).not.toContain("/project/1");
    expect(await page.locator("[data-trap-key]").count()).toBe(1);
    expect(errors).toEqual([]);
  } finally { release(); await browser.close(); server.stop(true); }
}, 20000);

browserTest("Library Back navigation does not wait for a superseded route's slow list", async () => {
  const f = webSuiteFixture();
  let blockNext = false, release!: () => void, requested!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const received = new Promise<void>(resolve => { requested = resolve; });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async request => {
    if (new URL(request.url).pathname === "/api/traps" && blockNext) {
      blockNext = false; requested(); await pending;
      return Response.json({ error: "Superseded route" }, { status: 503 });
    }
    return f.handler(request);
  } });
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ executablePath: chrome!, headless: true });
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(4000);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    const ref = webProjectRouteRef(f.project), hash = `#/library/project/1?project=${ref}`;
    await page.goto(`http://127.0.0.1:${server.port}/?token=suite-token` + hash);
    await page.locator(".experience-path").waitFor();
    blockNext = true;
    await page.evaluate(next => { location.hash = next; }, `#/library/project/999?project=${ref}`);
    await received;
    await page.goBack();
    // The return route must render before the abandoned request is released.
    await page.locator(".experience-path").waitFor();
    expect(new URL(page.url()).hash).toBe(hash);
    const reply = page.waitForResponse(response => response.status() === 503);
    release(); await reply;
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    expect(await page.locator("#detail").textContent()).toContain("Transaction rollback");
    expect(await page.locator("#library-reader-retry").count()).toBe(0);
    expect(errors).toEqual([]);
  } finally { release(); await browser.close(); server.stop(true); }
}, 20000);
