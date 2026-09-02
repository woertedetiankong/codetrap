---
title: Handoff 2026-08-30 - Web UX Recovery And Routing
status: Complete
updated: 2026-08-30
---

# Handoff

## Summary

The local Web console now has persistent launch-token recovery, refresh-safe hash routes, stable Impact navigation in every data state, an actionable offline-Evals empty state, and a safer candidate-review hierarchy. The change closes the user-journey failures found through OpenCLI without widening Observation capture or write authority.

## Current State

This UX recovery milestone is complete; Overview, Evals, and review-candidate deep links were verified against the running local service, while Team-authenticated sharing and governed Eval-case persistence remain future work.

## Git And Persistent State

- Branch: `main`; the worktree contains this milestone plus pre-existing uncommitted Learning, design, Observation, Evals, Skill, docs, and Web changes.
- No commit, push, release, package-version change, global install, candidate acceptance, Eval-case write, or production Observation Ledger was created.
- The local Web service is running on port 4737 from the current source. Restarting it invalidates older browser tokens by design.
- Existing pending candidates remain unaccepted. Post-flight candidates are also pending as `cand-001` in sessions `2026-08-30-capture-remove-terminally-unavailable-ui-from-the-semantic-dom` and `2026-08-30-capture-avoid-powershell-native-json-transport-that-rewrites-the`.

## Key Decisions

- Hash routes carry view and item IDs, never the registered project's absolute path. They restore the current local workspace but are not yet Team share links.
- A candidate with any quality warning is recommended for editing even when its numerical score is at least 0.8; old persisted suggestions are normalized in summaries and the Web presentation.
- `Accept anyway` and supersession controls appear only after a possible conflict. Normal review leads with Save draft, Accept and save, and Reject; agent authorization stays under More options.
- Terminal authentication failure removes the unusable workspace from the DOM and shows one localized recovery surface with `codetrap web --open`.

## Changed Surfaces

- `src/web/client-route.ts`, `client-script.ts`: route codec, history restoration, selected Run/candidate loading, page titles, and auth recovery.
- `src/web/client-impact.ts`, `client-text.ts`, `static.ts`: state-stable tabs, offline-Evals CTA, distinct queue copy, percentage metrics, action hierarchy, semantics, and bilingual terminology.
- `src/lib/trap-quality.ts`, `session-review.ts`: warning-aware recommendations and queue totals.
- Web, quality, CLI, and browser smoke tests: route, reload, recovery, copy, recommendation, and generated-script contracts.

## Cross-Module References

- Depends on: [Observational Evals v1](../2026-08-30-observational-evals-v1/handoff.md) - real-data Evals and Impact state projections.
- Depends on: [Agent/user experience hardening](../2026-08-27-agent-user-experience-hardening/handoff.md) - launch-token and candidate-review contracts.
- Referenced by: future Team links and governed Eval-candidate workflow.

## Red Lines And Gotchas

- Do not put absolute project paths or launch tokens into persistent hash routes.
- Do not expose conflict overrides before the backend reports a possible conflict.
- OpenCLI updates advertised by its diagnostics were not installed; they are environment notices, not Codetrap failures.
- The Playwright browser smoke remains intentionally skipped on this Windows host; OpenCLI supplied read-only rendered-page evidence, not click automation.

## Validation

- `bun test`: 491 pass, 1 intentional Windows browser skip, 0 fail (492 tests, 2414 expectations).
- Focused Web/Observation/quality/browser command: 34 pass, 1 intentional skip, 0 fail (320 expectations).
- `bun run typecheck`, `bun run build`, and `git diff --check`: passed; both Windows binaries compiled.
- OpenCLI: invalid token rendered only the localized recovery workflow with bootstrap 401; direct Overview, Evals, and candidate routes rendered with expected content and all authenticated API calls returned 200.

## Restart Verify

```powershell
bun run typecheck  # expected: exit 0; mismatch means the route/domain/generated-client contracts drifted
bun test src/tests/web-client-route.test.ts src/tests/web-client-script.test.ts src/tests/web-client-text.test.ts src/tests/experience-hardening.test.ts src/tests/observation-web.test.ts src/tests/web-browser-smoke.test.ts  # expected: 34 pass, 1 intentional skip, 0 fail
bun run src/index.ts web --open  # expected: a fresh authorized tab; #/impact/evals survives refresh and shows 24 retrieval cases
```

## Next Steps

1. Build the governed Eval-candidate preview/edit/accept/reject and rollback workflow; it is the highest-ROI remaining link between observed evidence and durable test cases.
2. Add Team-authenticated share identities before treating local hash routes as cross-user links.
3. Run the Playwright smoke on Linux/CI or a supported local Chrome path so click/back/forward behavior has an executable browser gate.

## Docs And Wiki

- Rewritten: product design progress, parent roadmap, README, installation guide, task index, and NEXT-SESSION.
- Created: this dossier and the pure Web route module.
- Wiki not created: the repository has no hand-maintained wiki.

## Implementation Log

- [implementation-log.md](implementation-log.md) records the privacy, route, semantic-hiding, quality-recommendation, and override-action decisions.
