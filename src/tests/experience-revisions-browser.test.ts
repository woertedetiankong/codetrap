import { chromeExecutablePath, launchBrowser } from "./browser-helper";
import { expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { revisionFixture, revisionInput } from "./experience-revision-fixture";
import { createWebHandler } from "../web/server";
import { webProjectRouteRef } from "../web/project-registry";
import { openObservationLedgerReadOnly } from "../lib/observation-ledger";

const chrome = chromeExecutablePath();
(chrome ? test : test.skip)("bundled revision UI completes feedback, tests, approval, reopening and rollback on desktop and mobile", async () => {
  const f = revisionFixture();
  const bundle = await Bun.build({ entrypoints: [fileURLToPath(new URL("../web/static.ts", import.meta.url))], target: "bun", format: "esm" });
  expect(bundle.success).toBe(true);
  const bundlePath = join(f.home, "revision-web.mjs");
  await Bun.write(bundlePath, bundle.outputs[0]!);
  const { WEB_INDEX_HTML } = await import(pathToFileURL(bundlePath).href);
  const handler = createWebHandler({ token: "revision-test-token", cwd: f.project, currentProjectRoot: f.project, home: f.home });
  let loseFeedbackResponse = true;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async req => {
    if (new URL(req.url).pathname === "/") return new Response(WEB_INDEX_HTML, { headers: { "Content-Type": "text/html" } });
    const response = await handler(req);
    if (new URL(req.url).pathname.endsWith("/experience-revisions/feedback") && loseFeedbackResponse) {
      loseFeedbackResponse = false;
      return new Response(JSON.stringify({ error: "Simulated lost response" }), { status: 503, headers: { "Content-Type": "application/json" } });
    }
    return response;
  } });
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(5000);
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    const root = `http://127.0.0.1:${server.port}/?token=revision-test-token`;
    const ref = webProjectRouteRef(f.project);
    await page.goto(root + `#/impact/runs/${f.call.run_id}?project=${ref}`);
    await page.locator('[data-ia="inspect"]').waitFor();
    expect(await page.locator('.rail').isVisible()).toBe(false);
    expect(await page.locator('.app-topbar').isVisible()).toBe(false);
    await page.locator('[data-ia="inspect"]').click();
    const sheet = page.locator('.ia-sheet');
    expect(await sheet.locator('textarea').count()).toBe(0);
    expect(await sheet.textContent()).toContain('Animation timing');
    await sheet.locator('[data-ia="job"]').click();
    await sheet.waitFor({state:'hidden'});
    const workspace = page.locator('[data-revision-workspace]');
    await workspace.locator('[data-rw-feedback="irrelevant"]').click();
    await workspace.getByRole('alert').filter({hasText:'Simulated lost response'}).waitFor();
    await workspace.locator('[data-rw-feedback="irrelevant"]').click();
    await page.waitForFunction(()=>document.querySelector('[data-rw-feedback="irrelevant"]')?.getAttribute('aria-pressed')==='true');
    const ledger = openObservationLedgerReadOnly(f.project)!;
    expect(ledger.listRunEvents(f.call.run_id).filter(e=>e.type==='trap/feedback-recorded')).toHaveLength(1);ledger.close();
    await workspace.locator('[data-rw-step="2"]').last().click();
    for (const key of ['title','context','mistake','fix','reason'] as const) await workspace.locator(`[name="${key}"]`).fill(revisionInput[key]);
    await workspace.locator('[name="tags"]').fill('transaction');
    const draftRoute = new URL(page.url()).hash;
    await page.locator('.ia-nav [data-page="overview"]').click();
    await page.locator('.ia-nav [data-page="improve"]').click();
    expect(await workspace.locator('[name="reason"]').inputValue()).toBe(revisionInput.reason);
    await workspace.locator('[data-rw-step="3"]').last().click();
    await workspace.locator('[name="positive"]').fill('transaction');
    await workspace.locator('[name="negative"]').fill('animation');
    await workspace.locator('[data-rw-action="evaluate"]').click();
    await page.waitForFunction(()=>!document.querySelector<HTMLButtonElement>('[data-rw-action="accept"]')?.disabled);
    expect(await workspace.locator('.ia-table tbody tr').count()).toBe(2);
    await workspace.locator('[data-rw-step="2"]').first().click();
    await workspace.locator('[name="fix"]').fill('Bound transaction retries and report the error');
    await workspace.locator('[data-rw-step="3"]').last().click();
    expect(await workspace.locator('[data-rw-action="accept"]').isDisabled()).toBe(true);
    await workspace.locator('[data-rw-action="evaluate"]').click();
    await page.waitForFunction(()=>!document.querySelector<HTMLButtonElement>('[data-rw-action="accept"]')?.disabled);
    if(process.env.CODETRAP_REVISION_SCREENSHOTS){mkdirSync(process.env.CODETRAP_REVISION_SCREENSHOTS,{recursive:true});await page.screenshot({path:join(process.env.CODETRAP_REVISION_SCREENSHOTS,'revision-desktop.png')});}
    await workspace.locator('[data-rw-action="accept"]').click();
    await workspace.locator('[data-rw-action="rollback"]').waitFor();
    expect(f.store.getDetails(1,'project')!.trap.title).toBe(revisionInput.title);
    await workspace.locator('[data-rw-action="verification"]').click();
    await page.locator('[data-rw-filter="changed"]').click();
    expect(await page.locator('.ia-table tbody tr').count()).toBe(2);
    const dialog = page.locator('.revision-dialog');
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    if(process.env.CODETRAP_REVISION_SCREENSHOTS)await page.screenshot({path:join(process.env.CODETRAP_REVISION_SCREENSHOTS,'impact-verification-mobile.png')});
    await page.goto(root + `#/library/project/1?project=${ref}`);
    await page.locator('[data-locale="zh"]').click();
    await page.locator("[data-revision-id]").click();
    await dialog.locator('[data-action="rollback"]').waitFor();
    expect(await dialog.locator('[name="fix"]').inputValue()).toContain("report the error");
    expect(await dialog.locator("h2").textContent()).toBe("让经验更准确");
    const sizes = await dialog.evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth, height: node.clientHeight }));
    expect(sizes.scroll).toBeLessThanOrEqual(sizes.width);
    expect(sizes.height).toBeGreaterThan(700);
    if (process.env.CODETRAP_REVISION_SCREENSHOTS) {
      await dialog.evaluate(node => { node.scrollTop = 0; });
      await page.screenshot({ path: join(process.env.CODETRAP_REVISION_SCREENSHOTS, "revision-mobile.png") });
    }
    await dialog.locator('[data-action="rollback"]').click();
    await page.waitForFunction(() => document.querySelector('.revision-dialog .revision-status')?.textContent === "已回滚");
    expect(f.store.getDetails(1, "project")!.trap.title).toBe(f.before.title);
    await dialog.locator('[data-action="close"]').click();
    await page.reload();
    await page.locator('[data-revision-id] .pill').filter({ hasText: "已回滚" }).waitFor();
    expect(errors).toEqual([]);
  } finally { await browser.close(); server.stop(true); }
}, 40000);
