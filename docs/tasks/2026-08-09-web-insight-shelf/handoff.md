---
title: Handoff 2026-08-09 - Web Insight Shelf
status: Complete
updated: 2026-08-09
---

# Handoff

## Summary

The misleading trap-derived `Insights` analytics page is gone. The Web console
now exposes the real Phase 2 learning-only Insight Shelf under **Learning**,
while the trap Library retains only actionable currency and usefulness health
filters.

## Current State

- Branch: `web-insight-shelf`, based on `ac09710` (`main` and `origin/main`).
- Changes are implemented and validated but intentionally uncommitted; the user
  did not authorize commit, merge, or push in this task.
- The current project's real Insight Shelf is empty. Its Web empty state clearly
  explains that confirmed traps are not automatically copied into learning.

## Behavior And Trust Boundaries

- `GET /api/insights` reads only `Phase2Store.listInsights()` for the selected,
  registered project; it never lists traps.
- `POST /api/insight/consult` is token-protected, project-bound, returns 404 for
  an unknown id, and is invoked only by **Mark learned**.
- Selecting or opening an insight is read-only and does not change
  `consulted_count`.
- Library health uses current traps only. “Needs validation” shares the runtime
  policy's 180-day `DEFAULT_RANKING_CONFIG.staleAfterDays`; “Never marked
  useful” uses `useful_count === 0`.

## Validation

- `bun run typecheck` -> passed.
- `bun test src/tests/` -> 398 passed, 1 configured browser-smoke skip, 0 failed,
  1693 assertions across 56 files.
- Focused Web tests -> 24 passed before the final full run.
- Fresh real-page inspection -> Library health filter worked, English and
  Chinese Learning empty states rendered, and no browser console warnings or
  errors appeared.
- `bun run benchmark:retrieval -- --verify` -> passed; hybrid proxy MRR 0.9028,
  semantic proxy-only MRR 0.875.
- `bun run build` -> produced `dist/codetrap.exe` and
  `dist/codetrap-serve.exe`.
- `npm pack --dry-run --json` -> passed and included the changed Web modules.
- `git diff --check` -> passed before final documentation reconciliation; rerun
  before committing.

## Next Steps

1. Review the branch diff and rerun `git diff --check`.
2. Commit only when the user explicitly requests it.
3. Merge/push only under separate user authorization.
4. Phase 4 still needs inspected remote CI evidence, independent reproduction,
   and Phase 4B longitudinal data; this Web task does not satisfy those gates.

## Restart Verify

```bash
git status --short --branch
bun run typecheck
bun test src/tests/web-console.test.ts src/tests/web-client-script.test.ts src/tests/web-client-text.test.ts
```

Expected state: branch `web-insight-shelf` has uncommitted task changes, the
focused Web suite is green, `/api/insights` is the only Learning list source,
and `/api/insight/consult` appears only in the explicit consultation action.

## Red Lines

- Never copy traps into the learning shelf automatically.
- Never count passive opening as learning.
- Do not weaken Web launch-token or project-registry isolation.
- Do not commit, merge, push, publish, or release without the user's explicit
  request.
