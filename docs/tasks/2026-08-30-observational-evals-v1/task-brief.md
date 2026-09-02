# Task Brief: Observational Evals v1

> Created: 2026-08-30
> Parent plan: [Agent Experience Compiler roadmap](../../agent-experience-compiler-roadmap.md)
> Status: Done

## Goal

Turn the production `Impact` surface into a reviewable Evals workspace backed by checked-in retrieval cases and privacy-safe local Observation evidence, without claiming causality or silently creating ground truth.

## Success Criteria

- `Impact → Evals` separates deterministic Search Eval results, observed Run evidence, and unconfirmed review candidates in both its API contract and visual hierarchy.
- Search metrics are computed only from the selected project's checked-in fixture; a missing or invalid fixture has an actionable isolated state and does not hide observed evidence.
- Helpful/noise/validation rates show numerator and denominator, while miss, harmful/irrelevant, and failed-validation evidence becomes a stable read-only candidate linked to its Run.
- Web reads remain non-mutating and expose neither arbitrary event attributes nor raw queries, commands, notes, paths, revisions, model details, fingerprints, or hidden reasoning.
- Empty, partial, invalid-fixture, candidate-filter, responsive, localization, and inline-script contracts have regression coverage.

## Scope

In scope:

- Observation Ledger projection for observational metrics and review candidates.
- Read-only combined Evals Web payload and `/api/observations/evals` route.
- Real-data blue calibration-bench UI inside the existing Impact workspace.
- Candidate filters and navigation back to the source Run timeline.
- Tests and current-facing documentation.

Out of scope:

- Persisting, accepting, rejecting, or promoting Eval candidates.
- Automatic Codex/Claude Code hooks or background observation.
- Controlled baseline/candidate execution, model judging, Team Hub, OTLP, remote sync, or sensitive body capture.
- Changing Learning/Library ownership or existing historical events.

## Constraints

- Deterministic retrieval quality and observed task outcomes are separate evidence tracks; neither alone proves task causality.
- Observation candidates remain `review_required` and `unconfirmed`; no GET or UI action writes to the Ledger or fixture.
- Every displayed ratio includes its numerator and denominator; no small-sample trend claim is generated.
- The Search Eval path is fixed to `src/tests/fixtures/search-eval.json` under the registered project root and the response excludes query text and result titles.
- Preserve all pre-existing uncommitted work. Do not accept Codetrap candidates, commit, push, release, install globally, or change the package version.

## Expected Knowledge Updates

- Rewrite the implementation progress in `docs/impact-evals-design.zh-CN.md`, the parent roadmap, README, and installation docs where they describe production Impact.
- Task index: update expected.
- Wiki: not created; this repository has no hand-maintained wiki.
