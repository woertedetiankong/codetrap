# Task Brief: Observation First-Run Onboarding

> Created: 2026-08-30
> Parent plan: [Agent Experience Compiler roadmap](../../agent-experience-compiler-roadmap.md)
> Status: Done

## Goal

Let a first-time user understand and explore Overview and Runs without learning the Observation CLI or contaminating the real evidence ledger with synthetic facts.

## Success Criteria

- Empty Observation states explain in plain language why no Run exists and distinguish current explicit capture from future automatic Agent integration.
- A user can open a representative Run timeline from the empty state in one click; the preview is visibly synthetic, stays in browser memory, and never creates project identity, a ledger, a trap, a candidate, or Learning state.
- The empty-state Run queue and central detail use one coherent example and provide an obvious path back to real data and offline Evals.
- Chinese and English copy, keyboard semantics, generated-client syntax, responsive layout, and read-only Observation contracts have regression coverage.
- Every completed Web development slice includes rendered-page verification through OpenCLI in addition to tests, typecheck, and build checks.

## Scope

In scope:

- Impact Overview/Runs first-run explanation and ephemeral sample timeline.
- Existing generated browser client state, event binding, localization, styling, and tests.
- User/operator documentation and restart handoff.

Out of scope:

- Automatic Codex/Claude hooks, transcript scanning, background capture, Team sync, or model calls.
- Writing synthetic runs to `.codetrap/observations/ledger.sqlite`.
- Governed Eval-candidate persistence or changes to accepted trap/Learning data.

## Constraints

- Opening Impact and previewing an example remain read-only operations.
- Example evidence must be explicitly labeled and must not contribute to Overview or Evals metrics.
- Real Run DTOs keep the existing privacy allowlist; the preview must not normalize unsafe fields into the production contract.
- Preserve all pre-existing uncommitted work. Do not accept candidates, commit, push, release, install globally, or change the package version.

## Expected Knowledge Updates

- Rewrite the Observation first-run workflow in README, installation, Impact/Evals design, parent roadmap, task index, and NEXT-SESSION.
- Task index: update required.
- Wiki: not created; this repository has no hand-maintained wiki.
