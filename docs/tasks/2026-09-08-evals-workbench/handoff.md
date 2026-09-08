---
title: Handoff 2026-09-08 - Evaluation workbench
status: Complete
updated: 2026-09-08
---

# Handoff

## Summary

Result-first Evals now shows coverage and comparison controls before maintenance, with a case table and frozen-snapshot detail dialog. Overview takes users to an eligible unrated task. The API reports the actual test engine and coverage, caches deterministic summaries by digest and verifies historical snapshot titles.

## Current State

The requested first refactor is complete and uncommitted. All prior Run evidence lineage changes are preserved. No schema migration or evaluation algorithm replacement.

## Git And Persistent State

- Branch: main; no commit created.
- Browser bundle rebuilt from source. No test feedback or experiments were added to the actual project.
- Previous dossier: [Run evidence lineage](../2026-09-07-run-evidence-lineage/handoff.md).

## Environment State

The source preview on port 4750 uses the actual project and remains available in the in-app browser. Existing port 4751 service is unchanged; installed binaries need their own rebuild/restart to serve these sources. Isolated experiments used a temporary project/home on port 4753; that QA server is stopped after screenshots. Browser viewport overrides were reset.

## Key Decisions

- Reuse the governed runner and existing human review/revision flow. No live embedding evaluation or Agent coding trial was added.
- Positive/negative counts and engine labels constrain the interpretation of scores. Repeat count does not inflate case count; remaining failures and outdated-suite results are explicit.
- Expected titles resolve only from hash-verified immutable snapshots. Missing/corrupt evidence preserves healthy results with a warning, never a title from the current library.
- The deterministic summary cache holds at most 24 digest/source entries and coalesces simultaneous requests. Mutable file content is read before cache lookup; feedback and history remain fresh.
- Keep draft fields inside collapsed settings and native dialog keyboard/focus behavior. Finding review remains reachable through a header shortcut and existing disclosures.

## Validation

- 58 distinct targeted tests across 13 suites passed, including 9 browser scenarios. The initial grouped run passed 57 and exposed one stale revision-test selector; its final rerun passed the complete feedback/evaluate/accept/reopen/rollback scenario.
- Evidence: `/tmp/codetrap-workbench-validation.log` and `/tmp/codetrap-workbench-revision-recheck.log`. New workbench API/presentation tests cover digest refresh, negative-only metrics, frozen titles, missing/corrupt snapshots, escaping and Overview targets.
- `bun run typecheck`, `bun run build:web`, `bun run check:web` and `git diff --check`: passed.
- In-app browser: 1440×1000 desktop result and case detail, 390×844 stacked case detail; no console errors in the final actual-project preview. Example screenshots use copied fixture data in isolation.

## Rendered Evidence

[Desktop result](assets/desktop.jpg), [case detail](assets/case-detail.jpg), [narrow case detail](assets/mobile-case.jpg). These are deterministic fixture comparisons, not real task effectiveness measurements.

## Docs And Wiki

Updated [evaluation set workflow](../../project-evaluation-suites.md), [Impact design](../../impact-evals-design.zh-CN.md), [UX audit status](../../research/2026-09-07-evals-ux/README.md), task index and next-session entry. Existing docs remain the durable contract; no wiki was created.

## Red Lines And Gotchas

Preserve content-bound approval, review receipts, draft recovery and exact rollback. Keep query text out of observation summary APIs. Do not interpret retrieval content ablation or missing task feedback as coding effectiveness. Browser modules use client prefixes; do not relax the runtime import guard.

## Restart Verify

```bash
bun run check:web # expected: exit 0; mismatch means generated browser asset is stale.
bun test src/tests/eval-workbench.test.ts src/tests/eval-workbench-browser.test.ts # expected: 8 pass when local Chrome is available; no failed tests.
```

## Next Steps

No remaining work in this slice. Potential separate work: live embedding comparisons, real-task paired trials, searchable case pagination, and explicitly versioned corpus refresh. Original open-source research and deferred recommendations remain in the audit.

## Implementation Log

[implementation-log.md](implementation-log.md) records evidence boundaries, caching, browser layout and recovery compatibility decisions.
