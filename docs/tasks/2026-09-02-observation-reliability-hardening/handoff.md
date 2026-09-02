---
title: Handoff 2026-09-02 - Observation Reliability Hardening
status: Complete
updated: 2026-09-02
---

# Handoff

## Summary

Observation and Evals now preserve active review work, keep old Run evidence
addressable, retry failed Hook lifecycle writes, expose bounded Hook health with
preview-first recovery, show deferred external updates, isolate async responses
by selected project, and keep healthy controlled-eval history visible beside
explicit corruption diagnostics. Damaged Hook correlation state now degrades
only Hook health instead of hiding a healthy Ledger Overview.

## Current State

This hardening slice is complete. The real project is selected again, both the
real and temporary Hook state files are healthy with zero active Runs, and the
rebuilt Web server is listening on port 4737.

## Git And Persistent State

- This handoff ships with the Observation/Evals reliability commit requested on
  2026-09-02. The separate local Hugging Face embeddings work remains
  uncommitted in the dirty worktree.
- No push, release, package-version change, global install, Hook config change,
  or candidate acceptance occurred in this follow-up.
- OpenCLI added one `trap/missed-reported` event only to the registered temporary
  `codetrap-agent-observation-27d6e31babc14a0a93222d4e88bbce77` project to
  exercise a real deferred-update form. Its Hook state was restored exactly to
  `{ "version": 1, "active_runs": [] }`; the append-only synthetic ledger event
  remains in that disposable fixture project.
- Candidate `cand-001` in session
  `2026-09-02-capture-never-evict-retry-state-for-an-append-only-observation-r`
  remains proposed and needs human review.
- Request-affinity candidate `cand-001` in session
  `2026-09-02-capture-discard-async-web-responses-after-the-selected-project-c`
  was edited to quality 1.0 and also remains proposed; it was not accepted
  automatically.
- Fault-isolation candidate `cand-001` in session
  `2026-09-02-capture-keep-auxiliary-health-diagnostics-isolated-from-core-rea`
  has quality 1.0 and remains proposed; it was not accepted automatically.

## Key Decisions

- Hook stdout remains neutral. Operator health belongs in `observe
  current/status` and Impact Overview, where it is visible without steering or
  blocking the host Agent.
- `observe recover` is read-only by default. Explicit `--apply` retries a
  missing start, records `cancelled`/`partial`, and removes only entries whose
  completion append succeeded. Age alone never deletes state.
- An open Evals form stays mounted on background refresh. New evidence produces
  a visible deferred notice while exact raw textarea content, rejection reason,
  and DOM identity remain intact.
- Run detail is independently addressable and not constrained by the recent 100
  summary rows.
- Every Observation async loader binds its result to the project selected when
  the request started and discards stale responses after a project switch.
- Strict controlled-eval callers still fail closed; Web history skips corrupt
  files with filename-only diagnostics and never mutates them.
- Hook health is a diagnostic projection, not a dependency of Ledger reads.
  Invalid or unsupported state returns `unavailable` with null unknown counts;
  `current/status` remain diagnostic, while `recover --apply` refuses mutation.
  Automatic reset is intentionally absent because unknown correlation state
  cannot be safely converted into completion evidence.

## Changed Surfaces

- `src/lib/agent-observation.ts`: health projection, stale candidate preview,
  explicit successful-write-gated recovery, bounded non-evicting state, and a
  non-throwing unavailable diagnostic for unreadable state.
- `src/commands/observation-commands.ts`: health in current/status plus
  `observe recover [--older-than-days N] [--apply]`; corrupt-state recovery is
  explicitly refused without changing bytes.
- `src/web/observation-view.ts`, `client-impact.ts`, `client-script.ts`,
  `client-text.ts`, `static.ts`: Overview health guidance, Evals deferred-update
  UX, exact draft preservation, and project-affinity guards.
- Tests cover Hook recovery, old Run direct lookup, read-only Web health,
  generated-client guards/copy, and browser serialization boundaries.

## Validation

- Focused affected suite: 60 pass, 0 fail, 634 assertions.
- Repository suite: 535 pass, 1 intentional environment-gated browser skip,
  0 fail, 2791 assertions across 74 files.
- `bun run typecheck`, standard `bun run build`, and `git diff --check`: pass.
- OpenCLI Hook-health journey rendered the blue/amber warning with 1/64 active,
  one stale Run, and the exact preview command.
- OpenCLI Evals journey kept exact text including leading/trailing spaces on the
  same textarea DOM node while a new local event arrived; the deferred notice
  became visible and candidate totals updated without replacing the form.
- Final rebuilt-Web journey switched between the real 8-Run project and the
  temporary 1-Run project; the selected project stayed authoritative, with
  0 console errors and 0 failed network requests.
- Corrupt-state OpenCLI journey kept the temporary project's one healthy Ledger
  Run visible beside an explicit unavailable warning. CLI status retained both
  client integration results; `recover --apply` returned `applied:false`, exit
  1, and an unchanged state-file SHA-256. Console and failed requests stayed 0.
- Screenshots: `%TEMP%\codetrap-hook-health-warning.png` and
  `%TEMP%\codetrap-evals-deferred-update.png`, plus
  `%TEMP%\codetrap-hook-state-unavailable.png`.

## Restart Verify

```powershell
bun test src/tests/agent-observation.test.ts src/tests/observation-web.test.ts src/tests/web-client-script.test.ts src/tests/web-client-text.test.ts src/tests/web-console.test.ts  # expected: 60 pass, 0 fail; mismatch means this slice regressed
bun run typecheck  # expected: exit 0; mismatch means Web/Hook/Eval contracts drifted
```

## Next Steps

1. Human-review the three proposed Observation reliability candidates; none is
   confirmed memory yet.
2. Keep Team Hub deferred unless the user deliberately reprioritizes it.
3. For product work, choose between longitudinal Impact value, real controlled
   Agent/worktree execution, or representative retrieval evaluation of the two
   completed local embedding profiles.

## Docs And Wiki

- Reconciled: README, installation guide, parent roadmap, Impact/Evals design,
  task index, and NEXT-SESSION.
- Wiki not created: this repository has no hand-maintained wiki.

## Implementation Log

- [implementation-log.md](implementation-log.md) records the refresh,
  addressability, recovery, corrupt-state isolation, partial-history, and
  request-affinity decisions.
