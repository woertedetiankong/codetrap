import { expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { webSuiteFixture } from "./project-eval-suite-fixture";
import { readProjectSuite, PROJECT_EVAL_SUITE } from "../lib/project-eval-suite";
import { webProjectRouteRef } from "../web/project-registry";

const chrome = [process.env.CODETRAP_TEST_BROWSER, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/chromium", "/usr/bin/google-chrome"].find(p => p && existsSync(p));
(chrome ? test : test.skip)("bundled ordinary-project workflow previews a corpus, reviews examples, runs comparisons and downloads a portable suite", async () => {
  const f = webSuiteFixture();
  const bundle = await Bun.build({ entrypoints: [fileURLToPath(new URL("../web/static.ts", import.meta.url))], target: "bun", format: "esm" });
  expect(bundle.success).toBe(true);
  const path = join(f.home, "eval-suite-web.mjs");
  await Bun.write(path, bundle.outputs[0]!);
  const { WEB_INDEX_HTML } = await import(pathToFileURL(path).href);
  let loseAcceptanceResponse = true;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async req => {
    if (new URL(req.url).pathname === "/") return new Response(WEB_INDEX_HTML, { headers: { "Content-Type": "text/html" } });
    const result = await f.handler(req);
    if (new URL(req.url).pathname === "/api/eval-suite/case-accept" && loseAcceptanceResponse) {
      loseAcceptanceResponse = false;
      return new Response(JSON.stringify({ error: "Lost response after a successful write" }), { status: 503 });
    }
    return result;
  } });
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ executablePath: chrome!, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    page.setDefaultTimeout(5000);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    const url = `http://127.0.0.1:${server.port}/?token=suite-token#/impact/evals?project=${webProjectRouteRef(f.project)}`;
    await page.goto(url);
    await page.locator('[data-suite="library"]').click();
    const dialog = page.locator(".suite-dialog");
    await dialog.locator('[data-suite-create]').waitFor();
    expect(existsSync(join(f.project, PROJECT_EVAL_SUITE))).toBe(false);
    await dialog.locator('summary').click();
    expect(await dialog.textContent()).toContain("project #1");
    await dialog.locator('[data-suite-create]').click();
    await dialog.getByText("Evaluation set created.", { exact: true }).waitFor();
    await dialog.locator('[data-suite-close]').click();
    await page.locator('[data-suite="case"]').click();
    await dialog.locator('[name="query"]').fill("transaction rollback");
    await dialog.locator('[name="gold"]').check();
    expect(await dialog.locator('[data-case-accept]').isDisabled()).toBe(true);
    await dialog.locator('[data-case-preview-button]').click();
    await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('[data-case-accept]')?.disabled);
    await dialog.locator('[name="query"]').fill("transaction");
    expect(await dialog.locator('[data-case-accept]').isDisabled()).toBe(true);
    await dialog.locator('[data-case-preview-button]').click();
    await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('[data-case-accept]')?.disabled);
    if (process.env.CODETRAP_SUITE_SCREENSHOTS) {
      mkdirSync(process.env.CODETRAP_SUITE_SCREENSHOTS, { recursive: true });
      await page.screenshot({ path: join(process.env.CODETRAP_SUITE_SCREENSHOTS, "suite-desktop.png") });
    }
    await dialog.locator('[data-case-accept]').click();
    await dialog.getByRole("alert").filter({ hasText: "Lost response" }).waitFor();
    expect(readProjectSuite(f.project).fixture.queries).toHaveLength(1);
    await dialog.locator('[data-case-accept]').click();
    await dialog.getByText("Saved with a receipt.", { exact: true }).waitFor();
    expect(readProjectSuite(f.project).fixture.queries).toHaveLength(1);
    await dialog.locator('[data-suite-close]').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-locale="zh"]').click();
    await page.locator('[data-suite="case"]').click();
    await dialog.locator('[name="query"]').fill("unrelatedxyz");
    await dialog.locator('[name="judgment"]').selectOption("no_relevant_trap");
    expect(await dialog.locator('[name="gold"]').isDisabled()).toBe(true);
    await dialog.locator('[data-case-preview-button]').click();
    await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('[data-case-accept]')?.disabled);
    expect(await dialog.locator('h2').textContent()).toBe("添加评测例子");
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    if (process.env.CODETRAP_SUITE_SCREENSHOTS) await page.screenshot({ path: join(process.env.CODETRAP_SUITE_SCREENSHOTS, "suite-mobile.png") });
    await dialog.locator('[data-case-accept]').click();
    await dialog.getByText("已保存并生成回执。", { exact: true }).waitFor();
    await dialog.locator('[data-suite-close]').click();
    const result = page.waitForResponse(response => response.url().endsWith("/api/observations/controlled-evals/run"));
    await page.locator('.controlled-run-button').click();
    expect((await result).status()).toBe(200);
    await page.locator('[data-controlled-history]').waitFor();
    await page.reload();
    await page.locator('[data-controlled-history]').waitFor();
    const downloadPromise = page.waitForEvent("download");
    await page.locator('[data-suite="export"]').click();
    const download = await downloadPromise;
    const exported = JSON.parse(readFileSync((await download.path())!, "utf8"));
    expect(exported.queries).toHaveLength(2);
    expect(exported.codetrap_suite.refs[0]).toMatchObject({ fixture_id: 1, scope: "project", trap_id: 1 });
    expect(existsSync(join(f.project, "src"))).toBe(false);
    expect(existsSync(join(f.project, ".codetrap/observations"))).toBe(false);
    writeFileSync(join(f.project, PROJECT_EVAL_SUITE), "broken active suite");
    await page.reload();
    await page.locator('[data-controlled-history]').waitFor();
    expect(await page.locator('.controlled-run-button').isDisabled()).toBe(true);
    expect(errors).toEqual([]);
  } finally { await browser.close(); server.stop(true); }
}, 25000);
