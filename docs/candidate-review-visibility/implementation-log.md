# Candidate Review Visibility Implementation Log

## Task

Preserve the implementation memory for the Candidate Review Visibility Loop so the next development session can resume without rereading the full historical `docs/implementation-log.md`.

## Assumptions

- Pending candidates are review material, not confirmed traps.
- Existing session files and `candidate-traps.json` remain the source of truth for review visibility.
- JSON additions should stay additive and backward-compatible.
- CLI JSON is still the primary agent-facing surface; Web and MCP should remain thin adapters.

## Log

### 2026-06-03

- The session capture flow was completed before this visibility pass. At the time, agent-drafted post-flight lessons used `codetrap session capture --trap-json ...`; as of 2026-06-05, the preferred agent path is `codetrap session capture --trap-markdown - --kind review --json`, with `--trap-json` kept for structured callers. Both paths land in the session candidate inbox instead of writing directly to `traps.db`.
- Candidate state was split across focused modules: `session-capture.ts` handles capture normalization/evidence/dedupe, `session-candidate-document.ts` handles pure candidate document transitions, and `session-review.ts` handles shared review payloads.
- This created the right foundation for visibility work: future adapters should ask `SessionOperations` and `session-review` for candidate state instead of reconstructing it in CLI or Web code.

### 2026-06-04

- The visibility gap was not persistence, it was discoverability. Closed sessions could contain proposed candidates, but `doctor`, `session status/list`, and default Web Review did not make that work obvious.
- Implemented file-derived review summaries in `src/lib/session-review.ts`. Counts are computed from loaded session metadata plus `candidate-traps.json`; no old session index files need backfills.
- Wired review summaries through `SessionOperations`, `doctor`, CLI session status/list, `/api/sessions`, and Web Review. This keeps the behavior shared while allowing CLI/Web to render differently.
- Text output now calls attention to pending review work. JSON output adds `candidate_review`, `pending_count`, `reviewed_count`, `high_quality_pending_count`, and `needs_edit_count` fields without removing existing fields.
- Web Review now prefers the first session with pending candidates and shows a project-level pending banner. Existing single-candidate accept/edit/reject/supersede behavior was intentionally left unchanged.
- Docs and agent guidance now point users to `doctor`, `session status/list`, and `codetrap web` for candidate review visibility while preserving the rule that candidates require explicit accept before becoming traps.
- ESP32 dogfood verified the boundary: session `2026-06-04-codetrap-candidate-inbox-test` shows 3 pending candidates through CLI/API/Web, while confirmed project stats remain 8 traps and pending candidates are not searched as confirmed traps.
- Plannotator approved all goal package docs under `goals/candidate-review-visibility/`.
- Follow-up architecture pass with `improve-codebase-architecture` and TDD found that the backend Session review path has useful Depth, while the Web Review client had weak Locality: session selection, candidate filtering/sorting, and candidate selection lived inside the generated browser script and were mostly protected by string-presence tests.
- Added `src/web/client-review.ts` as the Web Review model Module. Its Interface covers pending-session selection and queue modeling, while the browser script acts as an Adapter that renders the model into DOM.
- Used vertical TDD: first test proved pending-session selection, then a second test proved queue counts, visible candidate filtering, quality ordering, selected-candidate fallback, and summary visibility. Only after those tests were green did the browser script switch to the new Module.
- Browser verification after the refactor confirmed the ESP32 Review page still showed 3 pending candidates, the project-level pending banner, and the expected pending session.

## Validation Snapshot

- `bun test src/tests/session-cli.test.ts src/tests/cli-json.test.ts src/tests/web-console.test.ts src/tests/web-client-text.test.ts` passed.
- `bun test src/tests` passed.
- `bunx tsc --noEmit` passed.
- `bun run eval:dogfood -- report` passed with 24 cases, Recall@3 1, Recall@5 1, MRR 1.
- `git diff --check` passed.
- After the Web Review model refactor, `bun test src/tests`, `bunx tsc --noEmit`, `bun run eval:dogfood -- report`, and `git diff --check` passed again.

## Next-Session Notes

- Start by reviewing the current dirty worktree; it includes unrelated earlier changes, so avoid broad cleanup or reverting.
- If continuing this feature, keep follow-up work scoped to candidate review UX. Batch review, notifications, MCP session tools, and embedding/provider changes were explicitly out of scope for this pass.
- The safest next implementation seam is still `SessionOperations` plus `session-review`; avoid duplicating candidate counts in adapters.
