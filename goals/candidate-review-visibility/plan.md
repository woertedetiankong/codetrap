# Candidate Review Visibility Plan

## Summary

Add a file-derived candidate review summary and surface it through CLI, doctor, and Web. The implementation should make pending candidates obvious without changing storage shape or review semantics.

## Implementation Slices

1. Add shared review summary helpers that count pending, reviewed, accepted, rejected, high-quality pending, and needs-edit candidates from `candidate-traps.json`.
2. Enrich `SessionOperations` list/status outputs with per-session and project-level review summaries.
3. Add a `candidate_review` section and next actions to `doctor`.
4. Enrich the Web sessions API and browser review view so it defaults to the first session with pending candidates and shows project-level pending counts.
5. Update docs and guidance to mention `doctor`, `session status/list`, and `codetrap web` as candidate review entrypoints.

## Acceptance Criteria

- `codetrap session list --json` includes additive pending/reviewed review counts per session.
- `codetrap session status --json` includes a project-level candidate review summary.
- Text `session status` mentions pending review work when no active session exists.
- `codetrap doctor --json` includes `candidate_review`, and text doctor includes pending counts and next actions.
- `/api/sessions` includes candidate review metadata and lets the browser choose a pending session by default.
- Existing accept/edit/reject/supersede flows still work unchanged.

## Risks

- Old session index files may not contain new fields, so all new counts must be derived at read time.
- Web default selection must not hide sessions with no pending candidates; it should merely prefer pending sessions.
- Doctor should avoid requiring `.codetrap/sessions/` in projects that have no sessions.
