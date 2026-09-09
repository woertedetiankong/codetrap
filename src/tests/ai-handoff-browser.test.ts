import { expect, test } from "bun:test";
import {
  launchBrowser,
  configureBrowserPage,
  browserTestTimeout,
} from "./browser-helper";
import { learningFixture } from "./web-learning-fixture";
test(
  "AI task card keeps explicit destinations, reports copy honestly, supports manual fallback and phone layout",
  async () => {
    const f = learningFixture(),
      server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: f.handler }),
      browser = await launchBrowser();
    try {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 960 },
      });
      configureBrowserPage(page);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(() => {
        localStorage.setItem("codetrap-queue-collapsed", "false");
        Object.defineProperty(navigator, "clipboard", {
          value: {
            writeText: async (text: string) => {
              (window as any).copied = text;
            },
          },
        });
      });
      await page.goto(
        `http://127.0.0.1:${server.port}/?token=learning-token` + f.a.hash(),
      );
      await page.locator(".ai-handoff-launch > summary").click();
      const card = page.locator("#ai-handoff-catalog");
      await card.locator("select").nth(1).selectOption("both");
      await card
        .locator("textarea")
        .first()
        .fill("https://example.com/article");
      await card.locator("button").click();
      await card
        .locator("[role=status]")
        .filter({ hasText: /Copied|已复制/ })
        .waitFor();
      expect(await page.evaluate(() => (window as any).copied)).toContain(
        f.a.root,
      );
      expect(await page.evaluate(() => (window as any).copied)).toContain(
        "https://example.com/article",
      );
      await card.locator("select").first().selectOption("html");
      expect(await card.locator("select").nth(1).inputValue()).toBe("learning");
      expect(await card.locator("select").nth(1).isDisabled()).toBe(true);
      await page.evaluate(() => {
        (navigator.clipboard as any).writeText = async () => {
          throw new Error("blocked");
        };
      });
      await card.locator("button").click();
      await card.locator("details[open] textarea").waitFor();
      expect(await card.locator("[role=status]").innerText()).toMatch(
        /manually|Select and copy|手动/,
      );
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
      server.stop(true);
    }
  },
  browserTestTimeout(30000),
);

test(
  "empty-library task draft follows the user from desktop to phone without duplicate visible cards",
  async () => {
    const { writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const f = learningFixture();
    for (const project of [f.a, f.b])
      writeFileSync(
        join(project.root, ".codetrap/phase2/insights.json"),
        JSON.stringify({
          version: 2,
          insights: [],
          collections: [],
          collection_items: [],
        }),
      );
    const server = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        fetch: f.handler,
      }),
      browser = await launchBrowser();
    try {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 960 },
      });
      configureBrowserPage(page);
      await page.goto(
        `http://127.0.0.1:${server.port}/?token=learning-token#/learning?project=${f.a.ref}`,
      );
      const desktop = page.locator("#copy-learning-prompt");
      await desktop.locator("textarea").first().fill("Draft source");
      await desktop.locator("select").nth(1).selectOption("both");
      expect(await page.locator(".ai-handoff:visible").count()).toBe(1);
      await page.setViewportSize({ width: 390, height: 844 });
      const phone = page.locator("#copy-learning-prompt-mobile");
      expect(await phone.locator("textarea").first().inputValue()).toBe(
        "Draft source",
      );
      expect(await phone.locator("select").nth(1).inputValue()).toBe("both");
      expect(await page.locator(".ai-handoff:visible").count()).toBe(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    } finally {
      await browser.close();
      server.stop(true);
    }
  },
  browserTestTimeout(30000),
);
