# Browser module entry — handoff

Updated: 2026-09-04 (America/Los_Angeles).
Status: Complete for browser module delivery and typed startup.
Supersedes the next-step pointer in the [project Eval storage handoff](../2026-09-04-project-eval-storage/handoff.md).
Parent: [roadmap](../../agent-experience-compiler-roadmap.md),
[audit progress](../../reviews/2026-09-04-product-audit-status.md).
Durable contract: [browser architecture](../../browser-architecture.md).

## State and evidence

The Web console has a real browser entry and module graph. The 3,502-line source
string was extracted into a legacy workspace module; function serialization and
ambient controller globals were removed. Route/review/render controllers are
ordinary imports; Impact, experience actions and pane layout are factories with
small public surfaces and explicit runtime dependencies. Startup, storage,
HTTP errors and bootstrap validation have strict TypeScript contracts.

The existing workspace and layout logic remain JavaScript, with the typed entry
crossing an explicit `workspace.d.ts` boundary. Complex Impact/experience state
also retains its previous dynamic types. This completes the module delivery
slice, not all of audit F8 or every browser-state type. No new framework or
package dependency was introduced, and the root strict TS check was preserved.

- Branch `main`, base `8b1c065`; this and all preceding Impact/Learning/navigation/
  revision/Eval changes remain uncommitted. Preserve the entire working tree.
  No commit, PR, push, install, release, real hook activation or model task occurred.
- No real evaluation set, example, feedback or lesson revision was created.
  Browser behavior tests use isolated temporary projects/homes. Real-project
  preview is read-only; its 15-lesson / 24-case legacy fixture remains byte-equal
  to the base, and `.codetrap/evals/suite.json` is absent at closeout.
- The original audit still byte-matches the user attachment. The prior proposed
  memory candidate is untouched: session
  `2026-09-05-capture-bind-serialized-browser-functions-by-an-explicit-stable`,
  `cand-001`. Do not accept it implicitly.

## Validation

- **581 tests in 83 files passed**, using eight ordinary batches of at most ten
  files plus five individual browser/platform files (13 processes total).
  Logs: `/Users/superstorm/.codex/visualizations/2026/09/05/01a06f12-717a-7352-9e52-ea6e306e4141/verification/browser-entry-final-{1..13}.log`.
- Test-count reconciliation: the 15 source-string implementation assertions
  became three build-delivery checks; six platform tests and three rendered
  entry tests were added. The route serialization assertion became a Unicode
  route round-trip test. Previous rendered journeys remain, with an added real
  refresh check that preserves an unsaved candidate title.
- Platform/entry coverage: token precedence and removal, reload, denied storage,
  Headers/body preservation, error status/payload, HTML 401 recovery, malformed
  successful JSON/bootstrap data, phone recovery/retry and retained routes.
- Existing browser journeys cover project/lesson links, Back/Forward, responsive
  reading, practice drafts, reviewed revisions and rollback, evaluation creation,
  acceptance retry, history and JSON download. No browser errors in these runs.
- One earlier combined browser process exited 137 after eight passing tests.
  The full isolated runs supersede it; the retained interruption log is
  `browser-entry-interrupted-137.log`. The first full attempt also caught the
  obsolete CI typecheck-command assertion; its log is
  `browser-entry-initial-ci-assertion.log`. Neither attempt is counted as green.
- Both `bun run typecheck` stages and `bun run check:web` pass. Npm
  `pack --dry-run --json --ignore-scripts` confirms browser runtime/build files
  and the browser TS config are packaged. No package was published.
- `/tmp/codetrap-browser-entry-verified` is the 86 MB standalone. Its root HTML
  contains exactly the source Web browser artifact. Headless Chrome verified
  token cleanup, Library navigation, Back/reload and the Chinese mobile legacy
  preview without creating a suite. Inspected screenshots:
  `browser-entry-desktop.png` and `browser-entry-mobile.png` beside the logs.
- Source preview remains on `http://127.0.0.1:4748`, owned wrapper
  `/tmp/codetrap-experience-preview.ts`, with the in-app tab on Evals. It was
  restarted after generation. The temporary standalone server on 4749 is stopped.

## Contracts and closed decisions

- Author browser infrastructure under `src/web/browser/`; the entry and platform
  are checked against DOM-only globals in `tsconfig.browser.json`. Existing
  `client-*` modules are included in the normal project strict check.
- Keep business-state migration explicit. `workspace.js` is not claimed as
  fully typechecked; do not fill its state with broad `any` annotations merely
  to rename it `.ts`. Type one feature's state/DTOs and async transitions at a time.
- `scripts/build-web.ts` builds a self-contained browser IIFE and escapes HTML
  closing prefixes for safe embedding. Server runtime imports and unexpected
  runtime module paths are refused. Backend type-only references are excluded.
- `client-bundle.generated.ts` is a checked-in artifact, not authored code.
  `build:web` regenerates it; `check:web` checks normalized input hashes and
  artifact integrity, independently of Bun patch-version output formatting.
  CI and npm prepack run that check. This preserves the existing synchronous
  HTML import contract for source/npm/standalone without runtime compilation.
- `dev` and `buildCodetrapStandalone` regenerate before launching/building.
  Direct source entry or a custom wrapper requires an explicit `build:web` and
  restart after edits. Ship `tsconfig.browser.json` with package build inputs.
- API generic parameters describe consumer types; they do not validate every
  endpoint. Runtime bootstrap validation is new; domain operations retain their
  existing review/digest/scoped-identity checks.
- No UI redesign, corpus replacement, new source publishing or evidence-policy
  changes. Real task benefit remains unverified; synthetic tests establish mechanics.

## Next backlog

1. Type one complete business slice—Library or Review—including DTOs, selection,
   loading/error states, stale responses and unsaved drafts. Then migrate its
   workspace code out of the JavaScript boundary. Keep module interfaces small.
2. Validate a specific experience on real tasks when observation is requested.
   Do not generate fake benefit records or enable hooks as part of code cleanup.
3. Measure large observation/review histories before adding pagination, caching
   or incremental projections (audit F6). There is no performance claim here.
4. Extend corpus versions/import only when needed, retaining historical IDs,
   comparisons and old rollback destinations from the previous stage.

## Restart and red lines

```sh
git status --short
git log -1 --oneline
bun run check:web
bun run typecheck
bun test src/tests/web-browser-platform.test.ts src/tests/web-client-script.test.ts
bun test src/tests/web-browser-entry.test.ts
```

Expected: extensive uncommitted stages on base `8b1c065`, fresh asset, both strict
checks passing, nine platform/build tests plus three rendered recovery tests.
A stale-asset error requires regeneration and inspection, not disabling the check.
Browser tests require a supported Chrome/Chromium path and skip when unavailable.

Use separate browser processes if exit 137 returns. The completed local runner
is `/tmp/codetrap-browser-regression.py`; it discovers all test files and writes
individual logs. Do not run standalone builds concurrently with the full tests.
Build using `bun run scripts/build-standalone.ts src/index.ts /tmp/codetrap-browser-entry-verified`.

Check a preview process's PID/command before stopping it. Do not enable hooks,
run model tasks, accept memory, commit, push, publish or install without the
corresponding user instruction. Preserve private notes, real fixture bytes,
scoped identities and content-bound rollback guards from preceding stages.

Docs sync: created the browser architecture guide and dossier/log; rewrote
README's structure/build instructions and audit F8 status; updated the roadmap
and `docs/tasks/INDEX.md` new-session entry. Older handoffs and the original audit
remain historical records. Existing evaluation/revision guides remain valid.
No separate wiki or global agent memory was changed.

Restart opener:

> Project `/Users/superstorm/Documents/Code/windsurf/codetrap`. Read the browser
> module entry handoff, task index and audit status. Normal module delivery and
> typed startup pass 581 tests; legacy business-state typing remains open.
> Preserve all uncommitted stages and proposed memory. Start with check:web and
> typecheck, then the platform/build and entry tests. Next development should
> type one complete Library or Review state slice, not restore serialization.
> Do not enable observation, accept memory, commit or publish implicitly.
