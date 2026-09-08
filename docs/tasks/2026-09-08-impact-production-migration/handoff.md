---
title: Handoff 2026-09-08 - Whole Impact Production Migration
status: Complete
updated: 2026-09-08
supersedes: ../2026-09-08-impact-apple-prototype/handoff.md
---

# Handoff

## Summary

The approved whole Impact prototype replaces the old production interface.
Overview, Tasks, Improvements and Verification use a shared Apple-style shell,
responsive layouts, Chinese/English labels, light/dark themes and native sheets.

## Current State

Complete. The full repository regression passes: 102/102 test files. Typecheck,
checked-in browser artifact verification, and focused browser journeys pass. Refer to
[task brief](task-brief.md) and [decisions](implementation-log.md).

## Git And Persistent State

Branch main; no commit, push, deployment or package installation. Earlier
uncommitted Evals and Run evidence work was preserved and integrated. New sources
include `client-impact-app.ts`, `client-revision-workspace.ts`,
`impact-apple-style.ts` and `impact-workbench-view.ts` under `src/web`.
The bundled browser artifact is regenerated. Real project observations and
lessons were read for visual QA; all mutation tests use isolated fixtures.

## Environment State

The source preview is served at 127.0.0.1:4750 by
`bun --watch /tmp/codetrap-workbench-preview.ts`; it was restarted for the new
build. The separate prototype remains at 4760. Existing installed service 4751
is separate and was not upgraded. Launch credentials stay out of documentation.

## Validation

Typecheck, browser build, `check:web`, and `git diff --check` pass.
`bun run test`: 102/102 test files pass.
Visual QA includes the real project in the in-app browser and isolated revision
journeys at 1440×1000 and 390×844; no browser page errors were reported. Final in-app browser error logs are empty.
The documentation journal check passes with zero errors and zero warnings. The focused browser journey covers read-only
inspection, feedback retry, three steps, preserved drafts, applying, reopening,
verification filters and exact rollback. Other browser checks cover source-bound
form recovery, keyboard access, missing setup, unreadable data and 320–1487px
layouts.

## Visual Evidence

- [Real project overview](evidence/overview.png) and [dark appearance](evidence/overview-dark.png)
- [Task evidence](evidence/tasks.png), [readonly lesson sheet](evidence/lesson-sheet.png), [retrieval verification](evidence/verification.png), and [honest improvement empty state](evidence/improvements-empty.png)
- [Desktop revision verification, isolated fixture](evidence/revision-desktop.png)
- [Mobile verification, isolated fixture](evidence/impact-verification-mobile.png)

## Cross-Module References

- [Approved prototype](../../prototypes/impact-apple/README.md)
- [Revision and workbench contract](../../experience-revisions.md)
- [Retrieval comparisons and examples](../../project-evaluation-suites.md)
- [Current Impact design](../../impact-evals-design.zh-CN.md)

## Restart Verify

```sh
bun run typecheck   # expected: exit 0; mismatch indicates a contract or browser type regression.
bun run check:web   # expected: exit 0; mismatch means rebuild the checked-in browser artifact.
bun test src/tests/impact-workbench.test.ts src/tests/experience-revisions-browser.test.ts
# expected: all pass; failures isolate workbench evidence or the revision journey.
```

## Implementation Log

See [dated decisions](implementation-log.md).

## Next Steps

No required implementation remains. Optional future work:
real task naming/query opt-in, paginated long histories, real embedding/Agent
comparisons and persisted appearance preference. They are not represented by
prototype data or fake metrics in the product.

## Docs And Wiki

Reconciled revision workflow, project evaluation sets, current Impact design,
prototype status, audit dashboard, task index and restart pointer. No wiki exists
for this slice; the feature documents own the durable contract.
