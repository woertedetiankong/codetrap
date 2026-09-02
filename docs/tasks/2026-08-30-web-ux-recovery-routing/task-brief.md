# Task Brief: Web UX Recovery And Routing

> Created: 2026-08-30
> Parent plan: [Agent Experience Compiler roadmap](../../agent-experience-compiler-roadmap.md)
> Status: Done

## Goal

Make the local Web console recoverable, addressable, and action-oriented so users always know where they are, how to reach Evals, and which review action is safe.

## Success Criteria

- A missing or expired launch token produces a persistent localized recovery screen instead of a partially rendered console.
- Review, Library, Learning, Embeddings, Impact Overview, Impact Evals, Impact Run, and selected review candidates have refresh-safe hash routes with browser back/forward support.
- Impact tabs remain visible in loading, empty, and error states, and the unconfigured Overview offers a direct path to existing offline Evals.
- Candidate actions distinguish the primary workflow from conflict-only overrides; Chinese status and candidate-kind terms use one user-facing vocabulary.
- Route parsing, generated browser script, localization, responsive styling, and existing Observation privacy contracts have regression coverage.

## Scope

In scope:

- Local Web bootstrap recovery, client-side hash routing, and selection restoration.
- Impact shell state handling and empty-state actions.
- Candidate review action hierarchy, quality recommendation presentation, and Chinese terminology.
- Tests and current implementation documentation.

Out of scope:

- Team authentication, remote sharing, RBAC, server-side routing, or exposing project paths in URLs.
- Automatic Agent calls, Eval-case persistence, controlled model execution, or background observation.
- Changing candidate acceptance authorization or Observation privacy boundaries.

## Constraints

- Launch tokens remain in session storage and are removed from browser history.
- Routes identify only the current local workspace view and item; they must not encode the registered project's absolute path.
- Read-only navigation must not create a Ledger, candidate, trap, or Learning entry.
- Preserve all pre-existing uncommitted work. Do not accept candidates, commit, push, release, install globally, or change the package version.

## Expected Knowledge Updates

- Rewrite affected workflow descriptions in the Impact/Evals design, parent roadmap, task index, and next-session handoff.
- Task index: update expected.
- Wiki: not created; this repository has no hand-maintained wiki.
