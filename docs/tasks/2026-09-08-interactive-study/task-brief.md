# Interactive study artifacts

Created: 2026-09-08
Status: Complete
Parent plan: None found; approved conversation proposal.

## Goal

Generate self-contained interactive lessons through an agent skill, attach them
to existing Learning insights or collections, and study them in the local console.

## Success Criteria

Copied files survive source deletion; versions remain accessible; wrong targets
and stale updates fail; script execution works without parent/API access; text,
notes and progress remain available; lessons do not auto-promote agent memory.

Validation: 104/104 repository test files pass; typecheck and check:web pass;
skill validator passes. An isolated browser check imported the real 571,840-byte
Portal offline lesson, exercised a routing control and chapter 12, and verified
downloaded HTML matches the original.

## Scope

Immutable HTML versions and optimistic updates; CLI import/list/show/export/restore;
authenticated read API; sandboxed player; setup-distributed codetrap-study skill;
documentation and tests.

## Constraints

Reuse existing Learning records and approval flow. No model service, hosted
publishing, automatic grading/progress bridge or arbitrary folder/ZIP imports.
Do not seed test records into the real project or restart existing services.
