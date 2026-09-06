import { afterEach } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser } from 'playwright-core';

export function chromeExecutablePath(): string | null {
  const override = process.env.CODETRAP_TEST_BROWSER;
  if (override) {
    if (!existsSync(override)) throw new Error(`CODETRAP_TEST_BROWSER does not exist: ${override}`);
    return override;
  }
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium', '/usr/bin/chromium-browser',
    join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe'),
    join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
    join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
    ...(process.env.LOCALAPPDATA ? [join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe')] : []),
  ];
  const path = candidates.find(candidate => existsSync(candidate)) ?? null;
  if (!path && process.env.CI) throw new Error('CI requires Chromium; install it or set CODETRAP_TEST_BROWSER.');
  return path;
}

const pendingCleanup = new Set<() => Promise<void>>();
afterEach(async () => {
  await Promise.all([...pendingCleanup].map(close => close()));
});

// Keep the version pinned: oop is Playwright's exported driver adapter, but
// it is not part of its stable browser API. Node must own both Chromium's
// extra stdio pipes and the WebSocket transport (oven-sh/bun#31105, #28450).
type Driver = { playwright: Pick<typeof import("playwright-core"), "chromium">; stop(): Promise<void> };
export async function launchBrowser(): Promise<Browser> {
  const executable = chromeExecutablePath();
  if (!executable) throw new Error('No Chromium executable found. Set CODETRAP_TEST_BROWSER.');
  const node = Bun.which('node');
  if (!node) throw new Error('Browser tests require Node.js to run the Playwright driver.');
  const { oop } = require('playwright-core/lib/coreBundle') as { oop: { start(): Promise<Driver> } };
  // oop.start synchronously forks using process.execPath before its first await.
  // Restore immediately so fixtures and CLI subprocesses continue to use Bun.
  const bunPath = process.execPath;
  let starting: Promise<Driver>;
  try { process.execPath = node; starting = oop.start(); }
  finally { process.execPath = bunPath; }
  let driver: Driver | undefined, expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    driver = await Promise.race([
      starting.then(async value => { if (expired) await value.stop(); return value; }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => {
        expired = true; reject(new Error('Playwright Node driver startup timed out.'));
      }, 10_000); }),
    ]);
  } finally { clearTimeout(timer); }
  let stopping: Promise<void> | undefined;
  const stop = () => stopping ??= driver!.stop().finally(() => pendingCleanup.delete(stop));
  pendingCleanup.add(stop);
  try {
    const browser = await driver.playwright.chromium.launch({ executablePath: executable, headless: true, timeout: 10_000 });
    const close = browser.close.bind(browser);
    browser.close = async options => { try { await close(options); } finally { await stop(); } };
    return browser;
  } catch (error) { await stop(); throw error; }
}
