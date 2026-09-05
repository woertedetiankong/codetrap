import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { webSuiteFixture } from "./project-eval-suite-fixture";
import { webProjectRouteRef } from "../web/project-registry";

const chrome = [process.env.CODETRAP_TEST_BROWSER, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/chromium", "/usr/bin/google-chrome"].find(path => path && existsSync(path));
const browserTest = chrome ? test : test.skip;

for (const failure of ["unauthorized-html", "invalid-bootstrap"] as const) {
  browserTest(`browser entry recovers from ${failure} without mounting a broken workspace or losing its route`, async () => {
    const f = webSuiteFixture();
    let fail = true;
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: req => {
      if (new URL(req.url).pathname === "/api/bootstrap" && fail) return failure === "unauthorized-html"
        ? new Response("<html>Session expired</html>", { status: 401 }) : Response.json({ projects: [{}], options: {} });
      return f.handler(req);
    } });
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({ executablePath: chrome!, headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
      page.setDefaultTimeout(5000);
      await page.addInitScript(() => localStorage.setItem("codetrap-locale", "zh"));
      const hash = "#/impact/evals?project=" + webProjectRouteRef(f.project);
      await page.goto(`http://127.0.0.1:${server.port}/?token=suite-token` + hash);
      await page.locator("#bootstrap-failure").waitFor({ state: "visible" });
      expect(await page.locator("#app-shell").count()).toBe(0);
      expect(new URL(page.url()).searchParams.has("token")).toBe(false);
      expect(new URL(page.url()).hash).toBe(hash);
      expect(await page.locator("#bootstrap-command").textContent()).toBe("codetrap web --open");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      fail = false;
      await page.locator("#bootstrap-retry").click();
      await page.locator('[data-suite="library"]').waitFor();
      expect(new URL(page.url()).hash).toBe(hash);
      expect(errors).toEqual([]);
    } finally { await browser.close(); server.stop(true); }
  }, 20000);
}

browserTest("browser entry uses a one-tab launch when storage is blocked", async () => {
  const f = webSuiteFixture();
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: f.handler });
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ executablePath: chrome!, headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
      for (const name of ["localStorage", "sessionStorage"]) Object.defineProperty(window, name, { get() { throw new DOMException("Blocked", "SecurityError"); } });
    });
    await page.goto(`http://127.0.0.1:${server.port}/?token=suite-token#/impact/evals?project=${webProjectRouteRef(f.project)}`);
    await page.locator('[data-suite="library"]').waitFor();
    expect(new URL(page.url()).searchParams.has("token")).toBe(false);
    expect(errors).toEqual([]);
  } finally { await browser.close(); server.stop(true); }
}, 20000);
