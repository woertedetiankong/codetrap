# Candidate Review Visibility Handoff

## Summary

The Candidate Review Visibility Loop is implemented and verified. Pending session candidates are now visible through CLI, doctor, Web API, and the Web Review UI, while confirmed trap storage and search behavior remain unchanged.

This handoff is the compact next-session entrypoint for the visibility pass. The broader historical handoff and log remain in `../handoff.md` and `../implementation-log.md`; the task-scoped log is `implementation-log.md`. For the 2026-06-05 Workbench follow-up, also read `../candidate-review-workbench/handoff.md`.

Follow-up architecture work deepened the Web Review client by extracting pending-session and queue-state behavior into `src/web/client-review.ts`. The browser script now renders that model instead of owning candidate selection, filtering, and sorting directly.

## Current State

- A durable goal package exists at `goals/candidate-review-visibility/`.
- `brief.md`, `plan.md`, `verification.md`, `blockers.md`, and `goal-prompt.md` all passed Plannotator gates.
- `progress.jsonl` contains implementation, validation, ESP32 dogfood, search-boundary, and gate evidence.
- The in-app browser was verified against the local Web Review page. The previous local server may still be running on port `4737`; restart with `codetrap web` if needed.

## Key Decisions

- Candidate review counts are derived from existing session files and `candidate-traps.json`.
- No database migration, candidate schema change, daemon, batch review, MCP session tool, or embedding/provider work was added.
- `src/lib/session-review.ts` owns candidate review summary types and helpers.
- `SessionOperations` is the shared service layer for CLI/Web candidate review visibility.
- `doctor` gets review summary data from the CLI workflow layer so projects without sessions can still run doctor safely.
- Web Review defaults to the first pending session but still allows sessions with no pending candidates to be selected.
- Pending candidates remain outside confirmed trap search until explicitly accepted.
- Web Review candidate selection and queue modeling now live behind the `client-review` Module Interface and are tested directly with behavior tests before being embedded into the browser script.

## Files Changed

- `goals/candidate-review-visibility/`: goal package and evidence log.
- `src/lib/session-review.ts`: candidate review count and summary helpers.
- `src/lib/session-operations.ts`: enriched session status/list and project-level review summary.
- `src/lib/doctor.ts`: `candidate_review` report section and review next actions.
- `src/commands/workflow.ts`: CLI status/list/doctor rendering and JSON wiring.
- `src/web/server.ts`: `/api/sessions` review metadata.
- `src/web/client-review.ts`: pure Web Review model for pending-session selection, queue counts, visible candidate sorting, selected-candidate fallback, and summary visibility.
- `src/web/client-script.ts`: pending-session default selection and review summary rendering.
- `src/web/static.ts`: review summary container and styling.
- `src/web/client-text.ts`: review summary and pending count strings.
- `src/tests/session-cli.test.ts`, `src/tests/cli-json.test.ts`, `src/tests/web-console.test.ts`, `src/tests/web-client-text.test.ts`, `src/tests/web-client-review.test.ts`: regression coverage.
- `README.md`, `docs/installation.md`, `plugins/codetrap-agent/templates/AGENTS.codetrap.md`, and codetrap skill docs: updated guidance.

## Validation

- Targeted candidate visibility tests passed.
- Full `bun test src/tests` passed.
- `bunx tsc --noEmit` passed.
- `bun run eval:dogfood -- report` passed with 24 cases and perfect deterministic recall metrics.
- ESP32 dogfood passed against `/Users/superstorm/Documents/Code/esp32`:
  - Session `2026-06-04-codetrap-candidate-inbox-test` shows 3 pending candidates.
  - `session list`, `session status`, `doctor`, `/api/sessions`, and Web Review all surface the pending work.
  - `stats --json` still reports 8 confirmed project traps.
  - Searching a pending candidate title did not search the pending candidate as a confirmed trap.
- `git diff --check` passed.
- After the Web Review model refactor, full `bun test src/tests` passed with 98 tests, `bunx tsc --noEmit` passed, dogfood eval still reported Recall@3 1 / Recall@5 1 / MRR 1, and in-app browser verification showed the ESP32 Review page still displaying 3 pending candidates.

## Known Risks

- The repository has unrelated existing uncommitted work. Review diffs by path and do not revert changes outside the current scope.
- Browser verification was a smoke check of the Review state, not a full responsive or interaction matrix.
- Some current files in the worktree come from earlier session-capture and embedding-runtime work; separate those carefully if preparing a commit.

## Suggested Next Session

1. Inspect `git status --short` and separate current-scope changes from pre-existing dirty work.
2. Re-run `bun test src/tests`, `bunx tsc --noEmit`, and `bun run eval:dogfood -- report` before commit.
3. Manually spot-check `/Users/superstorm/Documents/Code/esp32` if candidate review UX is changed again.
4. Consider a future goal only after this lands: batch review triage, notification surfacing, or MCP session tooling. Each should be a separate scoped goal.

## Resume Prompt

Use this prompt to start the next session:

```text
Resume codetrap development from docs/candidate-review-visibility/handoff.md and docs/candidate-review-visibility/implementation-log.md. Preserve unrelated dirty work. First inspect git status and the goal package at goals/candidate-review-visibility/. Continue only within the requested follow-up scope, using SessionOperations and session-review for backend candidate review behavior and src/web/client-review.ts for Web Review state behavior.
```
