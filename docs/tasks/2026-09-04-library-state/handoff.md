# Typed Library — handoff

Updated: 2026-09-04 (America/Los_Angeles).
Status: Complete for Library list/filter/selection/detail/experience state and recovery.
Supersedes the next-step pointer in the [browser entry handoff](../2026-09-04-browser-module-entry/handoff.md).
Parent: [roadmap](../../agent-experience-compiler-roadmap.md), [audit F8](../../reviews/2026-09-04-product-audit-status.md).
Durable contract: [browser architecture](../../browser-architecture.md).

## Delivered behavior

Library business state and rendering now live in strict DOM-only TypeScript:
`src/web/browser/library.ts`, `library-model.ts`, and `library-data.ts`.
The workspace is reduced from 3,460 to 3,056 lines and no longer owns Library
arrays, filters, selection, detail caches or experience request counters. It
coordinates the Library through its factory instead of sharing its mutable state.
Shared DTOs live in `src/web/client-library-contract.ts` and
`src/domain/trap-experience.ts`; existing backend type exports remain compatible.
Learning practice/navigation remains in its existing transitional adapter.

List, detail and experience loads distinguish idle/loading/ready/error. A list
failure is never shown as an empty successful list; detail failure no longer
leaves a permanent loading message. Both have localized retries, and the existing
experience retry remains independent. Runtime decoders validate consumed fields,
project identity, scope/ID, duplicate list identities and experience page offsets.

Project reset or a newer list request invalidates old list/detail success and
failure, including project A/B/A. Detail requests deduplicate per scope/ID within
a list generation. Experience responses are invalidated by selection/page/list
changes. Missing explicit links remain missing instead of opening another item.
Search/sort/health filters synchronize cleared selection with history. The existing
mobile reader, scroll restoration, Learning/Run links and revision history remain.

Library route loads release the workspace history lock immediately. Library GETs
use `cache: "no-store"`: releasing the lock alone still let identical reads wait
in the browser cache. The regression verifies Back renders the original lesson
before a superseded request is released, then ignores its late 503. Preserve both
protections. Other legacy route loaders retain their existing behavior.

## Validation

- **593 tests across 85 files passed**, in 14 sequential processes. The preceding
  stage had 581 tests; this slice adds nine transport/model tests and three rendered
  Library tests. Existing tests and browser journeys remain passing.
- Final logs: `/Users/superstorm/.codex/visualizations/2026/09/05/01a06f12-717a-7352-9e52-ea6e306e4141/verification/library-state-complete-{1..14}.log`.
  Earlier `library-state-final-*` logs establish the initial 592-test state;
  `library-state-verified-14.log` is the failed navigation attempt. Only the
  complete logs describe the final state. `library-history-before-fix.log` retains
  the original slow-history failure.
- `bun run typecheck` passes both project and DOM-only browser checks;
  `bun run check:web` and `git diff --check` pass. No compiler relaxation,
  framework or dependency was added. Generated source/artifact hashes are current.
- `npm pack --dry-run --json --ignore-scripts` includes the Library modules,
  shared contracts, generated browser artifact and browser TS config.
- `/tmp/codetrap-library-verified` is the newly built 86 MB standalone. Its root
  HTML contains exactly the source browser bundle. An isolated temporary project
  passes detail/reload/Chinese-phone/Back/token-cleanup checks. Temporary project,
  home and standalone server were removed/stopped after verification.
- `/tmp/codetrap-verify-library.ts` is the delivery verification script; it uses
  isolated standalone data and read-only real-project source preview. Inspected
  screenshots beside the logs: `library-source-desktop.png`,
  `library-source-mobile.png`, `library-standalone-mobile.png`. No page errors or
  horizontal overflow were found. The first standalone fixture category was invalid;
  correcting only the disposable fixture allowed delivery verification to pass.

## Workspace and boundaries

- Branch `main`, base `8b1c065`; this and every preceding stage remain uncommitted.
  Preserve the entire working tree, including the previous removal of client-shell.ts.
  No commit, push, PR, install, publish, real hook activation or model task occurred.
- Real legacy eval fixture remains byte-equal to the base: SHA-256
  `118f398837b2bee02812815f6bb123d0a354bb9276dae4237695450eec2d0dfd`.
  Real `.codetrap/evals/suite.json` is absent. The original audit still matches the
  user attachment exactly. No real lesson revision, example or feedback was created.
- Preserve the proposed memory candidate: session
  `2026-09-05-capture-bind-serialized-browser-functions-by-an-explicit-stable`,
  `cand-001`. Do not accept it implicitly.
- Source preview was restarted and remains on `http://127.0.0.1:4748` via the owned
  wrapper `/tmp/codetrap-experience-preview.ts` (exec session 33365). The in-app
  Library navigation request was queued; do not claim it already navigated. Verify
  PID/command before stopping a preview. Standalone verification on 4749 is stopped.
- Library state/transport/rendering is typed, but Review, Learning, Impact and shell
  state are still explicit migration boundaries. Revision authoring is its existing
  independent controller. Audit F8 is not wholly closed; F6 scale measurements and
  F7 real-task benefit remain open. Tests establish mechanics, not user growth.
- Scope/ID cache keys are only valid within the project/list generation. Do not
  drop project reset or source/observation availability distinctions. Retain existing
  content-bound revision/eval approvals and historical rollback destinations.

## Next development

1. Migrate the Review slice: session/candidate selection, visible draft capture,
   unsaved edits, background refresh and mutation/error states. Preserve receipts,
   explicit accept/reject/rollback semantics and content-bound approvals. Use the
   same narrow feature boundary; do not globally rename the workspace to TypeScript
   with broad `any` annotations.
2. Follow with Learning and Impact state migrations where concrete async or draft
   issues justify them. Their route loaders may need their own cancellation/freshness
   treatment; the Library change does not claim to fix every view's slow navigation.
3. Validate an experience revision on real tasks when requested; do not activate
   observation or synthesize benefit records as an incidental refactor.
4. Measure large histories before optimizing scan/projection/review performance.

## Restart verification

```sh
git status --short
bun run check:web
bun run typecheck
bun test src/tests/web-library-model.test.ts
bun test src/tests/web-library-browser.test.ts
bun test src/tests/web-browser-smoke.test.ts
```

Expected: extensive uncommitted stages, fresh artifact, both strict checks green,
9 model/transport tests, 3 Library browser tests and 5 existing browser smoke tests.
Browser tests need supported Chrome/Chromium. If artifact freshness fails, regenerate
and inspect with `bun run build:web`; never disable the check. Run browser-heavy
files separately if exit 137 recurs. The full local runner is
`/tmp/codetrap-library-regression.py`; preserve completed logs before rerunning it.
Build standalone with `bun run scripts/build-standalone.ts src/index.ts /tmp/codetrap-library-verified`.

Docs sync: created the task brief, implementation log and complete handoff; rewrote
browser architecture/README type boundaries, audit F8, roadmap and task index entry.
Original audit and older handoffs remain historical. No wiki or global agent memory
was created or changed. No known handoff errata.

Restart opener:

> Continue `/Users/superstorm/Documents/Code/windsurf/codetrap`. Read the Library
> handoff, browser architecture and task index. Typed Library state, recovery and
> slow Back navigation pass 593 tests; full F8 and real benefit remain open. Entry
> is `src/web/browser/entry.ts`, Library is `src/web/browser/library.ts`. Preserve
> all uncommitted work and pending memory; do not activate hooks, accept memory,
> commit or publish. Start with `bun run check:web` and `bun run typecheck`, then
> the 9 model and 3 browser Library tests. Next slice is Review state and drafts.
