# Feedback revision loop — handoff

Updated: 2026-09-04 (America/Los_Angeles).
Status: Complete for the reviewed revision slice; real-task benefit remains unverified.
Supersedes the next-step pointer in [workspace navigation](../2026-09-04-workspace-navigation/handoff.md).
Parent: [original audit](../../reviews/2026-09-04-product-audit.md),
[current audit status](../../reviews/2026-09-04-product-audit-status.md),
[roadmap](../../agent-experience-compiler-roadmap.md).

## State and results

The Web console now takes a real scoped Run exposure/feedback through explicit
feedback, a private revision draft, frozen positive/negative FTS checks, user
acceptance/rejection, and safe rollback. Library history reopens drafts/receipts.
Exact applied-version activity remains separate from test results. Original and
latest judgments are distinguished when a historical feedback event is opened.
The original audit is preserved verbatim; its old findings are reconciled in a
separate progress table rather than silently rewritten as current facts.

- Branch `main`, base `8b1c065`; this stage and preceding Impact/Learning/navigation
  changes remain uncommitted. No PR, commit, push, install, deployment or real hook
  activation was performed. Preserve all existing uncommitted files.
- No real project feedback or lesson revision was written. Fixture activity is
  isolated in temporary home/project directories. The actual project still has
  no observation Runs; its revision history correctly displays an empty state.
- The previous stable-browser-binding memory candidate remains proposed; no
  confirmed memory was added or accepted in this stage.
- Schema addition is lazy: `experience_revision_commits` appears only on first
  acceptance in the selected lesson database. Backups must retain both that DB
  and originating project dossiers. Path-bound ownership and JSON export limits
  are documented in [the workflow guide](../../experience-revisions.md).

## Validation

- All **78 test files / 574 tests** passed in six sequential batches of at most
  15 files. Logs: `/Users/superstorm/.codex/visualizations/2026/09/05/01a06f12-717a-7352-9e52-ea6e306e4141/verification/revision-suite-{1..6}.log`.
- New coverage: 12 tests across operations, API and bundled-browser workflows.
  These check real scoped input, unknown/demo refusal, feedback retry, stable
  corpus, positive/negative gates, content-bound results, edit-during-evaluation,
  competing global approvals, retired/graduated lessons, rollback preserving
  counters, rollback refusal after later edits, transaction failure, receipt
  privacy, restarted reads/retries and version-specific evidence.
- The bundled browser test simulates a lost feedback response, preserves typed
  text, verifies one feedback event after retry, re-tests edited content, applies,
  reopens from Library and rolls back. Desktop English and phone Chinese both run.
  Screenshots: `revision-desktop.png` and `revision-mobile.png` beside the logs.
- An old cross-project browser test timed out once in batch 5; its previous rating
  text could satisfy a wait before the new filter response. Six isolated runs
  passed before the wait change. It now explicitly awaits the new scoped evidence
  response; the entire affected batch passes. Initial failure log is retained as
  `revision-suite-5-initial.log`; no claim that all possible UI races are disproved.
- Typecheck passed. After the full regression, source/latest feedback labels and
  the Chinese mobile assertion were refined; the text/script/bundled-browser
  checks were repeated (`revision-final-ui.log`).
- Standalone artifact: `/tmp/codetrap-revision-verified` (86 MB). The compiled Web
  opened the real project Library and rendered the new history empty state with
  no browser errors. Final source preview is on `http://127.0.0.1:4748`; the
  temporary compiled server on 4749 is stopped after verification.

## Contracts and closed decisions

- Use `ExperienceRevisions` for public operations, `revision-view.ts` for the Web
  allowlist, and `client-revisions.ts` for the typed controller. Its serialized
  function has an explicit stable binding and only injected runtime dependencies.
- An accepted revision updates five editable fields in place, retaining the ID
  and provenance. Existing candidate supersede cannot safely restore its
  predecessor; do not weaken that candidate rollback guard to reuse it here.
- The target SQLite immediate transaction owns material content, embedding
  invalidation and receipt. Draft/test files remain private to the source project.
  Stale base content or later material/lifecycle work is never overwritten.
- This slice tests target inclusion/exclusion in frozen FTS top-five results.
  It does not validate hybrid ranking, other lessons' recall, model behavior,
  adoption, causal benefit or cross-project aggregate outcomes.
- Do not add real mutation controls to demo or unknown-scope events. The API
  resolves all identity from a real source event, never from a client-supplied
  replacement trap ID/scope.

## Next backlog by value

1. Use a real task to judge a specific experience and inspect its later evidence;
   configure capture only when the user wants it. Current checks prove the
   mechanism, not personal growth or better model task outcomes.
2. Migrate legacy Governed/Controlled Eval fixtures into project-local product
   storage with identity mapping and compatibility/export support (audit F5).
3. Replace the remaining serialized browser shell with a real typed entry while
   retaining authentication, routes, drafts and standalone assets (F8 / stage C).
4. Measure larger histories before adding bounded queries, caches or incremental
   projections (F6). The revision history also scans local dossier files.
5. Add cross-project/version comparisons when there is sufficient real evidence;
   retain Tangle-inspired lineage concepts without importing its entire stack.

## Restart

Read this file, `docs/tasks/INDEX.md`, `docs/experience-revisions.md`, and the audit
status first. Start with:

```sh
git status --short
bun run typecheck
bun test src/tests/experience-revisions.test.ts src/tests/experience-revisions-web.test.ts src/tests/experience-revisions-browser.test.ts
```

Expected: existing uncommitted changes and 12 passing new tests on this machine.
Use sequential batches for full tests: preceding stages saw unexplained exit 137
in a single large test process. Do not run a standalone build concurrently with
the full suite. `bun run scripts/build-standalone.ts src/index.ts /tmp/codetrap-revision-verified`
is the supported local standalone build, including embedded ONNX WASM.

Do not enable hooks, execute model tasks, accept proposed memory, publish, push,
or commit without the corresponding user instruction. Source preview 4748 is a
temporary source process with no hot reload; restart that owned wrapper after
code changes. Existing global/shared data must not be used as synthetic evidence.

Docs synced: workflow/API/storage guide, README, original audit and status table,
roadmap, task index and this dossier. Existing chronological handoffs remain as
history. No global memory or separate wiki was modified.

Restart opener:

> Project `/Users/superstorm/Documents/Code/windsurf/codetrap`. Read the feedback
> revision handoff and task index. The reviewed revision loop passes 574 total
> tests, but real task benefit is unverified. Preserve uncommitted changes and the
> pending memory candidate. Follow the user's next priority; default next work
> is real evidence validation, then legacy Eval storage migration. Run the three
> new test files first. Do not activate hooks or confirm memory implicitly.
