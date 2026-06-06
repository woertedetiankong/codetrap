# Trap Markdown Capture Handoff

## Summary

Markdown trap capture is implemented and verified. `codetrap session capture` now accepts explicit Markdown trap drafts from stdin, inline arguments, or files, while preserving the existing `--trap-json` path and the candidate-inbox-before-confirmed-trap boundary.

## Key Decisions

- Use deterministic parsing of explicit `Title` / `Context` / `Mistake` / `Fix` fields; do not infer traps from raw logs.
- Reuse existing candidate normalization, scoring, dedupe, and session capture semantics.
- Keep Markdown as the preferred agent-authored format because it avoids shell-escaped JSON; keep JSON for structured callers.
- Preserve strict capture validation for Markdown and JSON, while explicit session note extraction remains lenient.
- Preserve empty `Module` / `Owner` normalization to `null`.

## Files Changed

- `src/lib/session-capture.ts`: added deterministic Markdown field parsing, multiline/code-block support, related-file/evidence extraction, and shared list parsing.
- `src/lib/command-requests.ts`: added mutually exclusive capture input selection for `--trap-json`, `--trap-markdown`, and `--trap-markdown-file`.
- `src/commands/workflow.ts` and `src/lib/session-operations.ts`: wired stdin/file Markdown capture into the existing session candidate flow.
- `src/tests/session-capture.test.ts` and `src/tests/session-cli.test.ts`: added parser and CLI regression coverage for Markdown capture, validation, empty fields, and candidate search boundaries.
- README, installation docs, context docs, release playbook, roadmap/spec docs, and codetrap skills/plugin templates: updated recommended agent capture flow to Markdown-first with JSON compatibility.
- `dogfood-log.md`: recorded the pre-edit codetrap observation for this task.

## Validation

- `bun test src/tests` passed with 103 tests.
- `bunx tsc --noEmit` passed.
- `bun run eval:dogfood -- report` passed with Recall@3 1, Recall@5 1, MRR 1.
- `git diff --check` passed.

## Known Risks

- The worktree had substantial pre-existing dirty/untracked changes before this task. Review/stage by path and avoid reverting unrelated work.
- `docs/implementation-log.md` still contains historical `--trap-json` wording; this is left as historical log content rather than current guidance.

## Follow-ups

- Consider a future Web Review editor for polishing Markdown candidates, but keep raw failure/review auto-inference out of v1.
