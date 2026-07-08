import { mkdirSync, mkdtempSync, realpathSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, sep } from "node:path";
import type { TrapInput } from "../domain/trap";

// On Windows, os.tmpdir() (e.g. C:\Users\<me>\AppData\Local\Temp) lives INSIDE
// os.homedir() (e.g. C:\Users\<me>). findProjectRoot walks up from a temp cwd
// looking for `.codetrap` and stops at the given home boundary — but when the
// test's tempHome is itself under the real HOME, the walk finds the REAL user's
// `.codetrap` before reaching the sandbox home, so test sandboxes leak into the
// host config (see the project-identity / onboarding / web-console failures).
//
// Fix: when the system tmpdir is nested under the real home, root temp dirs at
// a sibling of the real home instead (e.g. C:\Users\... becomes C:\Users). An
// explicit CODETRAP_TEST_TMP override wins over both. The chosen base must be
// writable (mkdtempSync asserts that) and never itself the real home.
function testTmpRoot(): string {
  const override = process.env.CODETRAP_TEST_TMP;
  if (override) return override;
  const tmp = realpathish(tmpdir());
  const home = realpathish(homedir());
  if (home && tmp !== home && isWithin(tmp, home)) {
    // tmp is under home — climb out to the real home's parent (a sibling root).
    const parent = home.slice(0, home.lastIndexOf(sep));
    return parent && parent !== home ? parent : tmp;
  }
  return tmp;
}

function realpathish(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

function isWithin(child: string, parent: string): boolean {
  const c = child.toLowerCase();
  const p = parent.toLowerCase();
  return c === p || c.startsWith(p.endsWith(sep) ? p : p + sep);
}

export type CliResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export type TempDirOptions = {
  realpath?: boolean;
};

export type TempHomeOptions = TempDirOptions & {
  initCodetrap?: boolean;
};

export function trap(overrides: Partial<TrapInput> = {}): TrapInput {
  return {
    title: "Use fetchWrapper for HTTP requests",
    category: "api",
    tags: ["http", "fetch"],
    scope: "global",
    context: "When making network requests, use the project fetchWrapper.",
    mistake: "Calling fetch or axios directly bypasses retry and error handling.",
    fix: "Use fetchWrapper and follow the HTTP request convention.",
    severity: "warning",
    ...overrides,
  };
}

export function tempDir(prefix: string, options: TempDirOptions = {}): string {
  const dir = mkdtempSync(join(testTmpRoot(), prefix));
  return options.realpath ? realpathSync(dir) : dir;
}

export function tempProjectDir(prefix: string, options: TempDirOptions = {}): string {
  const dir = tempDir(prefix, options);
  mkdirSync(join(dir, ".codetrap"));
  return dir;
}

export function tempHome(
  prefix = "codetrap-home-",
  options: TempHomeOptions = {}
): string {
  const home = tempDir(prefix, options);
  if (options.initCodetrap) mkdirSync(join(home, ".codetrap"), { recursive: true });
  return home;
}

export function isolatedCliEnv(home: string, overrides: Record<string, string> = {}): Record<string, string> {
  return {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    CODETRAP_EMBEDDING_PROVIDER: "",
    CODETRAP_OLLAMA_MODEL: "",
    CODETRAP_OLLAMA_ENDPOINT: "",
    CODETRAP_OLLAMA_DIMENSIONS: "",
    OLLAMA_HOST: "",
    JINA_API_KEY: "",
    CODETRAP_SEARCH_MODE: "",
    CODETRAP_SEARCH_LIMIT: "",
    CODETRAP_SEARCH_SCOPE: "",
    CODETRAP_RERANK: "",
    ...overrides,
  };
}

export function runCli(args: string[], cwd: string, home: string, stdin?: string): CliResult {
  const result = Bun.spawnSync({
    cmd: ["bun", "run", join(import.meta.dir, "..", "index.ts"), ...args],
    cwd,
    env: isolatedCliEnv(home),
    stdin: stdin === undefined ? "ignore" : new TextEncoder().encode(stdin),
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    exitCode: result.exitCode,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr),
  };
}

export async function runCliAsync(
  args: string[],
  cwd: string,
  home: string,
  options: { timeoutMs?: number } = {}
): Promise<CliResult | { exitCode: "timeout"; stdout: string; stderr: string }> {
  const proc = Bun.spawn({
    cmd: ["bun", "run", join(import.meta.dir, "..", "index.ts"), ...args],
    cwd,
    env: isolatedCliEnv(home),
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = new Response(proc.stdout).text();
  const stderr = new Response(proc.stderr).text();
  const exitCode = await exitOrTimeout(proc, options.timeoutMs ?? 1_500);
  return { exitCode, stdout: await stdout, stderr: await stderr };
}

async function exitOrTimeout(
  proc: ReturnType<typeof Bun.spawn>,
  timeoutMs: number
): Promise<number | "timeout"> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timed = new Promise<"timeout">((resolve) => {
    timeout = setTimeout(() => {
      proc.kill();
      resolve("timeout");
    }, timeoutMs);
  });
  const result = await Promise.race([proc.exited, timed]);
  if (timeout) clearTimeout(timeout);
  return result;
}
