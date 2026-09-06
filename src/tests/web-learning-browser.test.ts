import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { learningFixture } from "./web-learning-fixture";
import { createWebHandler } from "../web/server";
const chrome = [process.env.CODETRAP_TEST_BROWSER, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/chromium", "/usr/bin/google-chrome", join(process.env.ProgramFiles ?? "C:\\Program Files", "Google/Chrome/Application/chrome.exe")].find(p => p && existsSync(p));
const browserTest = chrome ? test : test.skip;
async function launch() { const { chromium } = await import("playwright-core"); return chromium.launch({ executablePath: chrome!, headless: true }); }
const title = "#learning-agent-candidate-form [name=title]", fix = "#learning-agent-candidate-form [name=fix]", tags = "#learning-agent-candidate-form [name=tags]";
const settle = (page: import("playwright-core").Page) => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

browserTest("Learning keeps separate raw practice/proposal drafts across articles, projects, locale, view and phone navigation", async () => {
  const f = learningFixture(), server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: f.handler }), browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }); page.setDefaultTimeout(5000);
    const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem("codetrap-queue-collapsed", "false"));
    await page.goto(`http://127.0.0.1:${server.port}/?token=learning-token` + f.a.hash());
    await page.locator("#learning-practice-note").fill("Alpha practice\nnot yet saved");
    await page.locator("#begin-learning-candidate").click(); await page.locator(title).fill("Alpha proposal"); await page.locator(tags).fill(" one,  two ,");
    await page.locator("#next-learning").click(); await page.locator("#begin-learning-candidate").click(); await page.locator(title).fill("Second proposal");
    await page.locator("#previous-learning").click(); expect(await page.locator(title).inputValue()).toBe("Alpha proposal");
    expect(await page.locator("#learning-practice-note").inputValue()).toBe("Alpha practice\nnot yet saved");
    await page.locator(`[data-project='${f.b.root}']`).click(); await page.locator(`[data-learning-insight='${f.b.root}::one']`).click();
    await page.locator("#begin-learning-candidate").click(); await page.locator(title).fill("Beta proposal");
    await page.locator(`[data-project='${f.a.root}']`).click(); await page.locator(`[data-learning-insight='${f.a.root}::one']`).click();
    expect(await page.locator(title).inputValue()).toBe("Alpha proposal");
    await page.locator('[data-locale="zh"]').click(); expect(await page.locator(tags).inputValue()).toBe(" one,  two ,");
    await page.locator('[data-main-view="library"]').click(); await page.goBack(); await page.locator(title).waitFor();
    expect(await page.locator(title).inputValue()).toBe("Alpha proposal");
    await page.setViewportSize({ width: 390, height: 844 }); await page.locator('[data-locale="en"]').click();
    expect(await page.locator(tags).inputValue()).toBe(" one,  two ,");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator("#cancel-learning-candidate").click(); await page.locator("#begin-learning-candidate").waitFor();
    expect(await page.locator("#learning-practice-note").inputValue()).toBe("Alpha practice\nnot yet saved");
    expect(errors).toEqual([]);
  } finally { await browser.close(); server.stop(true); }
}, 20000);

browserTest("slow preview preserves newer proposal input and caret instead of installing a normalized old draft", async () => {
  const f = learningFixture(); let delay = false, arrived!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { arrived = resolve; }), pending = new Promise<void>(resolve => { release = resolve; });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async req => {
    const response = await f.handler(req);
    if (delay && new URL(req.url).pathname === "/api/learning/candidate/preview") { delay = false; arrived(); await pending; }
    return response;
  } }), browser = await launch();
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(5000);
    await page.goto(`http://127.0.0.1:${server.port}/?token=learning-token` + f.a.hash());
    await page.locator("#begin-learning-candidate").click(); await page.locator(fix).fill("Submitted version");
    delay = true; await page.locator("#preview-learning-candidate").click(); await started;
    await page.locator(fix).fill("New version\nkeep this line");
    await page.locator(fix).evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(3, 7));
    release(); await page.locator("#preview-learning-candidate:not([disabled])").waitFor();
    expect(await page.locator(fix).inputValue()).toBe("New version\nkeep this line");
    expect(await page.locator(fix).evaluate((node: HTMLTextAreaElement) => [document.activeElement === node, node.selectionStart, node.selectionEnd])).toEqual([true, 3, 7]);
    expect(await page.locator("#learning-proposal-state").textContent()).toContain("not been validated");
    await page.locator("#preview-learning-candidate").click(); await page.locator("#preview-learning-candidate:not([disabled])").waitFor();
    expect(await page.locator("#learning-proposal-state").textContent()).toContain("passed preview validation");
  } finally { release(); await browser.close(); server.stop(true); }
}, 20000);

browserTest("reauthorization keeps Learning drafts and the explicit read-practice-proposal-review journey", async () => {
  const f = learningFixture(); let handler = f.handler, saves = 0;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: req => { if (new URL(req.url).pathname === "/api/learning/practice-note") saves++; return handler(req); } }), browser = await launch();
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(5000); const root = `http://127.0.0.1:${server.port}`;
    await page.goto(root + "/?token=learning-token" + f.a.hash());
    await page.locator("#learning-practice-note").fill("Tried this in an isolated task");
    await page.locator("#begin-learning-candidate").click(); await page.locator(title).fill("Concrete experience from reading");
    await page.locator(fix).fill("Apply the rule and verify the actual result.");
    handler = createWebHandler({ token: "reconnected-token", cwd: f.a.root, home: f.home, currentProjectRoot: f.a.root });
    await page.locator("#save-learning-practice").click(); await page.locator("#bootstrap-link").waitFor();
    await page.locator("#bootstrap-link").fill(root + "/?token=reconnected-token"); await page.locator("#bootstrap-connect").click();
    await page.locator(title).waitFor(); expect(saves).toBe(1);
    expect(await page.locator(title).inputValue()).toBe("Concrete experience from reading");
    expect(await page.locator("#learning-practice-note").inputValue()).toBe("Tried this in an isolated task");
    await page.locator("#save-learning-practice").click(); await page.locator("#save-learning-practice:not([disabled])").waitFor();
    expect(saves).toBe(2);
    await page.locator('[data-learning-status="learned"]').click(); await page.locator('[data-learning-status="learned"].active').waitFor();
    await page.locator('[data-learning-feedback="helpful"]').click(); await page.locator('[data-learning-feedback="helpful"].active').waitFor();
    await page.locator("#create-learning-candidate").click(); await page.locator("#open-learning-candidate-review").waitFor();
    await page.locator("#open-learning-candidate-review").click(); await page.locator("#candidate-form").waitFor({ state: "attached" });
    expect(await page.locator("#title").inputValue()).toBe("Concrete experience from reading");
    expect(await page.locator("#fix").inputValue()).toBe("Apply the rule and verify the actual result.");
    expect(f.a.sessions.listSessions({ status: "all" })).toHaveLength(1);
    expect(f.a.traps.list()).toHaveLength(0);
  } finally { await browser.close(); server.stop(true); }
}, 20000);

browserTest("Learning list failures retry, missing links stay missing and Back outruns an abandoned request", async () => {
  const f = learningFixture(), server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: f.handler }), browser = await launch();
  let release!: () => void;
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(5000);
    let invalid = true;
    await page.route("**/api/insights?**", async route => invalid ? route.fulfill({ json: { project_root: "/wrong" } }) : route.continue());
    await page.goto(`http://127.0.0.1:${server.port}/?token=learning-token` + f.a.hash());
    await page.locator("#detail [data-learning-retry]").waitFor(); invalid = false;
    await page.locator("#detail [data-learning-retry]").click(); await page.locator("#learning-practice-note").fill("Keep note through Back");
    await page.locator("#begin-learning-candidate").click(); await page.locator(title).fill("Keep proposal through Back");
    const original = page.url(); let arrived!: () => void;
    const started = new Promise<void>(resolve => { arrived = resolve; }), pending = new Promise<void>(resolve => { release = resolve; });
    await page.unroute("**/api/insights?**");
    let hold = true;
    await page.route("**/api/insights?**", async route => { if (hold) { hold = false; arrived(); await pending; await route.fulfill({ status: 503, body: "Late failure" }); } else await route.continue(); });
    await page.evaluate(hash => { location.hash = hash; }, f.a.hash("missing")); await started;
    await page.goBack(); await page.locator(title).waitFor({ timeout: 3000 });
    expect(page.url()).toBe(original); expect(await page.locator(title).inputValue()).toBe("Keep proposal through Back");
    release(); await settle(page);
    expect(await page.locator("#learning-practice-note").inputValue()).toBe("Keep note through Back");
    await page.evaluate(hash => { location.hash = hash; }, f.a.hash("missing")); await page.locator(".route-unavailable").waitFor();
    expect(await page.locator("#learning-practice-note").count()).toBe(0);
  } finally { release?.(); await browser.close(); server.stop(true); }
}, 20000);

browserTest("creation finishing on another article keeps its draft, and Review completion unlocks Learning controls", async () => {
  const f = learningFixture(); let heldPath = "", arrived!: () => void, release!: () => void;
  let pending = Promise.resolve();
  function hold(path: string) { heldPath = path; pending = new Promise<void>(resolve => { release = resolve; }); return new Promise<void>(resolve => { arrived = resolve; }); }
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async req => {
    const response = await f.handler(req);
    if (new URL(req.url).pathname === heldPath) { heldPath = ""; arrived(); await pending; }
    return response;
  } }), browser = await launch();
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(5000);
    await page.goto(`http://127.0.0.1:${server.port}/?token=learning-token` + f.a.hash());
    await page.locator("#next-learning").click(); await page.locator("#begin-learning-candidate").click(); await page.locator(title).fill("Keep second article draft");
    await page.locator("#previous-learning").click(); await page.locator("#begin-learning-candidate").click(); await page.locator(title).fill("Submit first article");
    const created = hold("/api/learning/candidate/create"); await page.locator("#create-learning-candidate").click(); await created;
    await page.locator("#next-learning").click(); expect(await page.locator(title).inputValue()).toBe("Keep second article draft");
    expect(await page.locator("#create-learning-candidate").isDisabled()).toBe(true);
    release(); await page.locator("#create-learning-candidate:not([disabled])").waitFor();
    expect(await page.locator(title).inputValue()).toBe("Keep second article draft");
    expect(new URL(page.url()).hash).toContain("/two?");
    await page.locator("#previous-learning").click(); await page.locator("#open-learning-candidate-review").click(); await page.locator("#title").waitFor({ state: "attached" });
    const saved = hold("/api/candidate/save"); await page.locator("#save").click(); await saved;
    await page.locator('[data-main-view="learning"]').click(); await page.locator("#learning-practice-note").waitFor();
    expect(await page.locator("#save-learning-practice").isDisabled()).toBe(true);
    release(); await page.locator("#save-learning-practice:not([disabled])").waitFor();
  } finally { release?.(); await browser.close(); server.stop(true); }
}, 20000);

browserTest("switching projects removes the old Learning form immediately while sessions are delayed", async () => {
  const f = learningFixture(); let delay = false, release!: () => void, arrived!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { arrived = resolve; });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async req => {
    const url = new URL(req.url);
    if (delay && url.pathname === "/api/sessions" && url.searchParams.get("project") === f.b.root) { delay = false; arrived(); await pending; }
    return f.handler(req);
  } }), browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }); page.setDefaultTimeout(5000);
    await page.addInitScript(() => localStorage.setItem("codetrap-queue-collapsed", "false"));
    await page.goto(`http://127.0.0.1:${server.port}/?token=learning-token` + f.a.hash());
    await page.locator("#begin-learning-candidate").click(); await page.locator(title).fill("Original project draft");
    delay = true; await page.locator(`[data-project='${f.b.root}']`).click(); await started;
    expect(await page.locator(title).count()).toBe(0); expect(await page.locator("#learning-practice-note").count()).toBe(0);
    release(); await page.locator("#learning-practice-note").waitFor();
    await page.locator(`[data-project='${f.a.root}']`).click(); await page.locator(`[data-learning-insight='${f.a.root}::one']`).click();
    expect(await page.locator(title).inputValue()).toBe("Original project draft");
  } finally { release(); await browser.close(); server.stop(true); }
}, 20000);
