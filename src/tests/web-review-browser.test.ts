import { chromeExecutablePath, dataSelector, launchBrowser } from "./browser-helper";
import { expect, test } from "bun:test";
import { reviewFixture } from "./web-review-fixture";
import { Phase2Operations } from "../lib/phase2-operations";
import { TrapOperations } from "../lib/trap-operations";
import { webProjectRouteRef } from "../web/project-registry";
const chrome = chromeExecutablePath();
const browserTest = chrome ? test : test.skip;
async function editLesson(page: import("playwright-core").Page) {
  await page.locator("#title").waitFor({ state: "attached" });
  if (!(await page.locator("#title").isVisible())) await page.locator("#review-edit-toggle").click();
}
const settle = async (page: import("playwright-core").Page) => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

browserTest("Review restores each candidate's draft across locale, view, project and phone history navigation", async () => {
  const f = reviewFixture();
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: f.handler });
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }); page.setDefaultTimeout(5000);
    const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem("codetrap-queue-collapsed", "false"));
    await page.goto(`http://127.0.0.1:${server.port}/?token=review-token` + f.a.hash());
    await page.locator("#review-preview").waitFor();
    expect(await page.locator("#review-preview").isVisible()).toBe(true);
    expect(await page.locator("#title").isVisible()).toBe(false);
    await editLesson(page); await page.locator("#title").fill("Alpha <raw> unsaved"); await page.locator("#fix").fill("First line\nSecond line");
    await page.locator("#review-edit-toggle").click();
    expect(await page.locator('[data-review-preview="title"]').textContent()).toBe("Alpha <raw> unsaved");
    expect(await page.locator('[data-review-preview="fix"]').textContent()).toBe("First line\nSecond line");
    expect(await page.locator("#review-preview raw").count()).toBe(0);
    await editLesson(page);
    await page.locator(`[data-candidate='${f.a.candidates[1]!.id}']`).click();
    await editLesson(page); await page.locator("#title").fill("Second unsaved");
    await page.locator(`[data-candidate='${f.a.candidates[0]!.id}']`).click();
    expect(await page.locator("#title").inputValue()).toBe("Alpha <raw> unsaved");
    expect(await page.locator("#fix").inputValue()).toBe("First line\nSecond line");
    await page.locator('[data-locale="zh"]').click();
    expect(await page.locator("#title").inputValue()).toBe("Alpha <raw> unsaved");
    await page.locator('[data-main-view="library"]').click();
    await page.goBack(); await page.locator("#title").waitFor({ state: "attached" });
    expect(await page.locator("#title").inputValue()).toBe("Alpha <raw> unsaved");
    await page.locator(dataSelector("data-project", f.b.root)).click(); await page.locator("#title").waitFor({ state: "attached" });
    expect(await page.locator("#title").inputValue()).toBe("First beta");
    await editLesson(page); await page.locator("#title").fill("Beta unsaved");
    await page.locator(dataSelector("data-project", f.a.root)).click(); await page.locator("#title").waitFor({ state: "attached" });
    expect(await page.locator("#title").inputValue()).toBe("Alpha <raw> unsaved");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-locale="en"]').click();
    expect(await page.locator("#title").inputValue()).toBe("Alpha <raw> unsaved");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (!(await page.locator(".detail").isVisible())) await page.locator(`[data-candidate='${f.a.candidates[0]!.id}']`).click();
    await page.locator("#reader-back").click();
    expect(await page.locator(".detail").isVisible()).toBe(false);
    expect(new URL(page.url()).hash).toContain("pane=list");
    await page.goBack(); await page.locator("#title").waitFor();
    expect(await page.locator("#title").inputValue()).toBe("Alpha <raw> unsaved");
    await page.locator("#review-discard").click();
    expect(await page.locator("#title").inputValue()).toBe("First alpha");
    expect(errors).toEqual([]);
  } finally { await browser.close(); server.stop(true); }
}, 20000);

browserTest("Review save stays bound during selection changes and accept/reject/rollback retain the visible payload and receipts", async () => {
  const f = reviewFixture(); let release!: () => void, started!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; }), received = new Promise<void>(resolve => { started = resolve; });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async request => {
    const result = await f.handler(request);
    if (new URL(request.url).pathname === "/api/candidate/save") { started(); await pending; }
    return result;
  } });
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }); page.setDefaultTimeout(6000);
    const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem("codetrap-queue-collapsed", "false"));
    await page.goto(`http://127.0.0.1:${server.port}/?token=review-token` + f.a.hash());
    await editLesson(page); await page.locator("#title").fill("Saved from visible draft"); await page.locator("#save").click(); await received;
    expect(await page.locator("#title").isDisabled()).toBe(true);
    await page.locator(`[data-candidate='${f.a.candidates[1]!.id}']`).click();
    release(); await page.waitForFunction(() => !document.querySelector<HTMLInputElement>("#title")?.disabled && document.querySelector<HTMLInputElement>("#title")?.value === "Second alpha");
    expect(new URL(page.url()).hash).toContain(f.a.candidates[1]!.id);
    await page.locator(`[data-candidate='${f.a.candidates[0]!.id}']`).click();
    expect(await page.locator("#title").inputValue()).toBe("Saved from visible draft");
    await editLesson(page); await page.locator("#title").fill("Approved visible draft");
    await page.locator(".candidate-more-actions summary").click(); await page.locator("#approve").click();
    await page.locator("#receipt.show").waitFor();
    expect(f.a.operations.getCandidate(f.a.candidates[0]!.id, f.a.session.id).candidate.trap.title).toBe("Approved visible draft");
    f.a.traps.add(f.a.operations.getCandidate(f.a.candidates[0]!.id, f.a.session.id).candidate.trap);
    await page.locator("#accept").click(); await page.locator("#accept-anyway").waitFor({ state: "attached" });
    expect(await page.locator("#title").inputValue()).toBe("Approved visible draft");
    await page.locator(".candidate-more-actions summary").click(); await page.locator("#accept-anyway").click();
    await page.locator("#rollback").waitFor();
    expect(await page.locator("#receipt").textContent()).toContain(f.a.candidates[0]!.id);
    expect(f.a.operations.getCandidate(f.a.candidates[0]!.id, f.a.session.id).candidate.status).toBe("accepted");
    page.once("dialog", dialog => dialog.accept()); await page.locator("#rollback").click(); await page.locator("#accept").waitFor();
    expect(await page.locator("#title").inputValue()).toBe("Approved visible draft");
    await page.locator("#reject").click(); await page.locator("#reject-reason").fill("Browser regression only"); await page.locator("#reject-confirm").click();
    await page.locator("#receipt.show").waitFor(); await settle(page);
    expect(f.a.operations.getCandidate(f.a.candidates[0]!.id, f.a.session.id).candidate.status).toBe("rejected");
    expect(await page.locator("#receipt").textContent()).toContain(f.a.session.id);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally { release(); await browser.close(); server.stop(true); }
}, 25000);

browserTest("Review insight drafts retain source fields through apply and rollback", async () => {
  const f = reviewFixture();
  const proposal = new Phase2Operations(f.a.root, new TrapOperations(f.a.traps)).propose({ kind: "insight", title: "Prefix study", rationale: "Use exact prefixes", payload: { title: "Prefix study", summary: "Exact prefixes are reusable.", body: "Keep a stable prefix.", tags: ["study"], source_refs: ["https://example.com/study"] } });
  if (proposal.suppressed) throw new Error("Unexpected suppression");
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: f.handler });
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(6000); const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.port}/?token=review-token#/review/${proposal.session.id}/${proposal.candidate.id}?project=${webProjectRouteRef(f.a.root)}`);
    await page.locator("#insight_body").fill("Edited body with a concrete example.");
    await page.locator('[data-locale="zh"]').click();
    expect(await page.locator("#insight_body").inputValue()).toBe("Edited body with a concrete example.");
    await page.locator("#apply-insight").click(); await page.locator("#rollback").waitFor();
    expect(await page.locator("#detail").textContent()).toContain("Edited body with a concrete example.");
    const stored = f.a.operations.getCandidate(proposal.candidate.id, proposal.session.id).candidate;
    expect(stored.destination_payload?.source_refs).toEqual(["https://example.com/study"]);
    page.once("dialog", dialog => dialog.accept()); await page.locator("#rollback").click(); await page.locator("#apply-insight").waitFor();
    expect(await page.locator("#insight_body").inputValue()).toBe("Edited body with a concrete example."); expect(errors).toEqual([]);
  } finally { await browser.close(); server.stop(true); }
}, 20000);

browserTest("Review malformed responses retry and Back escapes an abandoned slow candidate load", async () => {
  const f = reviewFixture(); let malformed = true, blockNext = false, release!: () => void, started!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; }), received = new Promise<void>(resolve => { started = resolve; });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async request => {
    const path = new URL(request.url).pathname;
    if (path === "/api/candidates" && malformed) return Response.json({ candidates: [{}] });
    if (path === "/api/candidates" && blockNext) { blockNext = false; started(); await pending; return new Response("Stale failure", { status: 503 }); }
    return f.handler(request);
  } });
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(5000); const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem("codetrap-queue-collapsed", "false"));
    await page.goto(`http://127.0.0.1:${server.port}/?token=review-token` + f.a.hash());
    await page.locator('#detail [data-review-retry="candidates"]').waitFor();
    malformed = false; await page.locator('#detail [data-review-retry="candidates"]').click(); await page.locator("#title").waitFor({ state: "attached" });
    await editLesson(page); await page.locator("#title").fill("History draft");
    blockNext = true; await page.evaluate(hash => { location.hash = hash; }, f.a.hash("missing")); await received;
    await page.goBack(); await page.locator("#title").waitFor({ state: "attached" });
    expect(await page.locator("#title").inputValue()).toBe("History draft");
    const response = page.waitForResponse(r => r.status() === 503); release(); await response; await settle(page);
    expect(await page.locator("#title").inputValue()).toBe("History draft"); expect(errors).toEqual([]);
  } finally { release(); await browser.close(); server.stop(true); }
}, 20000);
