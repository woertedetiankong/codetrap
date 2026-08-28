---
title: Handoff 2026-08-27 - Agent and user experience hardening
status: Complete
updated: 2026-08-28
---

# Handoff

## Summary

Codetrap now gives agents supported, revision-safe session/candidate editing and
Windows-safe structured input. Users get a clearer bilingual review console
with purpose-specific learning review, one-action approval and shelving,
idempotent study tracking, safe ASCII/code rendering, visible sources,
suppression undo, protected live refresh, safer launch URLs, and one-command
browser opening.

## Current State

The requested hardening slices, including the follow-up learning-workflow fixes,
CSS-safe browser assertion, and bounded CI integration-test budgets, are
implemented, validated, and pushed to `origin/main`. Install, version, release,
and merge state remain unchanged.

## Git And Persistent State

- Branch: `main`; the task and browser-assertion follow-up are committed and
  pushed to `origin/main`. Commit hashes are available from `git log`.
- Persistent state: ignored `.codetrap/sessions` content localized earlier in
  this interaction remains local to this checkout. A post-flight Windows CLI
  quoting lesson is staged as `cand-001` in session
  `2026-08-27-capture-windows-bun-json`; it is not confirmed memory.

## Environment State

- The updated Web console was restarted from this source checkout on
  `127.0.0.1:4737` with `--open`; its launch token is intentionally not recorded
  here.

## Key Decisions

- Session IDs remain stable on rename; metadata and derived documents update
  under the session lock.
- Translation is an explicit agent edit through CLI/MCP, not an undeclared
  external translation service.
- Web freshness uses five-second visibility-aware polling and defers application
  whenever the candidate form is dirty.
- User-study insights use an ASCII flow diagram plus a concrete plain-language
  example; concise Agent runtime traps do not inherit the longer teaching format.
- Agents read external sources and stage reviewed insight payloads. Codetrap
  remains a local store and does not crawl URLs or claim to train the model.
- Insight candidates are not scored or edited as malformed traps. Their Web
  form uses destination fields, and the user can save, approve, and shelf the
  visible revision in one explicit action or approve it for later Agent apply.
- **Mark learned** is an idempotent state transition. Legacy positive counts
  display as learned, but retries and repeated clicks do not increase them.
- Learning bodies use an escaped fenced-code renderer; source URLs are exposed
  only for safe HTTP(S) links and timestamps are localized.
- Structured commands accept `--input-json -`. Bundled skills use the local
  source CLI fallback when no global command exists and do not install it.
- A restarted Web server still invalidates old ephemeral tokens by design, but
  stale tabs now show localized recovery guidance instead of bare
  `Unauthorized` transport text.

## Changed Surfaces

- `src/lib`, `src/commands`, `src/mcp`: locked rename and revisioned candidate
  edit paths, plus CLI/MCP contracts.
- `src/web`: bilingual reject dialog, suppression undo, rename control,
  draft-safe polling, URL cleanup, `web --open`, first-class insight review,
  safe code/source rendering, idempotent learned state, and a ready-to-send
  Learning prompt.
- `src/commands`, `src/lib`: shared standard-input JSON parsing, first-class
  committed-destination review state, and retry-safe insight consultation.
- `plugins/codetrap-agent`, `src/lib/learning-review-dir.ts`: one user-study
  teaching contract, source-checkout CLI fallback, and correct Phase 2 insight
  approval/apply workflow for external capture and session review.
- `src/tests`: CLI/MCP/API/quality/client/browser/skill regression coverage.

## Cross-Module References

- Depends on: [Phase 1B envelope](../2026-07-25-phase1b-candidate-envelope-and-migration/handoff.md) - revision/hash and authorization invalidation contract.
- Depends on: [Phase 1A lifecycle](../2026-07-25-phase1a-existing-surface-vertical-proof/handoff.md) - suppression and unsuppress receipts.
- Referenced by: [README](../../../README.md) - current user and MCP workflow.

## Red Lines And Gotchas

- Do not push, release, publish, or install globally without explicit user
  authorization.
- Bun's configured Windows browser smoke stays skipped because system-browser
  launch can hang; the real Chrome check is separate evidence, not a removed skip.

## Validation

- `bun run typecheck`: pass.
- Latest full local `bun test src/tests`: 415 pass, 1 configured Windows
  browser-smoke skip, 0 fail after adding bounded budgets to the two CI-heavy
  integration cases.
- Focused learning/Web suite: 40 pass, 0 fail.
- Browser-assertion follow-up: 14 pass, 1 configured Windows browser-smoke skip,
  0 fail across the browser smoke and Web client tests.
- `python -X utf8 .../skill-creator/scripts/quick_validate.py` for all six
  changed bundled skills: valid.
- Direct headless Chrome at 1500x900: the restarted local console loaded with
  live project data and the three-pane review layout rendered cleanly. The
  Playwright system-browser process still hangs on this Windows environment, so
  Learning DOM behavior is covered by the focused client/API tests and the
  configured browser-smoke skip remains intact.
- `git diff --check`: pass (line-ending conversion warnings only).

## Docs And Wiki

- Rewritten: `README.md`, `docs/installation.md`, MCP initialize instructions,
  parent roadmap dashboard, task index, bundled learning skills, and generated
  review guidance.
- Created: this dossier and handoff. No hand-maintained wiki exists, so none was created.

## Restart Verify

```bash
bun run typecheck  # expected: exit 0; mismatch means code/types drifted
bun test src/tests/web-client-script.test.ts src/tests/web-client-text.test.ts src/tests/web-console.test.ts src/tests/phase2.test.ts src/tests/session-review.test.ts  # expected: 40 pass; mismatch means the learning or review contract regressed
```

## Next Steps

1. Review `cand-001` in session `2026-08-27-capture-windows-bun-json` and accept,
   edit, or reject it explicitly.
2. Treat pushing, global installation, versioning, publishing, and release work as a
   separate user-authorized task.

## Implementation Log

- [implementation-log.md](implementation-log.md) records stable-ID rename,
  explicit translation edits, polling, and validation decisions.
