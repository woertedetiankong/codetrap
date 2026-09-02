import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const browserCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

const executablePath = browserCandidates.find((candidate) => existsSync(candidate));
if (!executablePath) throw new Error("Chrome or Edge is required to verify the Evals prototype.");

const prototypePath = join(process.cwd(), "docs", "prototypes", "evals-ui-prototype.html");
const html = readFileSync(prototypePath, "utf8");
for (const marker of [
  "这次变化",
  "Baseline",
  "Candidate",
  'id="case-rows"',
  'id="open-trace"',
  'id="new-experiment"',
  "dataset.smoke",
]) {
  if (!html.includes(marker)) throw new Error(`Prototype source is missing ${marker}.`);
}

const profileDir = mkdtempSync(join(tmpdir(), "codetrap-evals-browser-"));
const desktopScreenshot = join(tmpdir(), "codetrap-evals-prototype-desktop.png");
const mobileScreenshot = join(tmpdir(), "codetrap-evals-prototype-mobile.png");
const traceScreenshot = join(tmpdir(), "codetrap-evals-prototype-trace.png");
const baseUrl = pathToFileURL(prototypePath).href;

function runBrowser(args: string[]) {
  const result = spawnSync(executablePath!, [
    "--headless=new",
    "--no-first-run",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    `--user-data-dir=${profileDir}`,
    ...args,
  ], { windowsHide: true, encoding: "utf8", timeout: 20_000, maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Headless browser failed (${String(result.status)}): ${result.stderr}`);
  return result.stdout;
}

try {
  const desktopDom = runBrowser([
    "--window-size=1440,1000",
    "--virtual-time-budget=1000",
    "--dump-dom",
    `${baseUrl}?smoke=desktop`,
  ]);
  if (!desktopDom.includes('data-smoke="passed"')) throw new Error("Desktop browser smoke interactions did not pass.");
  if (!desktopDom.includes('data-smoke-rows="6"')) throw new Error("Expected six rendered case rows.");

  const mobileDom = runBrowser([
    "--window-size=390,844",
    "--virtual-time-budget=1000",
    "--dump-dom",
    `${baseUrl}?smoke=mobile`,
  ]);
  if (!mobileDom.includes('data-smoke="passed"')) throw new Error("Mobile browser smoke interactions did not pass.");
  const overflowMatch = /data-horizontal-overflow="(-?\d+)"/u.exec(mobileDom);
  const horizontalOverflow = Number(overflowMatch?.[1] ?? Number.NaN);
  if (!Number.isFinite(horizontalOverflow) || horizontalOverflow > 1) {
    throw new Error(`Mobile layout overflow is invalid: ${String(overflowMatch?.[1])}.`);
  }

  runBrowser(["--window-size=1440,1200", "--virtual-time-budget=1000", `--screenshot=${desktopScreenshot}`, baseUrl]);
  runBrowser(["--window-size=390,844", "--virtual-time-budget=1000", `--screenshot=${mobileScreenshot}`, baseUrl]);
  runBrowser(["--window-size=1440,1000", "--virtual-time-budget=1000", `--screenshot=${traceScreenshot}`, `${baseUrl}?trace-preview=1`]);

  console.log(JSON.stringify({
    success: true,
    browser: executablePath,
    cases: 6,
    interactions: ["case selection", "trace drawer", "new experiment dialog", "human review"],
    desktopScreenshot,
    mobileScreenshot,
    traceScreenshot,
    horizontalOverflow,
  }, null, 2));
} finally {
  const resolvedProfile = join(profileDir);
  if (resolvedProfile.startsWith(tmpdir()) && resolvedProfile.includes("codetrap-evals-browser-")) {
    rmSync(resolvedProfile, { recursive: true, force: true });
  }
}
