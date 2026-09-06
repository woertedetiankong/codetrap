import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Release each file's SQLite handles, browser drivers, and module state before
// the next suite. Do not retry or skip failures: every discovered suite runs.
function testFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? testFiles(path) : entry.name.endsWith('.test.ts') ? [path] : [];
  }).sort();
}

const files = testFiles('src/tests');
if (!files.length) throw new Error('No test files found. Run from the repository root.');
const failures = [];
for (const file of files) {
  const result = spawnSync('bun', ['test', file], { stdio: 'inherit', timeout: 180_000 });
  if (result.status !== 0 || result.error) {
    failures.push(file);
    console.error(`Suite failed: ${file} (${result.error?.message ?? result.signal ?? result.status})`);
  }
}
console.log(`${files.length - failures.length}/${files.length} test files passed.`);
if (failures.length) console.error('Failed suites:\n' + failures.join('\n'));
process.exitCode = failures.length ? 1 : 0;
