---
title: Handoff 2026-09-07 - Run evidence lineage
status: Complete
updated: 2026-09-07
---

# Handoff

## Summary

Feedback-first Run cards connect scoped lesson events to existing feedback/revision dialogs and display source version, test status and bounded exact-version later activity. Missing completion displays as awaiting completion across Run detail, list and Overview.

## Current State

Implementation and feedback-first UX refinement complete; changes are uncommitted. Quick judgments, title/version checks and collapsed technical details are included.

## Git And Persistent State

- Branch: main; no commit created.
- Generated browser bundle rebuilt. No schema migration. Actual targeted test results recorded in the current observation Run.

## Environment State

The project Web server runs at port 4751. The browser is connected using the current service credential. Isolated revision UI checks used a temporary project and home on port 4752; those test records never entered the user project.

## Key Decisions

- Reuse governed revision workflows, including unchanged approval/digest/rollback contracts.
- A missing end event does not prove process liveness; awaiting completion is a presentation label only.
- Run summaries expose source identity and evaluation status, not private draft reasons, test queries or frozen corpora.
- Later activity is bounded to the existing 20-run exact-version projection. It is not a causal effectiveness metric.

## Red Lines And Gotchas

- Do not manufacture human feedback or infer adoption from exposure.
- Do not relax the browser runtime import guard; new browser modules use client prefixes.
- Do not reinterpret unreadable revision files as zero linked revisions.

## Docs And Wiki

Updated [experience revisions](../../experience-revisions.md), task index and restart entry. No new wiki created; durable contract is in the existing workflow documentation.

## Validation

- Seven targeted suites: 42 pass, 0 fail, 401 assertions. Output at `/tmp/codetrap-feedback-tests.log`.
- `bun run typecheck`: passed.
- `bun run build:web` and `bun run check:web`: passed.
- In-app browser: real Run shows awaiting completion and search diagnostics; isolated source Run opens the correct applied revision. Feedback-first fixture saves Helpful with a visible selected state and a collapsed technical disclosure.

## Restart Verify

```bash
bun run check:web # expected: exit 0; mismatch means browser sources and generated asset differ.
bun test src/tests/run-evidence.test.ts # expected: 6 pass; mismatch means lineage or API projection regressed.
```

## Next Steps

None required for this slice. Future options: reviewed miss-to-evaluation replay, broader experiment provenance and efficient indexing if revision volume grows. No Tangle runtime was introduced.

## Implementation Log

[implementation-log.md](implementation-log.md) records the reuse, privacy, lifecycle and browser-boundary decisions.
