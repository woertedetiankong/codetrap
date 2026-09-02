---
title: Handoff 2026-08-31 - Governed Eval Candidates
status: Complete
updated: 2026-08-31
---

# Handoff

## Summary

Observation Eval signals now enter a reversible human calibration workflow instead of stopping at a read-only queue. The user can inspect evidence, author an exact Search Eval case, save a no-write preview, explicitly accept or reject it, and restore the exact fixture through rollback.

## Current State

The governed persistence slice is complete and the real project Web console has been restored. Controlled baseline/candidate execution remains future work.

## Delivered

- `GovernedEvalOperations` overlays Observation candidates with revisioned session/Phase 2 review state: `review_required`, `draft`, `accepted`, `rejected`, `rolled_back`, or fail-closed `conflict`.
- Draft and accept validate query, mode, judgment, and expected IDs against the selected project's checked-in fixture. Raw queries are never reconstructed from Observation fingerprints.
- Phase 2 `search_eval_case` writes the current `queries` schema atomically, refuses exact duplicates, emits normal receipts, and keeps exact rollback snapshots.
- Token-authenticated Web routes expose draft, accept, reject, and rollback only for registered projects.
- The blue Evals calibration bench includes the evidence → human gate → fixture flow, fixture-only expected-result picker, preview counts/path, explicit write warning, confirmed summary, rejection state, and rollback.
- Unsaved form state survives validation/request errors; Chinese review states and judgments are localized; the hero remains legible in the normal three-pane width.

## Trust Boundary

- Opening Evals, reading projections, and saving no draft are read-only.
- Observation remains metadata-only. It stores a fingerprint for missed queries and never supplies raw query text to the review form.
- A draft is user-authored content in the candidate inbox, not confirmed ground truth and not a fixture mutation.
- Only a user click on the labelled accept action commits the exact submitted revision. No Agent, hook, or observed association self-authorizes a fixture write.
- Rejection requires no query. Rollback restores the exact pre-accept fixture and returns the case to unconfirmed state.

## Validation

- `bun run typecheck`
- `bun test`: 501 pass, 1 environment skip, 0 fail, 2535 expectations (final full-suite checkpoint)
- focused post-OpenCLI hardening: 18 pass, 0 fail
- `bun run build`: compiled CLI and MCP binaries
- OpenCLI: isolated draft → preview → accept → rollback, DOM/storage privacy, URL token removal, 0 console errors, 0 failed requests, and visual screenshots
- Isolated fixture hash before preview and after rollback: `835FAF970046AEE50D51F595EBF0E8DA360ED8A69BEF7A595FE3CD4BE7FB194C`

## Git And Persistent State

- No project Eval fixture in the codetrap checkout was accepted or modified by OpenCLI; browser mutation testing used an isolated temporary project.
- The real Web console was restored on `http://127.0.0.1:4737/` after validation.
- No hook, global install, commit, push, release, package version, or confirmed pitfall was changed.
- OpenCLI review feedback created pending candidate `cand-001` in session `2026-08-31-capture-snapshot-unsaved-form-state-before-an-async-re-render`; it remains unconfirmed.

## Next Steps

Build the first controlled baseline/candidate Eval runner without mixing its results into observational rates. Reuse the confirmed fixture cases, record reproducible inputs/version identity, link each failure to evidence, and keep model judges auxiliary.

## Implementation Log

- [implementation-log.md](implementation-log.md) records schema repair, privacy, governance, OpenCLI findings, and validation evidence.

## Restart Verify

```powershell
bun run typecheck  # expected: exit 0; mismatch means source types drifted
bun test src/tests/governed-eval-candidates.test.ts src/tests/observation-web.test.ts src/tests/phase2.test.ts src/tests/web-client-script.test.ts src/tests/web-client-text.test.ts  # expected: all focused tests pass; mismatch means governance or Web behavior drifted
bun run build  # expected: both compiled binaries build; mismatch means serialization or packaging drifted
```
