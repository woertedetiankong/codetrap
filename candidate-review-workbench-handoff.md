# Handoff

## Summary

Candidate Review Workbench v1 is complete. The Web Review UI now treats the visible candidate form as the draft that will be accepted, so reviewers can polish a Markdown-captured candidate and click Accept without losing unsaved edits.

The follow-up architecture pass is also complete: Review candidate draft request modeling now lives in a tested Web Review Module, and Session Review conflict payloads are transport-neutral with CLI next actions rendered by the CLI adapter.

## Key Decisions

- Keep v1 focused on single-candidate draft safety, not batch accept or automated inference.
- Use the existing `SessionOperations.acceptCandidate({ edit })` domain capability instead of adding a new persistence path.
- Preserve the confirmed-trap boundary: candidates still become traps only after explicit Accept, Accept anyway, or Supersede.
- Show a compact action-bar hint instead of redesigning the whole Review pane.
- Keep browser DOM behavior in `src/web/client-script.ts`, but move draft-to-request normalization into `src/web/client-review.ts`.
- Keep `sessionConflictPayload` neutral; add CLI-specific `next_actions` only through `sessionCliConflictPayload`.

## Files Changed

- `src/web/server.ts`: `/api/candidate/accept` accepts optional `trap` edits and passes them into session operations.
- `src/web/client-review.ts`: owns Review queue selection plus candidate draft/request normalization for save and accept flows.
- `src/web/client-script.ts`: Accept, Accept anyway, and Supersede send the current candidate form as an accept-time edit through the Review Module; the action bar tracks draft dirtiness.
- `src/web/client-text.ts`: added aligned English/Chinese hint text.
- `src/web/static.ts`: added compact action-hint styling.
- `src/lib/session-review.ts`: split neutral conflict payload from CLI conflict payload with `sessionCliConflictPayload`.
- `src/commands/workflow.ts`: CLI conflict JSON still includes `next_actions`, sourced from the CLI presenter.
- `src/tests/web-client-review.test.ts`: covers visible candidate draft normalization and mutation payload construction.
- `src/tests/session-review.test.ts`: covers neutral conflict payload and CLI next-action rendering.
- `src/tests/web-console.test.ts`: covers accept-with-inline-edit and confirms Web conflict payloads do not leak CLI `next_actions`.
- `candidate-review-workbench-implementation-log.md`: recorded agent-team findings, implementation decisions, and validation.

## Validation

- `bun test src/tests/web-console.test.ts src/tests/web-client-text.test.ts src/tests/web-client-review.test.ts`
- `bun test src/tests/web-client-review.test.ts src/tests/session-review.test.ts src/tests/web-console.test.ts src/tests/session-cli.test.ts`
- `bunx tsc --noEmit`
- `bun test src/tests`
- `bun run eval:dogfood -- report`
- Browser smoke check against `codetrap web --port 4789`: candidate detail showed `Accept uses the current draft.`, then changed to `Unsaved edits will be accepted.` after editing the title.
- Browser smoke check after the architecture pass against `codetrap web --port 4791`: candidate detail still rendered and the action hint still showed `Accept uses the current draft.`.
- Captured the agent-team review finding as a pending trap candidate: session `2026-06-05-capture-web-accept-actions-must-carry-visible-draft-edits`, candidate `cand-001`.

## Known Risks

- The worktree already contains unrelated dirty and untracked files. Review diffs by path before staging.
- API validation for malformed accept-time `trap` edits still relies on existing session-capture normalization errors; a future polish pass can map those to friendlier Web `400` payloads.
- The captured review-finding trap remains pending and needs a human accept/edit/reject decision.
- The repo has a very dirty worktree with multiple feature lines. Stage paths intentionally; do not assume all modified files belong to this Workbench pass.

## Follow-ups

- Add a small Web/API test for malformed accept-time edits returning a user-friendly error.
- Consider a quality-warning quick filter once more candidate inbox usage accumulates.
- Defer batch accept and raw-log inference until the single-candidate review loop feels stable.
