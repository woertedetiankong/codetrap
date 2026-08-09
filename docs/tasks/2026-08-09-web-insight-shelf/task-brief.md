# Task Brief: Web Insight Shelf

> Created: 2026-08-09
> Parent plan: [Agent Experience Compiler roadmap](../../agent-experience-compiler-roadmap.md)
> Status: Done (implementation; awaiting user-directed commit)

## Goal

Replace the misleading trap-derived Insights dashboard with a Web learning
surface backed by the real Phase 2 Insight Shelf, while keeping only actionable
trap-health signals in the library.

## Success Criteria

- The primary navigation no longer labels trap analytics as Insights.
- The library shows compact, actionable health signals instead of duplicate
  category/module/tag charts and recent-trap lists.
- The learning view reads Phase 2 insight records, never `/api/traps`.
- Users can inspect insight title, summary, body, tags, shelf time, consultation
  count, and explicitly mark an insight as consulted.
- An empty shelf explains that traps are not copied into learning insights.
- API and UI tests prove trap/insight separation, consultation mutation, token
  protection, project-registry isolation, and bilingual text coverage.

## Scope

In scope:

- Web server routes for listing and consulting Phase 2 insights.
- Web navigation, library health summary, learning shelf/detail, empty state,
  and English/Chinese text.
- Relevant tests and current-facing README/docs reconciliation.

Out of scope:

- Changing the Phase 2 insight storage schema or CLI contract.
- Automatically converting existing traps into insights.
- Reintroducing a standalone descriptive analytics dashboard.

## Constraints

- Reuse `Phase2Store`/`Phase2Operations`; do not duplicate insight persistence.
- Preserve the launch-token and registered-project isolation used by all Web
  APIs.
- Consultation is explicit; merely opening an insight must not increment it.
- Do not commit, merge, or push without a separate user request.

## Expected Knowledge Updates

- Rewrite the README Web-console description and Insight Shelf workflow.
- Update the parent roadmap closed decisions, task index, latest handoff, and
  `docs/tasks/NEXT-SESSION.md`.
- No project wiki exists; do not create one.
