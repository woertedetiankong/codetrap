# Candidate Review Workbench Implementation Log

## Task

Implement Candidate Review Workbench v1 using agent-team support: improve the Web Review flow so pending candidate traps can be polished and triaged more easily after Markdown capture.

## Assumptions

- Web Review should stay a thin adapter over existing SessionOperations and session-review behavior.
- Candidate traps remain unconfirmed until explicit accept.
- v1 should not add database migrations, MCP session tools, batch accept, or raw-log inference.
- The worktree is already dirty; changes must be scoped and must not revert unrelated work.

## Log

### 2026-06-05

- Spawned two explorer agents: Noether for Web Review UX/client shape and Bacon for backend/API/test contracts. I am keeping final implementation and integration local to avoid conflicting edits in the dirty worktree.
- Pre-edit codetrap search for Web Review candidate editing returned no direct results, so no known trap changes the implementation direction.
- Agent-team findings converged on the same risk: Web Review already has Save and Accept, but accepting after form edits can lose unsaved polished fields.
- Implemented the narrow Workbench v1 contract: Web accept now supports an optional `trap` edit, and the client sends the current candidate form for Accept, Accept anyway, and Supersede.
- Added a compact action-bar hint so reviewers know the visible draft is what acceptance uses; dirty form edits get a stronger hint.
- Added Web API regression coverage for accept-with-inline-edit writing the edited draft to the confirmed trap.
- Targeted Web tests passed: `bun test src/tests/web-console.test.ts src/tests/web-client-text.test.ts src/tests/web-client-review.test.ts`.
- Type-check passed: `bunx tsc --noEmit`.
- Full test suite passed: `bun test src/tests`.
- Dogfood eval passed: `bun run eval:dogfood -- report` with Recall@3/Recall@5/MRR all `1`.
- Browser smoke check passed against `codetrap web --port 4789`: the action hint rendered as `Accept uses the current draft.` and switched to `Unsaved edits will be accepted.` after editing the candidate title.
- Deleted the temporary browser-verification session `2026-06-05-capture-verify-web-review-draft-accept-hint` through the Web API after the smoke check.
- Captured the review finding as a pending candidate trap, not confirmed: session `2026-06-05-capture-web-accept-actions-must-carry-visible-draft-edits`, candidate `cand-001`.
- Follow-up architecture review identified two worthwhile refinements:
  - Move visible candidate draft/request normalization out of the generated browser script and into the tested Web Review Module.
  - Split Session Review conflict payloads so Web/MCP receive a transport-neutral payload while CLI renders command-oriented `next_actions`.
- TDD slice 1:
  - RED: added a `web-client-review` behavior test for building candidate mutation payloads from the visible review draft.
  - GREEN: added `reviewCandidateTrapDraft` and `reviewCandidateMutationPayload` in `src/web/client-review.ts`.
  - REFACTOR: updated `src/web/client-script.ts` to use the Review Module instead of duplicating list/null normalization in DOM event handlers.
- TDD slice 2:
  - RED: updated `session-review` tests to expect neutral conflict payloads and separate CLI next actions.
  - GREEN: added `sessionCliConflictPayload`; `sessionConflictPayload` no longer includes `next_actions`.
  - REFACTOR: updated CLI workflow to render CLI conflict JSON from `sessionCliConflictPayload`; Web conflict payloads remain neutral.
- Added Web API regression assertions that 409 conflict payloads do not leak CLI `next_actions`.
- Follow-up targeted tests passed: `bun test src/tests/web-client-review.test.ts src/tests/session-review.test.ts src/tests/web-console.test.ts src/tests/session-cli.test.ts`.
- Follow-up type-check passed: `bunx tsc --noEmit`.
- Follow-up full test suite passed: `bun test src/tests`.
- Follow-up dogfood eval passed: `bun run eval:dogfood -- report`.
- Follow-up browser smoke check passed against `codetrap web --port 4791`: candidate detail still rendered and the action hint showed `Accept uses the current draft.`.
