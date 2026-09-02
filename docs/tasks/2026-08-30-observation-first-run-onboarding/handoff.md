---
title: Handoff 2026-08-30 - Observation First-Run Onboarding
status: Complete
updated: 2026-08-30
---

# Handoff

## Summary

Empty Impact Overview/Runs now explains the Observation model in plain language and offers a one-click five-event sample timeline. The sample is explicitly synthetic, lives only in browser memory, and teaches the UI without contaminating the append-only evidence ledger or real metrics.

## Current State

This onboarding slice is complete; real Codex/Claude capture remains explicit CLI/MCP work, while opt-in automatic Agent lifecycle integration is the highest-ROI next observation milestone.

## Git And Persistent State

- Branch: `main`; the worktree contains this milestone plus pre-existing uncommitted Learning, Observation, Evals, Skill, docs, and Web changes.
- No commit, push, release, package-version change, global install, candidate acceptance, synthetic Ledger write, or Eval-case write occurred.
- The user-authorized real demo Run `demo-ui-20260830142510` remains in the codetrap project's append-only local ledger from the preceding walkthrough.

## Environment State

- The latest Web service is running on port 4737 from current source; a fresh authorized browser tab was opened after the final restart.
- OpenCLI updates advertised by its diagnostics were not installed.

## Key Decisions

- A sample must not be appended to the Observation Ledger because synthetic evidence would permanently distort factual Overview/Evals totals.
- The sample uses the existing privacy-safe timeline renderer but is held in `state.observationDemoRun`; reload or project reset removes it.
- The connection guide gives users a short instruction for their Agent instead of asking them to hand-author JSON. It accurately states that automatic transcript/background capture is not available.
- Every browser-visible development slice now requires OpenCLI rendered-state and postcondition verification in project `AGENTS.md`.

## Changed Surfaces

- `src/web/client-impact.ts`, `client-script.ts`: first-run flow, sample state/timeline, Agent connection guide, copy action, exit, and real-run precedence.
- `src/web/client-text.ts`, `static.ts`: bilingual onboarding language and blue flight-recorder responsive presentation.
- `src/tests/web-client-script.test.ts`, `web-client-text.test.ts`: browser-memory/no-write, localization, generated-script, and styling contracts.
- `AGENTS.md`, README, installation and product design: OpenCLI completion gate and current observation onboarding workflow.

## Cross-Module References

- Depends on: [Impact Overview/Runs](../2026-08-30-impact-overview-runs/handoff.md) - privacy-safe real projections and timeline renderer.
- Depends on: [Web UX recovery](../2026-08-30-web-ux-recovery-routing/handoff.md) - stable local routing and empty-state navigation.
- Referenced by: future opt-in Codex/Claude automatic observation integration.

## Red Lines And Gotchas

- Do not persist sample Runs or count them in Overview/Evals.
- Do not describe explicit CLI/MCP capture as automatic Agent observation.
- OpenCLI background `click`/keyboard commands reported success without changing this local page; use URL/DOM/network postconditions, and distinguish bridge input behavior from application behavior.

## Validation

- `bun test`: 492 pass, 1 intentional Windows browser skip, 0 fail (493 tests, 2432 expectations).
- Focused Web/Observation command: 32 pass, 1 intentional skip, 0 fail (326 expectations).
- `bun run typecheck`, `bun run build`, and `git diff --check`: passed; both Windows binaries compiled.
- OpenCLI empty-state extraction showed the unsaved-example promise and three-step flow; sample activation produced `#/impact/runs`, five timeline events, and `1 unsaved example`.
- OpenCLI network capture showed GET-only bootstrap/sessions/Overview/Runs requests; the isolated project still had no Observation Ledger after preview. Final screenshot confirmed the `completed` metric no longer wrapped.

## Restart Verify

```powershell
bun run typecheck  # expected: exit 0; mismatch means generated-client or localization contracts drifted
bun test src/tests/web-client-script.test.ts src/tests/web-client-text.test.ts src/tests/experience-hardening.test.ts src/tests/observation-web.test.ts src/tests/web-browser-smoke.test.ts  # expected: 32 pass, 1 intentional Windows skip, 0 fail
bun run src/index.ts web --open  # expected: an empty project can preview five unsaved events with no POST or Ledger creation
```

## Next Steps

1. Design the smallest opt-in Codex/Claude automatic Run lifecycle integration so normal Agent work produces real metadata-only evidence without transcript scanning.
2. Then build governed Eval-candidate preview/edit/accept/reject and rollback, preserving observation-versus-ground-truth boundaries.
3. Keep OpenCLI semantic, interaction-postcondition, network, and screenshot checks in every browser-visible slice.

## Docs And Wiki

- Rewritten: `AGENTS.md`, README, installation, Impact/Evals design progress, parent roadmap, task index, and NEXT-SESSION.
- Created: this dossier and handoff.
- Wiki not created: the repository has no hand-maintained wiki.

## Implementation Log

- [implementation-log.md](implementation-log.md) records the synthetic-evidence rejection and OpenCLI validation discoveries.
