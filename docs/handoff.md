# Handoff

## Summary

The current worktree includes three connected milestones through 2026-06-05 plus one maintainer eval addition:

- Markdown Trap Capture: `codetrap session capture` accepts `--trap-markdown -`, inline Markdown, Markdown files, and the existing `--trap-json` path. Markdown is the preferred agent-drafted post-flight entry because it avoids shell-escaped JSON.
- Candidate Review Visibility + Workbench: pending session candidates are visible through CLI status/list, doctor, `/api/sessions`, and Web Review. In Web Review, Accept, Accept anyway, and Supersede use the currently visible candidate draft so reviewers do not lose unsaved edits.
- Review architecture pass: Web Review draft/request modeling moved into `src/web/client-review.ts`, and `src/lib/session-review.ts` now keeps base conflict payloads transport-neutral while CLI `next_actions` are added by `sessionCliConflictPayload`.
- Search Policy Sweep: `bun run eval:search-policy -- fixture` compares several ranking configs against the deterministic fixture, and `bun run eval:search-policy -- live --cwd <project>` can score real project/global `.codetrap/traps.db` data with scope-aware gold matching through the existing Scope Context boundary.

Confirmed trap search remains unchanged: proposed and rejected candidates do not enter `traps.db` or normal search until explicit accept.

## Task-Specific Journals

- Markdown Trap Capture: [handoff](trap-markdown-capture/handoff.md), [implementation log](trap-markdown-capture/implementation-log.md). Use this pair for Markdown-first `session capture` input, deterministic trap field parsing, and candidate-inbox capture behavior.
- Candidate Review Visibility: [handoff](candidate-review-visibility/handoff.md), [implementation log](candidate-review-visibility/implementation-log.md). Use this pair for pending-candidate counts, CLI/doctor/Web visibility, and the confirmed-search boundary.
- Candidate Review Workbench: [handoff](candidate-review-workbench/handoff.md), [implementation log](candidate-review-workbench/implementation-log.md). Use this pair for Web Review draft-safe Accept, Accept anyway, Supersede, and Review Module request modeling.
- Agent First-Run Success: [handoff](agent-first-run-success/handoff.md), [implementation log](agent-first-run-success/implementation-log.md). Use this pair for release-ready agent onboarding guidance, packaged plugin hooks, relevance-gate wording, and asset drift tests.
- Web Embeddings Settings: [handoff](web-embeddings-settings/handoff.md), [implementation log](web-embeddings-settings/implementation-log.md). Use this pair for the Web Embeddings/Semantic Search panel, provider switching, and project/global reindex controls.

## Key Decisions

- Markdown capture is deterministic parsing only; it does not infer lessons from raw logs.
- Session capture writes candidate inbox entries and evidence, never confirmed traps.
- `SessionOperations` remains the shared execution layer for candidate accept/reject, accept-time edits, conflict checks, evidence, and supersede behavior.
- `src/lib/session-review.ts` owns shared review payloads and neutral conflict payloads; CLI-only command guidance is layered on by the CLI adapter.
- `src/web/client-review.ts` owns Review queue state plus candidate draft/request normalization; `src/web/client-script.ts` composes Web modules and DOM event handling.
- Web/API 409 conflict payloads should not leak CLI `next_actions`.
- Search policy sweep remains a maintainer experiment tool, not a public `codetrap` CLI command. Live evals should prefer `scope + id + title` gold targets so id drift can be reported without silently failing title-stable cases. Ranking config overrides pass through `ScopedRepositoryContext` to `TrapRepository`, rather than reopening project/global databases inside the sweep module.

## Files Changed

- `src/lib/session-capture.ts`, `src/lib/command-requests.ts`, `src/commands/workflow.ts`: Markdown capture parser/input wiring plus reuse of existing capture scoring, dedupe, and evidence logic.
- `src/web/server.ts`: Web candidate accept accepts optional inline `trap` edits.
- `src/web/client-review.ts`, `src/web/client-script.ts`, `src/web/client-text.ts`, `src/web/static.ts`: Web Review Workbench draft-safe accept flow, dirty hint, and Review Module extraction.
- `src/lib/session-review.ts`, `src/commands/workflow.ts`: neutral conflict payload split plus CLI conflict presenter.
- `src/tests/session-cli.test.ts`, `src/tests/cli-json.test.ts`, `src/tests/web-console.test.ts`, `src/tests/web-client-text.test.ts`, `src/tests/web-client-review.test.ts`, `src/tests/session-review.test.ts`: coverage for capture, review visibility, draft-safe accept, Web text, neutral payloads, and CLI next actions.
- `src/lib/search-policy-sweep.ts`, `scripts/search-policy-sweep.ts`, `src/tests/search-policy-sweep.test.ts`, `src/lib/search-eval.ts`, `src/lib/scope-context.ts`, `src/db/repository.ts`, `package.json`: first-phase fixture/live ranking sweep support, optional ranking injection, Scope Context repository resolution, and maintainer script wiring.
- `README.md`, `docs/installation.md`, `docs/release-playbook.zh-CN.md`, `plugins/codetrap-agent/`, and codetrap skills: guidance now prefers `session capture --trap-markdown -` for agent-drafted lessons while keeping `--trap-json` for structured callers.

## Validation

- Markdown capture pass: `bun test src/tests`, `bunx tsc --noEmit`, `bun run eval:dogfood -- report`.
- Candidate Review Visibility pass: targeted visibility tests, full `bun test src/tests`, `bunx tsc --noEmit`, `bun run eval:dogfood -- report`, and ESP32 dogfood against session `2026-06-04-codetrap-candidate-inbox-test`.
- Candidate Review Workbench pass: `bun test src/tests/web-console.test.ts src/tests/web-client-text.test.ts src/tests/web-client-review.test.ts`, full `bun test src/tests`, `bunx tsc --noEmit`, `bun run eval:dogfood -- report`, plus browser smoke on local Web Review.
- Architecture TDD pass: `bun test src/tests/web-client-review.test.ts src/tests/session-review.test.ts src/tests/web-console.test.ts src/tests/session-cli.test.ts`, `bunx tsc --noEmit`, full `bun test src/tests`, and `bun run eval:dogfood -- report`.
- Search policy sweep pass: `bun test src/tests/search-policy-sweep.test.ts`, `bunx tsc --noEmit`, `bun run eval:search-policy -- fixture`, live sweep against `/Users/superstorm/Documents/Code/esp32`, full `bun test src/tests`, `bun run eval:dogfood -- report`, and `git diff --check`.

## Known Risks

- The repo has unrelated existing uncommitted work across multiple feature lines. Stage paths intentionally and do not assume every dirty file belongs to one milestone.
- Candidate `cand-001` in session `2026-06-05-capture-web-accept-actions-must-carry-visible-draft-edits` is intentionally pending; ask the user before accepting, editing, rejecting, or superseding it.
- Web malformed accept-time `trap` edit errors still rely on existing normalization errors; a future polish pass can map them to friendlier Web `400` payloads.
- Batch review, notifications, MCP session tools, raw-log inference, and local embedding provider work remain out of scope for these milestones.

## Follow-ups

- Add a small Web/API regression for malformed accept-time edit payloads returning user-friendly errors.
- Consider batch triage only after the single-candidate Web Review loop feels stable in dogfood.
- Promote dogfood observations into `src/tests/fixtures/search-eval.json` only when they protect search behavior, not merely UI visibility.
- Add a scored live query file for `/Users/superstorm/Documents/Code/esp32` once enough real miss/noisy_hit cases exist; the current one-query smoke case ties across all ranking configs.
