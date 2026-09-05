import { expect, test } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { revisionFixture, revisionInput } from "./experience-revision-fixture";
import { createWebHandler } from "../web/server";
import { webProjectRouteRef } from "../web/project-registry";
import { openObservationLedgerReadOnly } from "../lib/observation-ledger";

const chrome = [process.env.CODETRAP_TEST_BROWSER, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/chromium", "/usr/bin/google-chrome"].find(p => p && existsSync(p));
(chrome ? test : test.skip)("bundled revision UI completes feedback, tests, approval, reopening and rollback on desktop and mobile", async () => {
  const { chromium } = await import("playwright-core");
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
  const browser = await chromium.launch({ executablePath: chrome!, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(5000);
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    const root = `http://127.0.0.1:${server.port}/?token=revision-test-token`;
    const ref = webProjectRouteRef(f.project);
    await page.goto(root + `#/impact/runs/${f.call.run_id}?project=${ref}`);
    const entry = page.locator(`[data-experience-review="${f.exposure.id}"]`);
    await page.locator(".impact-event.cat-expose summary").click();
    await entry.click();
    const dialog = page.locator(".revision-dialog");
    await dialog.locator('[name="reason"]').fill(revisionInput.reason);
    expect(await dialog.locator('[data-action="save"]').isDisabled()).toBe(true);
    // Typing remains intact across failed feedback and an idempotent retry.
    await dialog.locator('[data-feedback="irrelevant"]').click();
    await dialog.getByRole("alert").filter({ hasText: "Simulated lost response" }).waitFor();
    expect(await dialog.locator('[name="reason"]').inputValue()).toBe(revisionInput.reason);
    await dialog.locator('[data-feedback="irrelevant"]').click();
    await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('[data-action="save"]')?.disabled);
    const ledger = openObservationLedgerReadOnly(f.project)!;
    expect(ledger.listRunEvents(f.call.run_id).filter(e => e.type === "trap/feedback-recorded")).toHaveLength(1);
    ledger.close();
    for (const key of ["title", "context", "mistake", "fix"] as const) await dialog.locator(`[name="${key}"]`).fill(revisionInput[key]);
    await dialog.locator('[name="tags"]').fill("transaction");
    await dialog.locator('[name="positive"]').fill("transaction");
    await dialog.locator('[name="negative"]').fill("animation");
    await dialog.locator('[data-action="evaluate"]').click();
    await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('[data-action="accept"]')?.disabled);
    expect(await dialog.locator(".revision-pass").count()).toBe(2);
    await dialog.locator('[name="fix"]').fill("Bound transaction retries and report the error");
    expect(await dialog.locator('[data-action="accept"]').isDisabled()).toBe(true);
    await dialog.locator('[data-action="evaluate"]').click();
    await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('[data-action="accept"]')?.disabled);
    if (process.env.CODETRAP_REVISION_SCREENSHOTS) {
      mkdirSync(process.env.CODETRAP_REVISION_SCREENSHOTS, { recursive: true });
      await dialog.evaluate(node => { node.scrollTop = node.scrollHeight; });
      await page.screenshot({ path: join(process.env.CODETRAP_REVISION_SCREENSHOTS, "revision-desktop.png") });
    }
    await dialog.locator('[data-action="accept"]').click();
    await dialog.locator('[data-action="rollback"]').waitFor();
    expect(f.store.getDetails(1, "project")!.trap.title).toBe(revisionInput.title);
    await dialog.locator('[data-action="close"]').click();
    await page.setViewportSize({ width: 390, height: 844 });
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
}, 25000);
