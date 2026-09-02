---
title: Handoff 2026-08-30 - Observational Evals v1
status: Complete
updated: 2026-08-30
---

# Handoff

## Summary

Production `Impact → Evals` is now a real-data blue calibration bench. It keeps a selected project's deterministic Search Eval, privacy-safe observed outcomes, and unconfirmed review candidates in three explicit lanes; every ratio shows its numerator and denominator, and every candidate can jump back to its Run without writing ground truth.

## Current State

This milestone is complete. Retrieval/observational Evals and read-only candidates are live; governed candidate accept/reject/persist, controlled baseline/candidate execution, automatic client hooks, Team Hub, OTLP, and sensitive bodies remain future slices.

## Git And Persistent State

- Branch: `main`; the worktree already contained uncommitted Learning, design, Skill, Observation, and Web work, all preserved.
- No commit, push, release, package-version change, global install, Eval-case write, or Codetrap candidate acceptance occurred.
- No production Observation Ledger was created in this repository. A read-only local projection confirmed its existing state is `not_configured`; tests used temporary projects.
- Pending project-memory candidate `cand-001` in session `2026-08-30-capture-finalize-bun-sqlite-statements-before-closing-temporary` remains unaccepted.
- Pending project-memory candidate `cand-001` in session `2026-08-30-capture-keep-workspace-sub-navigation-visible-in-empty-states` records the post-review empty-state navigation lesson and also remains unaccepted.

## Key Decisions

- Evals has no composite score: deterministic retrieval, observational association, and review-required evidence keep separate names, denominators, and visual lanes.
- Only `src/tests/fixtures/search-eval.json` inside the registered project can supply retrieval metrics. Missing/invalid fixtures do not inherit maintainer data and do not hide valid observation evidence.
- Candidate reasons are explicit miss, irrelevant/harmful guidance, and failed validation after a prior exposure in the same Run sequence. Every candidate is `review_required` and `unconfirmed`.
- The API excludes fixture queries/results and arbitrary event attributes; the UI can only inspect the source Run. Search Eval loading is lazy so Overview/Runs do not wait for it.

## Changed Surfaces

- `src/domain/observation.ts`, `src/lib/observation-ledger.ts`: typed rates and candidate projection over the complete ledger.
- `src/web/evals-view.ts`, `src/web/server.ts`: project-local deterministic summary plus `/api/observations/evals` read-only route.
- `src/web/client-impact.ts`, `client-script.ts`, `client-text.ts`, `static.ts`: three-lane Evals UX, filters, Run links, bilingual copy, and responsive blue calibration styling.
- Observation/Web/client tests: ordering, privacy, empty/invalid states, lazy API flow, localization, responsive contracts, and future browser smoke coverage.

## Cross-Module References

- Depends on: [Impact Overview/Runs](../2026-08-30-impact-overview-runs/handoff.md) - read-only Impact shell and Run evidence links.
- Depends on: [Observation Ledger v1](../2026-08-30-observation-ledger-v1/handoff.md) - append-only typed events.
- Product contract: [Impact、轨迹观测与 Evals](../../impact-evals-design.zh-CN.md).
- Referenced by: future governed Eval-case workflow and controlled runner.

## Red Lines And Gotchas

- Do not convert projected candidates into fixture cases without an explicit human review action and content preview.
- Do not combine retrieval metrics with observed rates or call exposure-plus-validation causal impact.
- Do not expose raw fixture queries, ranked titles, fingerprints, commands, notes, paths, model/session metadata, or arbitrary event attributes.
- Browser smoke remains an intentional skip on this Windows host; do not claim visual browser execution from static/script tests alone.

## Validation

- Focused Ledger/API/client/browser command: 33 pass, 1 intentional browser skip, 0 fail (283 expects).
- `bun test`: 485 pass, 1 intentional browser skip, 0 fail (486 tests across 66 files, 2365 expects).
- `bun run typecheck`: passed.
- `bun run build`: passed; Windows CLI and MCP server binaries compiled.
- `git diff --check`: passed.
- Read-only current-project Evals projection: 24 deterministic cases, Recall@3=1, Recall@5=1, MRR=1, 0 failed/miss/noisy cases; no Ledger configured; approximately 66 ms in this run.
- Post-feedback navigation regression check: 21 focused Web/API tests passed, 0 failed (239 expectations); typecheck and diff checks passed. This verifies that the Impact tabs remain reachable while Overview is unconfigured.
- Implementation Journal strict scan for this dossier/index/NEXT/design/installation: 0 errors, 0 warnings. The broader README/roadmap scan has four pre-existing example-text warnings at roadmap lines 283 and 1760 and README lines 1063-1064.

## Restart Verify

```powershell
bun run typecheck  # expected: exit 0; mismatch means domain/API/client contracts drifted
bun test src/tests/observation-ledger.test.ts src/tests/observation-web.test.ts src/tests/web-client-script.test.ts src/tests/web-client-text.test.ts src/tests/web-browser-smoke.test.ts  # expected: 33 pass, 1 intentional skip, 0 fail; mismatch means Evals or Web contracts drifted
bun -e "import { observationEvalsWebPayload } from './src/web/evals-view.ts'; console.log((await observationEvalsWebPayload(process.cwd())).retrieval)"  # expected: ready, 24 cases, Recall@3/5 and MRR equal 1; mismatch means the checked-in fixture or deterministic evaluator changed
```

## Next Steps

1. Build the governed Eval-candidate workflow: preview, edit, accept/reject, and content-bound persistence into a project fixture with audit/rollback.
2. Add overhead, recurrence, and Learning-conversion projections only after their event denominators are explicit.
3. Design the controlled baseline/candidate runner as a separate permissioned milestone; never execute it in the real worktree or incur model cost without approval.

## Docs And Wiki

- Rewritten: README, installation guide, product design progress, parent roadmap, task index, and NEXT-SESSION.
- Created: this dossier, Evals Web module, and production Evals contracts.
- Wiki not created: the repository has no hand-maintained wiki.

## Implementation Log

- [implementation-log.md](implementation-log.md) records the evidence-lane, privacy, lazy-loading, candidate, and sequence-order decisions.
