# Candidate Review Visibility Verification

## Automated Commands

```bash
bun test src/tests/session-cli.test.ts src/tests/cli-json.test.ts src/tests/web-console.test.ts
bun test src/tests
bunx tsc --noEmit
bun run eval:dogfood -- report
```

## Manual Dogfood

Use `/Users/superstorm/Documents/Code/esp32` with session `2026-06-04-codetrap-candidate-inbox-test`.

Expected checks:

- `codetrap session list --json` shows three pending candidates for the dogfood session.
- `codetrap session status --json` has no active session and reports three pending candidates.
- `codetrap doctor --json` reports three pending candidates and review next actions.
- `codetrap web` opens the Review view with the pending dogfood session selected.
- `codetrap stats --json` still reports eight confirmed project traps in the ESP32 project.

## Evidence

During goal execution, append command results and manual observations to `progress.jsonl`.
