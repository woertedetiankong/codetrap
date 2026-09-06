import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { reviewFixture } from "./web-review-fixture";
import { createWebHandler } from "../web/server";
const chrome = [process.env.CODETRAP_TEST_BROWSER, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/chromium", "/usr/bin/google-chrome", join(process.env.ProgramFiles ?? "C:\\Program Files", "Google/Chrome/Application/chrome.exe")].find(p => p && existsSync(p));
const browserTest = chrome ? test : test.skip;
async function editLesson(page: import("playwright-core").Page) {
  await page.locator("#title").waitFor({ state: "attached" });
  if (!(await page.locator("#title").isVisible())) await page.locator("#review-edit-toggle").click();
}
async function launch() { const { chromium } = await import("playwright-core"); return chromium.launch({ executablePath: chrome!, headless: true }); }
const settle = async (page: import("playwright-core").Page) => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

browserTest("bare links in a fresh tab have an effective authorization entry and keep their original route", async () => {
  const f = reviewFixture(), server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: f.handler }), browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const authorized = await context.newPage(), page = await context.newPage();
    page.setDefaultTimeout(5000);
    const root = `http://127.0.0.1:${server.port}`;
    await authorized.goto(root + "/?token=review-token" + f.a.hash()); await authorized.locator("#title").waitFor({ state: "attached" });
    await page.addInitScript(() => localStorage.setItem("codetrap-locale", "zh"));
    await page.goto(root + "/" + f.a.hash());
    await page.locator("#bootstrap-failure").waitFor({ state: "visible" });
    expect(await page.locator("#bootstrap-failure-title").textContent()).toBe("为当前标签页授权");
    expect(await page.locator("#bootstrap-retry").isHidden()).toBe(true);
    expect(await page.locator("#app-shell").isHidden()).toBe(true);
    let documents = 0; page.on("request", req => { if (req.isNavigationRequest()) documents++; });
    await page.locator("#bootstrap-link").fill(root + "/?token=review-token" + f.b.hash());
    await page.locator("#bootstrap-connect").click(); await page.locator("#title").waitFor({ state: "attached" });
    expect(await page.locator("#title").inputValue()).toBe("First alpha");
    expect(new URL(page.url()).hash).toBe(f.a.hash());
    expect(new URL(page.url()).search).toBe("");
    expect(await page.locator("#bootstrap-link").inputValue()).toBe("");
    expect(documents).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.reload(); await page.locator("#title").waitFor({ state: "attached" });
    expect(await page.locator("#bootstrap-failure").isHidden()).toBe(true);
  } finally { await browser.close(); server.stop(true); }
}, 20000);

browserTest("reauthorization after a rejected save preserves visible drafts and never replays the write", async () => {
  const f = reviewFixture(); let handler = f.handler, writes = 0;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: req => {
    if (new URL(req.url).pathname === "/api/candidate/save") writes++;
    return handler(req);
  } }), browser = await launch();
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(5000);
    const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem("codetrap-locale", "zh"));
    const root = `http://127.0.0.1:${server.port}`;
    await page.goto(root + "/?token=review-token" + f.a.hash());
    await editLesson(page); await page.locator("#title").fill("Keep my unsaved title"); await page.locator("#fix").fill("Raw line one\nRaw line two");
    let documents = 0; page.on("request", req => { if (req.isNavigationRequest()) documents++; });
    handler = createWebHandler({ token: "rotated-token", cwd: f.a.root, home: f.home, currentProjectRoot: f.a.root });
    await page.locator("#save").click(); await page.locator("#bootstrap-failure").waitFor({ state: "visible" });
    expect(await page.locator("#bootstrap-failure-title").textContent()).toBe("重新连接工作台");
    expect(await page.locator("#bootstrap-privacy").textContent()).toContain("本地编辑仍保留");
    expect(await page.locator("#title").inputValue()).toBe("Keep my unsaved title");
    await page.locator("#bootstrap-link").fill(root + "/?token=wrong-token"); await page.locator("#bootstrap-connect").click();
    await page.waitForFunction(() => document.querySelector("#bootstrap-connect-error")?.textContent?.includes("此凭证未被接受"));
    expect(await page.evaluate(() => sessionStorage.getItem("codetrap-token"))).toBe("review-token");
    await page.locator("#bootstrap-link").fill(root + "/?token=rotated-token"); await page.locator("#bootstrap-connect").click();
    await page.locator("#title").waitFor({ state: "attached" }); await settle(page);
    expect(writes).toBe(1);
    expect(await page.locator("#title").inputValue()).toBe("Keep my unsaved title");
    expect(await page.locator("#fix").inputValue()).toBe("Raw line one\nRaw line two");
    expect(await page.locator("#review-discard").isVisible()).toBe(true);
    expect(new URL(page.url()).hash).toBe(f.a.hash());
    expect(documents).toBe(0);
    await page.locator("#save").click(); await page.locator("#review-discard").waitFor({ state: "detached" });
    expect(writes).toBe(2);
    expect(f.a.operations.getCandidate(f.a.candidates[0]!.id, f.a.session.id).candidate.trap.title).toBe("Keep my unsaved title");
    expect(errors).toEqual([]);
  } finally { await browser.close(); server.stop(true); }
}, 20000);

browserTest("recovery rejects another origin or port locally without sending a credential", async () => {
  const f = reviewFixture(); let apiCalls = 0;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: req => { if (new URL(req.url).pathname.startsWith("/api/")) apiCalls++; return f.handler(req); } }), browser = await launch();
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(5000);
    await page.goto(`http://127.0.0.1:${server.port}/` + f.a.hash()); await page.locator("#bootstrap-link").waitFor();
    const calls = apiCalls;
    for (const link of ["https://example.invalid/?token=private", `http://127.0.0.1:${server.port === 4737 ? 4738 : 4737}/?token=private`]) {
      await page.locator("#bootstrap-link").fill(link); await page.locator("#bootstrap-connect").click();
      expect(await page.locator("#bootstrap-connect-error").textContent()).toContain("different address or port");
    }
    expect(apiCalls).toBe(calls);
    expect(await page.evaluate(() => sessionStorage.getItem("codetrap-token"))).toBe(null);
    expect(new URL(page.url()).hash).toBe(f.a.hash());
  } finally { await browser.close(); server.stop(true); }
}, 20000);

browserTest("a temporary network failure retries in place with storage disabled", async () => {
  const f = reviewFixture(), server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: f.handler }), browser = await launch();
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(5000);
    await page.addInitScript(() => {
      for (const key of ["localStorage", "sessionStorage"]) Object.defineProperty(window, key, { get() { throw new DOMException("Blocked", "SecurityError"); } });
    });
    let offline = true;
    await page.route("**/api/bootstrap", route => offline ? route.abort("connectionrefused") : route.continue());
    await page.goto(`http://127.0.0.1:${server.port}/?token=review-token` + f.a.hash());
    await page.locator("#bootstrap-failure").waitFor({ state: "visible" });
    expect(await page.locator("#bootstrap-failure-title").textContent()).toBe("Cannot reach the local service");
    expect(await page.locator("#bootstrap-auth-form").isHidden()).toBe(true);
    let documents = 0; page.on("request", req => { if (req.isNavigationRequest()) documents++; });
    offline = false; await page.locator("#bootstrap-retry").click(); await page.locator("#title").waitFor({ state: "attached" });
    expect(documents).toBe(0);
    expect(new URL(page.url()).search).toBe("");
    expect(await page.locator("#title").inputValue()).toBe("First alpha");
  } finally { await browser.close(); server.stop(true); }
}, 20000);

browserTest("a late unauthorized read cannot reopen recovery after a successful reconnection", async () => {
  const f = reviewFixture(); let hold = false, expired = false, arrived!: () => void, release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; }), received = new Promise<void>(resolve => { arrived = resolve; });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async req => {
    const path = new URL(req.url).pathname;
    if (hold && path === "/api/sessions") { hold = false; arrived(); await pending; return new Response("Old session", { status: 401 }); }
    if (expired && path === "/api/candidate/save") return new Response("Expired", { status: 401 });
    return f.handler(req);
  } }), browser = await launch();
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(5000);
    await page.goto(`http://127.0.0.1:${server.port}/?token=review-token` + f.a.hash()); await editLesson(page); await page.locator("#title").fill("Unsaved during old read");
    hold = true;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); await received;
    expired = true; await page.locator("#save").click(); await page.locator("#bootstrap-failure").waitFor({ state: "visible" });
    expired = false; await page.locator("#bootstrap-retry").click(); await page.locator("#title").waitFor({ state: "attached" });
    const response = page.waitForResponse(r => r.url().includes("/api/sessions") && r.status() === 401); release(); await response; await settle(page);
    expect(await page.locator("#bootstrap-failure").isHidden()).toBe(true);
    expect(await page.locator("#title").inputValue()).toBe("Unsaved during old read");
  } finally { release(); await browser.close(); server.stop(true); }
}, 20000);
