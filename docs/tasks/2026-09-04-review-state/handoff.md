# Typed Review state — handoff

Updated: 2026-09-05 (America/Los_Angeles).
Status: Complete for Review selection, drafts, reads, mutation coordination and recovery.
Supersedes the next-step pointer in the [Library handoff](../2026-09-04-library-state/handoff.md).
Parent: [roadmap](../../agent-experience-compiler-roadmap.md), [audit F8](../../reviews/2026-09-04-product-audit-status.md).
Durable contract: [browser architecture](../../browser-architecture.md).

## Delivered behavior and closed decisions

Review state and interaction coordination live in strict DOM-only TypeScript:
`src/web/browser/review.ts`, `review-model.ts` and `review-data.ts`. Shared review
types moved to `src/domain/session-review.ts`; backend exports remain compatible.
The workspace is reduced from 3,056 to 2,610 lines and coordinates Review through
explicit methods without writing its state. Destination-specific presentation
templates and their Learning coverage helpers remain in `workspace.js`. This is
not a claim that all Review rendering or all browser business logic is typed.

Drafts store raw visible fields under project/session/candidate identity. Candidate,
project, view, locale and layout transitions restore only that candidate's draft.
Discard is explicit; when a background change was deferred, it loads the current
server candidate before actions resume. Drafts are in tab memory, not durable
autosave. The beforeunload guard can warn about drafts or an action in progress,
subject to browser policy; forced reload or closing still loses unsaved local data.
Use Save draft for persistence. Session deletion/cleanup removes only drafts for
the records actually removed.

Session/candidate reads validate their consumed fields and identities, reject
duplicates and distinguish failures from empty results with localized retry.
Project reset and session changes clear the old form immediately. Request counters
and captured context protect project/session A/B/A and late errors. Explicit missing
candidate links stay missing rather than selecting a different item. Review GETs
use `cache: "no-store"` and route loads release the history lock, allowing Back to
finish while an abandoned request is still pending. Background refresh avoids
mixing contexts and defers replacement while the selected draft is dirty.

Save, approve, accept, insight apply, reject and rollback capture the original
identity and visible payload before awaiting. The controller locks editable fields
and action buttons during submission. Same-session completion can refresh data
without selecting the original candidate or removing another draft. A completion
for a different project installs no data there and reports the original identity.
Conflicts are candidate-scoped. Receipts display project/session/candidate, and
suppression undo keeps the originating project even after navigation. Mutation
failures preserve drafts and do not automatically retry writes.

Runtime decoders validate the fields consumed by this state/UI boundary; they do
not fully validate all destination-specific metadata in the legacy templates.
Backend cross-process edit concurrency and existing content-bound destination
approval/rollback contracts are unchanged. Learning retains its existing separate
action coordination; this stage does not fix every feature's concurrency.

## Validation

- **608 tests across 87 files passed in 15 sequential processes**. The committed
  baseline had 593 tests; this slice adds 11 model/transport and four rendered
  Review tests. Existing browser journeys and backend tests pass.
- Final logs: `/Users/superstorm/.codex/visualizations/2026/09/05/01a06f12-717a-7352-9e52-ea6e306e4141/verification/review-state-final-{1..15}.log`.
  Earlier `review-state-complete-*` logs describe the 607-test state before the
  deferred-discard correction. Final logs cover that correction and its added test.
- Model tests cover raw draft isolation, malformed responses, stale reads, retry,
  background refresh, captured payloads, newer edits, scoped conflicts, insight
  metadata, session deletion and deferred discard. Rendered tests cover navigation,
  locale/project changes, phone width, delayed save with another candidate selected,
  visible-field approve/accept, conflict confirmation, reject, rollback and insight
  apply. Slow Back completes before an abandoned GET, then ignores its late 503.
- `bun run typecheck`, `bun run check:web`, `git diff --check` and whitespace checks
  for new files pass. No compiler relaxation, dependency or framework was added.
- `npm pack --dry-run --json --ignore-scripts` includes the Review modules, shared
  domain types, generated artifact and browser TS config; manifest inspection is
  in `/tmp/codetrap-review-pack.json`.
- Rebuilt `/tmp/codetrap-review-verified` embeds exactly the source browser bundle.
  `/tmp/codetrap-verify-review.ts` verifies an isolated temporary project's draft
  navigation/Back, explicit save/reload, Chinese phone rendering and token cleanup.
  It also opens the real project source preview read-only. The temporary home,
  project and standalone server were removed/stopped after verification.
- Inspected `review-source-desktop.png`, `review-source-mobile.png` and
  `review-standalone-mobile.png` beside the logs: no page errors or horizontal
  overflow. Existing destination layout is retained; mobile visual redesign is
  not part of this state migration.

## Workspace, data and environment

- Branch `main`, checkpoint **`6d54a4e`**: `feat: connect experience feedback and modernize the web workspace`.
  At the user's request, all preceding stages were committed together (109 files),
  then this slice began from a clean tree. Only the new Review slice remains
  uncommitted. No push occurred. Earlier handoffs' uncommitted/base claims are
  historical; the task index records this correction.
- Preserve all current Review changes, generated browser artifact and pending
  memory. Do not manually edit the generated bundle. Do not implicitly accept
  candidate `cand-001` in session
  `2026-09-05-capture-bind-serialized-browser-functions-by-an-explicit-stable`.
- The real legacy eval fixture remains byte-equal to both `8b1c065` and `6d54a4e`:
  SHA-256 `118f398837b2bee02812815f6bb123d0a354bb9276dae4237695450eec2d0dfd`
  (15 lessons, 24 cases). Real `.codetrap/evals/suite.json` remains absent. The
  original audit still matches the user attachment exactly. Tests used disposable
  projects; no real revision, feedback, hook activation or model task was created.
- Source preview remains on `http://127.0.0.1:4748` via the owned wrapper
  `/tmp/codetrap-experience-preview.ts`, PID 35379 at verification, exec session
  65827. Verify PID/command before stopping it. Standalone port 4749 is stopped.
  Read-only headless verification did not navigate the user's in-app tab.
- F8 remains partially open: Review presentation, Learning, Impact and shell retain
  explicit JavaScript boundaries. F6 scale evidence and F7 real-task benefit remain
  open. Passing tests establishes behavior, not measured personal growth.

## Next development and restart

1. Migrate Learning state, practice notes and experience-proposal drafts as the next
   bounded slice. Preserve source-aware identity, current draft content, study
   progress and explicit proposal staging. Inspect its request and route boundaries
   before changing them; avoid broad `any` annotations or a global shell rewrite.
2. Treat remaining Review presentation templates and Impact state as separate
   follow-ups, with concrete behavioral or maintainability evidence for each slice.
3. Measure larger histories before optimizing scans/projections. Real-task outcome
   verification remains separate; do not synthesize benefit records or activate
   observation as an incidental refactor.

```sh
git status --short
bun run check:web
bun run typecheck
bun test src/tests/web-review-model.test.ts
bun test src/tests/web-review-browser.test.ts
bun test src/tests/web-browser-smoke.test.ts
```

Expected: checkpoint `6d54a4e` with this Review slice uncommitted, fresh artifact,
both strict checks green, 11 model tests, four Review browser tests and five smoke
tests. Browser tests require supported Chrome/Chromium. If the artifact is stale,
regenerate and inspect with `bun run build:web`; never disable the check. Run
browser-heavy files separately if the existing exit-137 resource issue recurs.
Full local runner: `/tmp/codetrap-review-regression.py`; preserve final logs before
rerunning it. Rebuild standalone with
`bun run scripts/build-standalone.ts src/index.ts /tmp/codetrap-review-verified`.

Docs sync: created this complete handoff, task brief and decision log; rewrote
README, browser architecture, audit implementation status, roadmap and task index.
Original audit and prior handoffs remain historical. No wiki or global agent memory
was created or changed. No known errata in this handoff.

Restart opener:

> Continue `/Users/superstorm/Documents/Code/windsurf/codetrap`. Read the Review
> handoff, browser architecture and task index. Earlier work is committed in
> `6d54a4e`; the new Review state/draft slice remains uncommitted and passes 608
> tests. Entry is `src/web/browser/entry.ts`; Review coordination is `review.ts`.
> Preserve in-tab draft boundaries, exact action identity, rollback destinations
> and pending memory. Preview remains on port 4748. Start with `bun run check:web`
> and `bun run typecheck`, then the 11 model and four browser Review tests. Next
> slice: Learning state and practice/proposal drafts. Do not implicitly accept
> memory, activate real hooks, commit or publish as part of that refactor.
