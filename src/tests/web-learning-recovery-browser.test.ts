import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "playwright-core";
import { learningFixture } from "./web-learning-fixture";
import { LEARNING_DRAFT_PREFIX, LEARNING_DRAFT_TTL } from "../web/browser/learning-draft-store";
const chrome = [process.env.CODETRAP_TEST_BROWSER, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/chromium", "/usr/bin/google-chrome", join(process.env.ProgramFiles ?? "C:\\Program Files", "Google/Chrome/Application/chrome.exe")].find(p => p && existsSync(p));
const browserTest = chrome ? test : test.skip;
async function launch() { const { chromium } = await import("playwright-core"); return chromium.launch({ executablePath: chrome!, headless: true }); }
const note = "#learning-practice-note", title = '#learning-agent-candidate-form [name="title"]', tags = '#learning-agent-candidate-form [name="tags"]';
const restore = "#learning-recovery-restore", choice = "#learning-recovery-choice";
async function snapshots(page: Page) {
  return page.evaluate(prefix => Object.keys(localStorage).filter(k => k.startsWith(prefix)).map(k => JSON.parse(localStorage.getItem(k)!)), LEARNING_DRAFT_PREFIX);
}
async function choose(page: Page, kind: string, value?: string) {
  const records = await snapshots(page), record = records.find(r => r.kind === kind && (value === undefined || r.value === value));
  expect(record).toBeDefined();
  await page.locator(`${choice} option[value="${record.id}"]`).waitFor({ state: "attached" });
  await page.locator(choice).selectOption(record.id);
}

browserTest("Learning reload and close/reopen offer explicit raw draft recovery without replaying mutations", async () => {
  const f = learningFixture(); let writes = 0;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: req => { if (req.method === "POST") writes++; return f.handler(req); } }), browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } }); let page = await context.newPage(); page.setDefaultTimeout(5000);
    const url = `http://127.0.0.1:${server.port}/?token=learning-token` + f.a.hash();
    await page.goto(url); await page.locator(note).fill("Draft practice\nwith lines");
    await page.locator("#begin-learning-candidate").click(); await page.locator(title).fill("My proposal"); await page.locator(tags).fill(" one,  two ,");
    await page.locator("#preview-learning-candidate").click(); await page.locator("#preview-learning-candidate:not([disabled])").waitFor();
    expect(await snapshots(page)).toHaveLength(2); const before = writes;
    await page.reload(); await page.locator(restore).waitFor(); expect(await page.locator(note).inputValue()).toBe(""); expect(await page.locator(title).count()).toBe(0);
    await choose(page, "practice"); await page.locator(restore).click(); expect(await page.locator(note).inputValue()).toBe("Draft practice\nwith lines");
    await choose(page, "proposal"); await page.locator(restore).click(); expect(await page.locator(title).inputValue()).toBe("My proposal"); expect(await page.locator(tags).inputValue()).toBe(" one,  two ,");
    expect(await page.locator("#learning-proposal-state").textContent()).toContain("not been validated"); expect(writes).toBe(before);
    await page.close(); page = await context.newPage(); page.setDefaultTimeout(5000);
    await page.goto(url); await page.locator(restore).waitFor(); await choose(page, "practice"); await page.locator(restore).click();
    await page.locator("#save-learning-practice").click(); await page.locator("#save-learning-practice:not([disabled])").waitFor();
    expect((await snapshots(page)).map(r => r.kind)).toEqual(["proposal"]);
    await page.locator("#learning-recovery-delete").click(); expect(await snapshots(page)).toHaveLength(0);
    await page.reload(); await page.locator(note).waitFor(); expect(await page.locator(note).inputValue()).toBe("Draft practice\nwith lines"); expect(await page.locator(restore).count()).toBe(0);
  } finally { await browser.close(); server.stop(true); }
}, 20000);

browserTest("concurrent tabs retain distinct newer snapshots and recovery never replaces an active editor", async () => {
  const f = learningFixture(), server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: f.handler }), browser = await launch();
  try {
    const context = await browser.newContext(); const a = await context.newPage(), b = await context.newPage(), c = await context.newPage();
    for (const page of [a, b, c]) page.setDefaultTimeout(5000);
    const url = `http://127.0.0.1:${server.port}/?token=learning-token` + f.a.hash();
    await a.goto(url); await a.locator(note).fill("Tab A"); await b.goto(url); await b.locator(note).fill("Tab B");
    expect(await b.locator(restore).isDisabled()).toBe(true); expect(await b.locator(note).inputValue()).toBe("Tab B");
    await c.goto(url); await choose(c, "practice", "Tab A"); await c.locator(restore).click(); expect(await c.locator(note).inputValue()).toBe("Tab A");
    await a.locator(note).fill("Tab A newer"); await c.locator("#save-learning-practice").click(); await c.locator("#save-learning-practice:not([disabled])").waitFor();
    expect((await snapshots(c)).map(r => r.value).sort()).toEqual(["Tab A newer", "Tab B"]);
    await choose(c, "practice", "Tab B"); await c.locator("#learning-recovery-delete").click();
    expect((await snapshots(c)).map(r => r.value)).toEqual(["Tab A newer"]); expect(await a.locator(note).inputValue()).toBe("Tab A newer");
  } finally { await browser.close(); server.stop(true); }
}, 20000);

browserTest("durable recovery stays scoped to the original source project with same-ID articles", async () => {
  const f = learningFixture(), server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: f.handler }), browser = await launch();
  try {
    const context = await browser.newContext(); const page = await context.newPage(); page.setDefaultTimeout(5000);
    const root = `http://127.0.0.1:${server.port}/?token=learning-token`;
    await page.goto(root + f.a.hash()); await page.locator(note).fill("Alpha only"); await page.close();
    const next = await context.newPage(); next.setDefaultTimeout(5000);
    await next.goto(root + f.b.hash()); await next.locator(note).waitFor(); expect(await next.locator(restore).count()).toBe(0);
    await next.goto(root + f.a.hash()); await next.locator(restore).click(); expect(await next.locator(note).inputValue()).toBe("Alpha only");
  } finally { await browser.close(); server.stop(true); }
}, 15000);

browserTest("changed server notes are visible before recovery and restored text does not save automatically", async () => {
  const f = learningFixture(); f.a.operations.updatePracticeNote("one", "Original saved note");
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: f.handler }), browser = await launch();
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(5000);
    await page.goto(`http://127.0.0.1:${server.port}/?token=learning-token` + f.a.hash()); await page.locator(note).fill("Local edits");
    f.a.operations.updatePracticeNote("one", "Changed outside browser");
    await page.reload(); await page.locator(restore).waitFor();
    expect(await page.locator("#learning-recovery-notice").textContent()).toContain("has changed");
    expect(await page.locator(note).inputValue()).toBe("Changed outside browser");
    await page.locator(restore).click(); expect(await page.locator(note).inputValue()).toBe("Local edits");
    await page.locator("#discard-learning-practice").click(); expect(await page.locator(note).inputValue()).toBe("Changed outside browser"); expect(await snapshots(page)).toHaveLength(0);
  } finally { await browser.close(); server.stop(true); }
}, 15000);

browserTest("denied or full draft storage keeps editing and explicit saves usable with a visible warning", async () => {
  const f = learningFixture(), server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: f.handler }), browser = await launch();
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(5000);
    await page.addInitScript(prefix => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if (k.startsWith(prefix)) throw new DOMException("Full", "QuotaExceededError"); return set.call(this, k, v); }; }, LEARNING_DRAFT_PREFIX);
    await page.goto(`http://127.0.0.1:${server.port}/?token=learning-token` + f.a.hash()); await page.locator(note).fill("Keep despite quota");
    expect(await page.locator("#learning-draft-storage").textContent()).toContain("could not be updated"); expect(await page.locator(note).inputValue()).toBe("Keep despite quota");
    expect(await snapshots(page)).toHaveLength(0); await page.locator("#save-learning-practice").click(); await page.locator("#save-learning-practice:not([disabled])").waitFor();
    await page.reload(); await page.locator(note).waitFor(); expect(await page.locator(note).inputValue()).toBe("Keep despite quota");
  } finally { await browser.close(); server.stop(true); }
}, 15000);

browserTest("malformed and expired records are skipped, recovery text is safe, and phone layout stays readable", async () => {
  const f = learningFixture(), server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: f.handler }), browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); page.setDefaultTimeout(5000);
    const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.port}/?token=learning-token` + f.a.hash()); await page.locator(note).fill('<img src=x onerror="alert(1)">\n' + "LongText".repeat(70));
    await page.evaluate(({ prefix, ttl }) => {
      const key = Object.keys(localStorage).find(k => k.startsWith(prefix))!, saved = JSON.parse(localStorage.getItem(key)!);
      localStorage.setItem(prefix + "expired", JSON.stringify({ ...saved, id: "expired", updatedAt: Date.now() - ttl }));
      localStorage.setItem(prefix + "broken", "{");
    }, { prefix: LEARNING_DRAFT_PREFIX, ttl: LEARNING_DRAFT_TTL });
    await page.reload(); await page.locator(restore).waitFor(); await page.locator('[data-locale="zh"]').click();
    await page.locator("#learning-draft-recovery summary").click();
    expect(await page.locator("#learning-draft-recovery img").count()).toBe(0);
    expect(await page.locator(".learning-recovery-preview").textContent()).toContain("<img");
    expect(await page.locator("#learning-draft-storage").textContent()).toContain("格式不受支持");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(prefix => localStorage.getItem(prefix + "expired"), LEARNING_DRAFT_PREFIX)).toBeNull();
    expect(errors).toEqual([]);
  } finally { await browser.close(); server.stop(true); }
}, 15000);

browserTest("unconfirmed creation keeps a recoverable proposal and exposes its existing review record after reload", async () => {
  const f = learningFixture(); let fail = true, creates = 0;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async req => {
    const response = await f.handler(req);
    if (new URL(req.url).pathname === "/api/learning/candidate/create") { creates++; if (fail) { fail = false; return new Response("Unavailable", { status: 503 }); } }
    return response;
  } }), browser = await launch();
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(5000);
    await page.goto(`http://127.0.0.1:${server.port}/?token=learning-token` + f.a.hash());
    await page.locator("#begin-learning-candidate").click(); await page.locator(title).fill("Recover an uncertain send");
    await page.locator("#create-learning-candidate").click(); await page.locator("#create-learning-candidate:not([disabled])").waitFor();
    await page.reload(); await page.locator(restore).waitFor(); expect(await page.locator("#learning-recovery-notice").textContent()).toContain("already has a review record");
    await page.locator(restore).click(); expect(await page.locator(title).inputValue()).toBe("Recover an uncertain send"); expect(creates).toBe(1);
    await page.locator("#open-learning-candidate-review").click(); await page.locator("#title").waitFor(); expect(await page.locator("#title").inputValue()).toBe("Recover an uncertain send");
    expect(f.a.traps.list()).toHaveLength(0);
  } finally { await browser.close(); server.stop(true); }
}, 15000);

browserTest("a newer edit during practice save persists with the acknowledged baseline for later recovery", async () => {
  const f = learningFixture(); let arrived!: () => void, release!: () => void;
  const started = new Promise<void>(r => { arrived = r; }), pending = new Promise<void>(r => { release = r; });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async req => { const response = await f.handler(req); if (new URL(req.url).pathname === "/api/learning/practice-note") { arrived(); await pending; } return response; } }), browser = await launch();
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(5000);
    await page.goto(`http://127.0.0.1:${server.port}/?token=learning-token` + f.a.hash()); await page.locator(note).fill("Submitted"); await page.locator("#save-learning-practice").click(); await started;
    await page.locator(note).fill("Newer draft"); release(); await page.locator("#save-learning-practice:not([disabled])").waitFor();
    await page.reload(); await page.locator(restore).waitFor(); expect(await page.locator(note).inputValue()).toBe("Submitted");
    expect(await page.locator("#learning-recovery-notice").textContent()).not.toContain("has changed"); await page.locator(restore).click(); expect(await page.locator(note).inputValue()).toBe("Newer draft");
  } finally { release(); await browser.close(); server.stop(true); }
}, 15000);

browserTest("a concurrent update invalidates the selected snapshot instead of retargeting recovery or deletion", async () => {
  const f = learningFixture(), server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: f.handler }), browser = await launch();
  try {
    const context = await browser.newContext(); const a = await context.newPage(), b = await context.newPage(), c = await context.newPage();
    for (const page of [a, b, c]) page.setDefaultTimeout(5000);
    const url = `http://127.0.0.1:${server.port}/?token=learning-token` + f.a.hash();
    await a.goto(url); await a.locator(note).fill("Selected old draft"); await b.goto(url); await b.locator(note).fill("Unrelated draft");
    await c.goto(url); await choose(c, "practice", "Selected old draft");
    await a.locator(note).fill("Selected draft has changed");
    await c.waitForFunction(() => (document.querySelector("#learning-recovery-choice") as HTMLSelectElement)?.value === "");
    expect(await c.locator(restore).isDisabled()).toBe(true); expect(await c.locator("#learning-recovery-delete").isDisabled()).toBe(true);
    expect((await snapshots(c)).map(r => r.value).sort()).toEqual(["Selected draft has changed", "Unrelated draft"]);
    await choose(c, "practice", "Selected draft has changed"); await c.locator(restore).click(); expect(await c.locator(note).inputValue()).toBe("Selected draft has changed");
  } finally { await browser.close(); server.stop(true); }
}, 15000);

browserTest("denying all localStorage access leaves Learning drafts editable and explicitly savable", async () => {
  const f = learningFixture(), server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: f.handler }), browser = await launch();
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(5000); const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    await page.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Denied", "SecurityError"); } }));
    await page.goto(`http://127.0.0.1:${server.port}/?token=learning-token` + f.a.hash()); await page.locator(note).fill("Save with storage denied");
    expect(await page.locator("#learning-draft-storage").textContent()).toContain("could not be updated or read");
    await page.locator("#save-learning-practice").click(); await page.locator("#save-learning-practice:not([disabled])").waitFor();
    await page.reload(); await page.locator(note).waitFor(); expect(await page.locator(note).inputValue()).toBe("Save with storage denied"); expect(errors).toEqual([]);
  } finally { await browser.close(); server.stop(true); }
}, 15000);
