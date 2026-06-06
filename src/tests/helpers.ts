import { mkdirSync, mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TrapInput } from "../domain/trap";

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
  const dir = mkdtempSync(join(tmpdir(), prefix));
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
