# Project evaluation storage — handoff

Updated: 2026-09-04 (America/Los_Angeles).
Status: Complete for audit F5's project-local workflow and compatibility slice.
Supersedes the next-step pointer in the [feedback revision handoff](../2026-09-04-feedback-revision-loop/handoff.md).
Parent: [roadmap](../../agent-experience-compiler-roadmap.md),
[original audit progress](../../reviews/2026-09-04-product-audit-status.md).
Durable contract: [project evaluation sets](../../project-evaluation-suites.md).

## State and results

Ordinary registered projects can preview/create a corpus from confirmed scoped
lessons, author/preview/confirm positive and negative examples, run the existing
controlled comparisons, and download a portable set. Projects with legacy
fixtures can explicitly copy their content and positional expectations. Local
sets take precedence. Old draft, acceptance and rollback destinations remain
bound to legacy paths, including drafts created before path binding existed.

- `main`, base `8b1c065`. This and the preceding Impact/Learning/navigation/
  revision stages remain uncommitted. Preserve all existing changes. No PR,
  commit, push, binary install or deployment was performed.
- No real lesson revision, feedback, example or project suite was written.
  Synthetic walkthroughs used temporary project/home fixtures. The real project
  still reads its 15-lesson / 24-case legacy fixture; its bytes match `8b1c065`
  (SHA `118f398837b2bee02812815f6bb123d0a354bb9276dae4237695450eec2d0dfd`).
- Both real observation clients were disabled at stage entry, with no real Runs.
  No hooks or model tasks were activated. The previous stable-serialized-binding
  memory candidate remains proposed: session
  `2026-09-05-capture-bind-serialized-browser-functions-by-an-explicit-stable`,
  `cand-001`. No confirmed memory was added.
- Actual corpus creation, examples and receipts occur only after the corresponding
  explicit Web action. Opening Evals or previewing creates none of them.

## Validation and environment

- **584 tests / 81 files** passed in six sequential batches of at most 15 files.
  Logs: `/Users/superstorm/.codex/visualizations/2026/09/05/01a06f12-717a-7352-9e52-ea6e306e4141/verification/eval-storage-final-{1..6}.log`.
- The 10 new tests cover readonly previews, scoped ID collisions, stale corpus
  and file digests, create/accept retry, rollback replay refusal, legacy copying,
  old draft/commit destinations, corrupt local priority, exact export, historical
  result availability, registered-project access and explicit user declarations.
- A bundled Web test exercises desktop English and 390px Chinese UI, invalidates
  preview on edits, simulates a lost response after successful acceptance, checks
  one write after retry, runs/reloads a comparison, downloads/parses JSON and
  preserves history after corrupting the active suite. No browser errors.
- Typecheck passed. After the full suite, obsolete source-fixture labels were
  updated; all 22 text/script/bundled-browser tests passed again. Desktop and
  mobile screenshots were inspected: `suite-desktop.png`, `suite-mobile.png`
  beside the logs. These are synthetic test artifacts, not real task evidence.
- `/tmp/codetrap-eval-storage-verified` is the rebuilt 86 MB standalone. Headless
  Chrome opened the real project Evals, checked the current title and 24-case
  legacy preview, and verified no local suite or browser errors. Its temporary
  server on 4749 was stopped after verification.
- Source preview remains on `http://127.0.0.1:4748`, from the owned wrapper
  `/tmp/codetrap-experience-preview.ts`; the in-app browser is on Evals. This is
  a source process without hot reload. Check its PID/command before restarting.
- `git diff --check` passed. The original audit still byte-matches the supplied
  attachment. This is implementation evidence, not proof of improved real tasks.

## Contracts and closed decisions

- `project-eval-suite.ts` owns path resolution, frozen identity, readonly preview,
  guarded atomic creation and exact download. Never silently overwrite a local
  corpus or use a healthy legacy fixture to conceal a corrupt local one.
- `eval-suite-operations.ts` composes existing Phase 2 and Session operations
  for reviewed cases. Keep one receipt/recovery system. The original multi-file
  Phase 2 lifecycle is not upgraded to a transactional database by this slice.
- New `search_eval_case` proposals bind `fixture_path` and `corpus_sha256`.
  Manual acceptance also binds `fixture_sha256`. Old unbound candidates resolve
  to legacy forever. A material corpus change requires a new review; generic
  editing must not discard its existing identity/destination guards.
- The picker catalog and hash share one read; `input.corpus_sha256` guards
  selection before preview. The API still permits independently authored inputs
  without that optional catalog binding. Preview/accept always bind current
  full bytes. Source scope/ID/revision are historical identities of the original
  project, not portable identifiers for a different project's live lessons.
- Controlled history is independent of the active suite. Respect `can_run`
  when disabling new experiments, while retaining readable immutable histories.
- `client-eval-suite.ts` is a typed, injected controller with explicit stable
  serialization binding. It is integrated into the existing browser shell, not
  a replacement build system. Tests load the built artifact.
- Maintainer `dogfood-eval` and search-policy benchmarks keep their legacy
  default. They accept exported sets using `--fixture`; they must not silently
  switch to the user's private evaluation corpus.
- General Evals and experience revision tests retain separate frozen corpora;
  neither implicitly promotes the other's cases or changes confirmed memory.
- No automatic migration, source overwrite, corpus resnapshot, file upload or
  cross-device live-ID mapping. Portable JSON download is the delivered export.

## Next backlog by value

1. Validate a specific lesson on a real task and inspect later version evidence
   when the user wants observation enabled. Synthetic cases prove the mechanism,
   not task success, adoption or personal growth.
2. Continue audit F8: move the remaining serialized shell into a proper typed
   browser entry, preserving local authentication, registered-project routes,
   drafts, refresh behavior and standalone assets. Keep the working flow intact.
3. Measure larger observation/review histories before changing pagination,
   projections or caching (F6). Avoid claiming scale improvements without data.
4. Add reviewed corpus versions/import when usage warrants it. Preserve old
   experiments and references; do not refresh array positions in place.

## Restart and documentation

```sh
git status --short
git log -1 --oneline
bun run typecheck
bun test src/tests/project-eval-suite.test.ts src/tests/project-eval-suite-web.test.ts src/tests/project-eval-suite-browser.test.ts
test ! -e .codetrap/evals/suite.json
```

Expected: existing uncommitted work on base `8b1c065`, typecheck success, 10 new
tests passing on this machine and no real local suite. A later user-created set
is valid new state; inspect it rather than deleting it to restore this snapshot.
Use sequential batches for full tests; earlier stages saw unexplained exit 137
in a single large process. Do not build the standalone concurrently with them.
Build with `bun run scripts/build-standalone.ts src/index.ts /tmp/codetrap-eval-storage-verified`.

Do not enable hooks, run model tasks, accept the memory candidate, publish,
commit or push without the corresponding user instruction. Never turn fixture
activity into real observation evidence or overwrite later user changes during
rollback. Export includes private lesson and query text; keep it local unless
the user requests sharing.

Docs sync: created the evaluation-set guide and this dossier/log; rewrote
README, installation, Evals design, revision-guide links and audit progress;
updated roadmap and `docs/tasks/INDEX.md` as the new-session entry. Original
audit and older chronological handoffs are preserved. No separate wiki or global
agent memory changed; no documentation follow-up remains for this slice.

Restart opener:

> Project `/Users/superstorm/Documents/Code/windsurf/codetrap`. Read the project
> Eval storage handoff, task index and audit status. The project-local reviewed
> evaluation workflow passes 584 tests; actual task benefit remains unverified.
> Preserve all uncommitted stages and the proposed memory candidate. Start with
> typecheck and the three new test files (10 tests). Follow the user's next
> priority; next development is the typed browser entry. Do not enable real
> hooks, confirm memory or replace a corpus implicitly.
