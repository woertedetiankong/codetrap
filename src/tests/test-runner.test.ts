import { expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tempDir } from './helpers';

const runner = join(import.meta.dir, '../../scripts/test.mjs');
function run(files: Record<string, string>) {
  const cwd = tempDir('codetrap-test-runner-');
  mkdirSync(join(cwd, 'src/tests/nested'), { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(cwd, 'src/tests', name), body);
  return spawnSync('node', [runner], { cwd, encoding: 'utf8', timeout: 10_000 });
}

test('suite runner discovers nested tests and isolates process state between files', () => {
  const result = run({
    'a.test.ts': 'import { test } from "bun:test"; test("set state", () => { process.env.RUNNER_LEAK = "yes"; });',
    'nested/b.test.ts': 'import { expect, test } from "bun:test"; test("isolated", () => expect(process.env.RUNNER_LEAK).toBeUndefined());',
  });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('2/2 test files passed.');
});

test('suite runner reports failure while still executing later suites', () => {
  const result = run({
    'a.test.ts': 'import { test } from "bun:test"; test("failure", () => { throw new Error("expected fixture failure"); });',
    'z.test.ts': 'import { test } from "bun:test"; test("later suite ran", () => console.log("LATER_SUITE_RAN"));',
  });
  expect(result.status).toBe(1);
  expect(result.stdout).toContain('LATER_SUITE_RAN');
  expect(result.stdout).toContain('1/2 test files passed.');
  expect(result.stderr).toContain('Failed suites:');
});

test('suite runner fails when no test files exist', () => {
  const result = run({});
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('No test files found.');
});
