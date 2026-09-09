import { test, expect } from "bun:test";
import {
  launchBrowser,
  configureBrowserPage,
  browserTestTimeout,
} from "./browser-helper";
import { learningFixture } from "./web-learning-fixture";
test(
  "Learning search displays semantic snippets and ignores late responses after query changes",
  async () => {
    const f = learningFixture();
    let release!: () => void, arrive!: () => void;
    const pending = new Promise<void>((r) => (release = r)),
      arrived = new Promise<void>((r) => (arrive = r));
    const server = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        fetch: async (req) => {
          const u = new URL(req.url);
          if (u.pathname === "/api/learning/reindex") {
            expect((await req.json()).projectRoot).toBe(f.a.root);
            return Response.json({success:true,project_root:f.a.root,fresh:9});
          }
          if (u.pathname === "/api/learning/search") {
            const query = u.searchParams.get("q")!;
            if (query === "old") {
              arrive();
              await pending;
            }
            if (query === "broken")
              return Response.json(
                { error: "temporary failure" },
                { status: 500 },
              );
            return Response.json({
              project_root: f.a.root,
              scope: u.searchParams.get("scope"),
              query,
              mode: "hybrid",
              results: [
                {
                  library_key:
                    f.a.root + "::" + (query === "old" ? "one" : "two"),
                  project_root: f.a.root,
                  snippet: "A relevant meaning without the query wording",
                  sources: ["semantic"],
                },
              ],
              diagnostics: [],
            });
          }
          return f.handler(req);
        },
      }),
      browser = await launchBrowser();
    try {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 960 },
      });
      configureBrowserPage(page);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        `http://127.0.0.1:${server.port}/?token=learning-token` + f.a.hash(),
      );
      await page.locator("#learning-search").fill("old");
      await arrived;
      await page.locator("#learning-search").fill("paraphrase");
      await page.locator(".learning-match-snippet").waitFor();
      expect(
        await page.locator(".learning-match-snippet").innerText(),
      ).toContain("relevant meaning");
      expect(await page.locator("[data-learning-insight]").count()).toBe(1);
      expect(
        await page
          .locator("[data-learning-insight]")
          .getAttribute("data-learning-insight"),
      ).toBe(f.a.root + "::two");
      release();
      await page.locator("#learning-search").fill("broken");
      await page
        .getByRole("button", { name: "Retry search", exact: true })
        .waitFor();
      await page.locator("#learning-search").fill("");
      await page.locator("[data-learning-insight]").first().waitFor();
      expect(await page.locator("[data-learning-insight]").count()).toBe(4);
      await page.getByRole("button",{name:"Index current project",exact:true}).click();
      await page.getByText("Learning index updated: 9 passages",{exact:true}).waitFor();
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      release?.();
      await browser.close();
      server.stop(true);
    }
  },
  browserTestTimeout(30000),
);
