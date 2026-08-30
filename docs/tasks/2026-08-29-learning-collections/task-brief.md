# Task Brief: Learning Collections and Ordered Study

> Created: 2026-08-29
> Parent plan: [Agent Experience Compiler roadmap](../../agent-experience-compiler-roadmap.md)
> Status: Done

## Goal

Turn the flat Phase 2 Insight Shelf into a source-aware learning library with
ordered collections, progress, project/global views, and lightweight filters.

## Success Criteria

- Insights captured from one source can share an explicit collection and stable
  recommended order without weakening individual review or rollback.
- Existing v1 shelves load unchanged; legacy entries can be inferred into
  source collections without losing ids, content, provenance, or learned state.
- The Web Learning view supports all registered projects or the current project,
  collection progress, source/status/tag filters, and previous/next navigation.
- External-source and AI-session learning candidates can carry collection and
  source metadata while traps remain separate.
- API, UI, migration, isolation, rollback, and bilingual tests pass.

## Scope

In scope:

- Backward-compatible Phase 2 insight/collection storage and operations.
- Registered-project aggregation and collection mutation Web APIs.
- Learning collection directory/detail interactions and filtering.
- Bundled external-capture and learning-review metadata guidance.
- Focused tests and current-facing documentation reconciliation.

Out of scope:

- Mandatory chapter unlocking, quizzes, spaced repetition, or mastery scoring.
- User-curated cross-source learning paths.
- A second home-global writable learning store detached from projects.
- Automatic background mining of AI conversations.
- Commit, push, release, versioning, or global installation.

## Constraints

- Preserve the explicit candidate review/authorization/apply boundary and keep
  the Insight Shelf separate from runtime traps.
- Keep project files as the source of truth; the all-project view may aggregate
  only projects registered in the Web console.
- Opening content remains read-only and **Mark learned** remains idempotent.
- Preserve existing project-registry authorization and rollback snapshot rules.
- Preserve unrelated user changes already present in the working tree.

## Expected Knowledge Updates

- Rewrite the README Learning workflow and relevant bundled Skill guidance.
- Update the parent roadmap status dashboard and task index.
- Refresh `docs/tasks/NEXT-SESSION.md` and create a restart-ready handoff.
- Task index: update required because this spans store, API, Web UI, skills, and tests.
- Project wiki: not required; no hand-maintained wiki exists.
