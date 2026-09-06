import { chromeExecutablePath, launchBrowser } from "./browser-helper";
import { expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { reviewFixture } from "./web-review-fixture";
import { webSuiteFixture } from "./project-eval-suite-fixture";
import { webProjectRouteRef } from "../web/project-registry";
import { readProjectSuite, PROJECT_EVAL_SUITE } from "../lib/project-eval-suite";
const chrome = chromeExecutablePath();
const browserTest = chrome ? test : test.skip;
async function editLesson(page: import("playwright-core").Page) {
  await page.locator("#title").waitFor({ state: "attached" });
  if (!(await page.locator("#title").isVisible())) await page.locator("#review-edit-toggle").click();
}
const restore = "[data-draft-restore]";
async function launch() { return launchBrowser(); }

browserTest("Review reload recovery is explicit, raw, source-bound, and cannot restore an outdated candidate", async () => {
  const f = reviewFixture(); let writes = 0;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: req => { if (req.method === "POST") writes++; return f.handler(req); } }), browser = await launch();
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(5000); const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    const root = `http://127.0.0.1:${server.port}/?token=review-token`;
    await page.goto(root + f.a.hash()); await editLesson(page); await page.locator("#title").fill(" Raw <draft> "); await page.locator("#fix").fill("line one\nline two");
    await page.reload(); await page.locator(restore).waitFor(); expect(await page.locator("#title").inputValue()).toBe("First alpha");
    await page.locator(restore).click(); expect(await page.locator("#title").inputValue()).toBe(" Raw <draft> "); expect(await page.locator("#fix").inputValue()).toBe("line one\nline two"); expect(writes).toBe(0);
    await page.goto(root + f.b.hash()); await page.locator("#title").waitFor({ state: "attached" }); expect(await page.locator(restore).count()).toBe(0);
    const candidate = f.a.operations.getCandidate(f.a.candidates[0]!.id, f.a.session.id).candidate;
    f.a.operations.saveCandidate({ candidateId: candidate.id, sessionId: f.a.session.id, edit: { ...candidate.trap, title: "Changed source" } });
    await page.goto(root + f.a.hash()); await page.locator(restore).waitFor();
    expect(await page.locator(restore).isDisabled()).toBe(true); expect(await page.locator("#title").inputValue()).toBe("Changed source");
    await page.locator(".form-draft-recovery summary").click(); expect(await page.locator(".learning-recovery-preview").textContent()).toContain(" Raw <draft> ");
    expect(await page.locator(".learning-recovery-preview img").count()).toBe(0); expect(errors).toEqual([]);
  } finally { await browser.close(); server.stop(true); }
}, 20000);

browserTest("Review concurrent tabs keep independent backups and storage failures leave explicit Save usable", async () => {
  const f = reviewFixture(), server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: f.handler }), browser = await launch();
  try {
    const context = await browser.newContext(), a = await context.newPage(), b = await context.newPage();
    for (const page of [a, b]) page.setDefaultTimeout(5000);
    const url = `http://127.0.0.1:${server.port}/?token=review-token` + f.a.hash();
    await a.goto(url); await editLesson(a); await a.locator("#title").fill("A draft"); await b.goto(url); await editLesson(b); await b.locator("#title").fill("B draft"); expect(await b.locator(restore).isDisabled()).toBe(true);
    await b.reload(); await b.locator(restore).waitFor(); expect(await b.locator("[data-draft-choice] option").count()).toBe(2);
    await b.locator("[data-draft-delete]").click(); expect(await a.locator("#title").inputValue()).toBe("A draft");
    await a.evaluate(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if (k.startsWith("codetrap-form-draft:")) throw new Error("quota"); return set.call(this, k, v); }; });
    await editLesson(a); await a.locator("#title").fill("Save despite quota"); expect(await a.locator(".form-draft-recovery").textContent()).toContain("could not be backed up");
    await a.locator("#save").click(); await a.locator("#review-discard").waitFor({ state: "detached" });
    expect(f.a.operations.getCandidate(f.a.candidates[0]!.id, f.a.session.id).candidate.trap.title).toBe("Save despite quota");
  } finally { await browser.close(); server.stop(true); }
}, 20000);

browserTest("Evaluation case and run parameter recovery requires unchanged context and never replays preview or execution", async () => {
  const f = webSuiteFixture();
  const preview = await (await f.api("/preview?origin=library")).json(); await f.api("/create", { origin: "library", digest: preview.digest, executor: "user" });
  let writes = 0;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: req => { if (req.method === "POST") writes++; return f.handler(req); } }), browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); page.setDefaultTimeout(5000); const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.port}/?token=suite-token#/impact/evals?project=${webProjectRouteRef(f.project)}`);
    await page.locator('[data-suite="case"]').click(); const dialog = page.locator(".suite-dialog");
    await dialog.locator('[name="query"]').fill(" raw transaction \nrollback "); await dialog.locator('[name="gold"]').check();
    await page.reload(); await page.locator('[data-suite="case"]').click(); await dialog.locator(restore).click();
    expect(await dialog.locator('[name="query"]').inputValue()).toBe(" raw transaction \nrollback "); expect(await dialog.locator('[name="gold"]').isChecked()).toBe(true);
    expect(await dialog.locator('[data-case-accept]').isDisabled()).toBe(true); expect(writes).toBe(0);
    expect(await dialog.evaluate(n => n.scrollWidth <= n.clientWidth)).toBe(true);
    await dialog.locator('[data-suite-close]').click();
    const path = join(f.project, PROJECT_EVAL_SUITE), suite = JSON.parse(readFileSync(path, "utf8"));
    suite.queries.push({ query: "transaction", mode: "fts", goldTrapIds: [1], judgment: "useful_hit" }); writeFileSync(path, JSON.stringify(suite));
    await page.reload(); await page.locator('[data-suite="case"]').click(); expect(await dialog.locator(restore).isDisabled()).toBe(true);
    await dialog.locator('[data-suite-close]').click();
    await page.locator('[data-controlled-eval-form] [name="seed"]').fill(" Raw seed ");
    await page.reload(); const runRecovery = page.locator(".form-draft-recovery").filter({ has: page.locator(restore) });
    await runRecovery.locator(restore).click(); expect(await page.locator('[data-controlled-eval-form] [name="seed"]').inputValue()).toBe(" Raw seed "); expect(writes).toBe(0);
    expect(readProjectSuite(f.project).fixture.queries).toHaveLength(1); expect(errors).toEqual([]);
  } finally { await browser.close(); server.stop(true); }
}, 25000);

browserTest("observed evaluation drafts survive switching findings and reload, and reject an unrelated mutation acknowledgment", async () => {
  const f = webSuiteFixture();
  const { ObservationRunRecorder } = await import("../lib/observation-recorder"), { openObservationLedgerReadOnly } = await import("../lib/observation-ledger");
  const recorder = new ObservationRunRecorder(f.project);
  for (const id of [1, 2]) {
    const context = { run_id: "case-" + id, device_id: "test" };
    recorder.start({ ...context, source_client: "codex", source_session_ref: null, repository_revision: null, branch: null, model_provider: null, model_name: null, completeness: "partial" });
    recorder.missed({ ...context, query: "question " + id, expected_trap_id: id });
  }
  const ledger = openObservationLedgerReadOnly(f.project)!, candidates = ledger.evals().candidate_groups.map(g => g.representative_id); ledger.close(); expect(candidates).toHaveLength(2);
  const preview = await (await f.api("/preview?origin=library")).json(); await f.api("/create", { origin: "library", digest: preview.digest, executor: "user" });
  let writes = 0;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: req => {
    if (req.method === "POST") { writes++; if (new URL(req.url).pathname.endsWith("eval-candidate/draft")) return Response.json({ success: true, observation_candidate_id: "unrelated", preview: [] }); }
    return f.handler(req);
  } }), browser = await launch();
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(5000); const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.port}/?token=suite-token#/impact/evals?project=${webProjectRouteRef(f.project)}`);
    const choose = (id: string) => page.locator(`[data-eval-review="${id}"]`).click();
    const form = page.locator("[data-eval-review-form]");
    await choose(candidates[0]!);
    const { GovernedEvalOperations } = await import("../lib/governed-eval-operations"), { TrapOperations } = await import("../lib/trap-operations"), { TrapStore } = await import("../lib/store");
    new GovernedEvalOperations(f.project, new TrapOperations(new TrapStore(f.project, undefined, f.home))).draft(candidates[0]!, { query: "external new question", mode: "fts", judgment: "miss", goldTrapIds: [1], note: "external note" });
    await page.locator('[data-impact-tab="evals"]').click();
    await page.waitForFunction(() => document.querySelector<HTMLTextAreaElement>('[data-eval-review-form] [name="query"]')?.value === "external new question");
    expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith("codetrap-form-draft:")).length)).toBe(0);
    await page.waitForResponse(r => new URL(r.url()).pathname === "/api/observations/evals", { timeout: 7000 });
    expect(await page.locator("[data-eval-deferred-update]").isVisible()).toBe(false);
    await form.locator('[name="query"]').fill("  First\nraw query "); await form.locator('[name="note"]').fill(" note "); await form.locator('[name="goldTrapIds"]').check();
    await choose(candidates[1]!); await form.locator('[name="query"]').fill("Second query");
    await choose(candidates[0]!); expect(await form.locator('[name="query"]').inputValue()).toBe("  First\nraw query ");
    await page.reload(); await choose(candidates[0]!); await page.locator(".eval-review-workbench " + restore).click();
    expect(await form.locator('[name="query"]').inputValue()).toBe("  First\nraw query "); expect(await form.locator('[name="note"]').inputValue()).toBe(" note "); expect(writes).toBe(0);
    await form.locator('[data-eval-review-save]').click(); await page.locator(".eval-review-error").waitFor();
    expect(await form.locator('[name="query"]').inputValue()).toBe("  First\nraw query ");
    await page.reload(); await choose(candidates[0]!); await page.locator(".eval-review-workbench " + restore).waitFor(); expect(writes).toBe(1); expect(errors).toEqual([]);
  } finally { await browser.close(); server.stop(true); }
}, 25000);

browserTest("accepting an earlier evaluation case cannot delete a new dialog's draft", async () => {
  const f = webSuiteFixture();
  const p = await (await f.api("/preview?origin=library")).json(); await f.api("/create", { origin: "library", digest: p.digest, executor: "user" });
  let release!: () => void, started!: () => void;
  const pending = new Promise<void>(r => { release = r; }), received = new Promise<void>(r => { started = r; });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async req => {
    const result = await f.handler(req);
    if (new URL(req.url).pathname === "/api/eval-suite/case-accept") { started(); await pending; }
    return result;
  } }), browser = await launch();
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(5000);
    await page.goto(`http://127.0.0.1:${server.port}/?token=suite-token#/impact/evals?project=${webProjectRouteRef(f.project)}`);
    await page.locator('[data-suite="case"]').click(); const dialog = page.locator(".suite-dialog");
    await dialog.locator('[name="query"]').fill("first transaction"); await dialog.locator('[name="gold"]').check(); await dialog.locator('[data-case-preview-button]').click();
    await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>("[data-case-accept]")?.disabled);
    await dialog.locator('[data-case-accept]').click(); await received; await dialog.locator('[data-suite-close]').click();
    await page.locator('[data-suite="case"]').click(); await dialog.locator('[name="query"]').fill("second unsaved query");
    const response = page.waitForResponse(r => new URL(r.url()).pathname === "/api/eval-suite/case-accept"); release(); await response;
    await page.waitForFunction(() => document.querySelector("[data-suite='case']"));
    const saved = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith("codetrap-form-draft:")).map(k => JSON.parse(localStorage.getItem(k)!)));
    expect(saved.some(s => s.fields.query === "second unsaved query")).toBe(true);
    expect(await dialog.locator('[name="query"]').inputValue()).toBe("second unsaved query");
    await page.reload(); await page.locator('[data-suite="case"]').click(); await dialog.locator(restore).waitFor();
    await dialog.locator(".form-draft-recovery summary").click(); expect(await dialog.locator(".learning-recovery-preview").textContent()).toContain("second unsaved query");
  } finally { release(); await browser.close(); server.stop(true); }
}, 20000);
