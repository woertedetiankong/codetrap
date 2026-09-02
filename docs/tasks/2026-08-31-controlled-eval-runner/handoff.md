---
title: Handoff 2026-08-31 - Controlled Eval Runner v1
status: Complete
updated: 2026-08-31
---

# Handoff

## Summary

Impact → Evals now includes a reproducible, zero-cost controlled comparison lane. Users can compare a fixed baseline and candidate over confirmed Search Eval cases, see regressions before averages, reopen local experiment history, and audit the exact suite, repository, configuration, seed, trial order, and per-case evidence behind a result.

## Current State

The deterministic v1 runner is complete. It measures retrieval-policy and confirmed-memory contribution without modifying source data or mixing the result into observed usage rates. End-to-end Codex/Claude execution, isolated worktrees, model judges, budgets, and CI scheduling remain future permissioned work.

## Delivered

- `ControlledEvalOperations` reads only `src/tests/fixtures/search-eval.json` and fails closed for missing, invalid, or unsupported input.
- `retrieval_policy_v1` compares FTS-only baseline retrieval with each fixture case's confirmed retrieval mode.
- `memory_contribution_v1` compares expected traps unavailable versus the same confirmed traps available.
- Trials use deterministic seeded case ordering and alternate baseline/candidate side order.
- Reports include suite path/SHA/snapshot, repository revision/dirty state, runtime, profile identities, configuration fingerprint, seed, trials, duration, side order, summary, reproducibility, and per-case evidence.
- Reports and suite snapshots are atomically persisted under ignored project-local `.codetrap/evals/`; read-only listing creates no directories.
- Token-authenticated Web list/run APIs expose the same registered-project boundary as the other Impact surfaces.
- The blue controlled workbench provides profile, trial and seed controls, zero-cost guardrails, result history, regression-first verdicts, side metrics, duration delta, reproducibility facts, audit identities, filters, and 24 case comparisons.

## Trust Boundary

- Both sides use immutable in-memory fixture snapshots; the checked-in fixture and source tree are never rewritten by a run.
- The two profiles are named production contracts, not arbitrary commands or caller-supplied rankings.
- `model_calls`, token usage, and cost are all zero. The UI does not imply full Agent task performance.
- Controlled results remain separate from Observation Ledger Helpful/noise/validation rates and governed ground-truth authoring.
- Real Agent/worktree trials require an explicit later design with isolation, timeout, budget, permissions, model and client version fixed.

## Validation

- `bun run typecheck`: pass.
- Focused controlled/Web suite: 30 pass, 1 intentional environment skip, 0 fail, 371 expectations.
- `bun test`: 506 pass, 1 intentional environment skip, 0 fail, 2581 expectations across 70 files after scroll-stability hardening.
- `bun run build`: both `dist/codetrap.exe` and `dist/codetrap-serve.exe` compiled.
- `git diff --check`: pass.
- OpenCLI actual-click journey: controlled history changed from one experiment to two; controlled POST and Evals GET returned 200; 24 case rows and 24 improvements rendered; two trials reported reproducible; URL/token hygiene held; 0 failed requests and 0 console errors.
- OpenCLI polling regression: Overview, a five-event Run, and the 24-case Evals page retained their exact non-zero scroll positions and DOM-node identity across two five-second background refresh intervals; 0 failed requests and 0 console errors.
- Final visual inspection: the primary action is fully visible in the real three-pane center width and the comparison surface remains readable.
- Fixture SHA-256 before and after the browser run: `0727F1E4086DBD346D5FDB8CD14F172652B8C9FCD10CB7F62D47518FD2030835`.

## Git And Persistent State

- The real project contains two successful local controlled experiment reports so the user can inspect history in the running Web console.
- No Eval fixture, hook, confirmed trap, global install, commit, push, release, package version, or external model account changed.
- The working tree includes this slice plus pre-existing uncommitted Observation, Evals, Learning, Web, Skill, and documentation work.
- Candidate `cand-001` in session `2026-08-31-capture-pass-parity-does-not-mean-a-controlled-eval-case-is-unch` remains proposed and requires explicit human accept/edit/reject/supersede.

## Next Steps

The next product slice should complete Learning Impact: let a user turn a useful Insight into a local, deterministic Agent-experience candidate through an explicit review action, without invoking Codex/Claude or writing directly to confirmed Library memory. Keep real Agent controlled trials as a separate, permissioned extension after their isolation and budget contract is approved.

## Implementation Log

- [implementation-log.md](implementation-log.md) records runner identity, storage, classification, persistence normalization, center-pane layout, and OpenCLI decisions.

## Restart Verify

```powershell
bun run typecheck  # expected: exit 0; mismatch means runner or Web types drifted
bun test src/tests/controlled-eval.test.ts src/tests/observation-web.test.ts src/tests/web-client-script.test.ts src/tests/web-client-text.test.ts src/tests/web-browser-smoke.test.ts  # expected: 30 pass, 1 environment skip, 0 fail
bun run build  # expected: both compiled binaries build
```
