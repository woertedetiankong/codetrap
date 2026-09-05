# Learning workflow state and drafts — handoff

Updated: 2026-09-05 (America/Los_Angeles).
Status: Complete.
Baseline: `main` at `d221695`; checkpointed at the user's request in the commit containing this handoff.
Parent: [access recovery](../2026-09-05-web-access-recovery/handoff.md),
[roadmap](../../agent-experience-compiler-roadmap.md).
Durable contract: [browser architecture](../../browser-architecture.md#learning-workflow-drafts-and-actions).

## Delivered behavior

Learning keeps independent raw practice-note and experience-proposal drafts per
source project and Insight. Article/project navigation, language/layout changes,
Library/Back and in-place reauthorization retain those drafts. Discard affects only
the selected note or proposal. Closing or reloading the tab can still lose unsaved
work; this is not durable autosave.

`src/web/browser/learning-model.ts` captures the original source, operation and
visible payload before awaiting. A late practice save preserves newer typing,
including a change back to the previously saved value. Preview validates only the
submitted draft version, without replacing newer input or rewriting raw tags/path
text. Explicit creation stages a Candidate Inbox item; it does not accept memory.
Failures stay attached to the original draft, and writes are not automatically
retried. Learning and Review share action-busy notifications to avoid conflicting
browser actions or controls remaining disabled after switching views.

`learning.ts` binds forms to source identities before DOM capture, reads disabled
controls directly, restores current-field focus/selection/scroll on workflow
rerender, displays per-item errors/validation and guards unload while drafts or
operations remain. `learning-data.ts` validates request project/scope and consumed
Insight fields, plus mutation/preview/create source identities. The four existing
progress/practice/feedback/Run mutation HTTP responses add `project_root`; other
backend persistence and concurrency semantics remain unchanged. Shared Learning
Impact types moved to `src/domain/learning-impact.ts` with compatible lib exports.

The legacy workspace removes its single proposal slot and action implementations.
Learning reads now have no-cache requests, guarded responses, localized retry and
missing-route behavior. Back can restore the prior view before an abandoned read
finishes. A workflow revision during a pending read triggers a fresh read rather
than installing stale data or leaving permanent loading. Project reset immediately
removes the old form while session data is loading.

## Verification

- **630 tests across 90 files in 18 sequential processes pass**, up from 616.
  Added eight model and six rendered browser tests. They cover raw draft isolation,
  delayed preview/newer input/caret, explicit retry after reauthorization, no write
  replay, candidate creation and Review fields, malformed reads, slow Back, missing
  routes, another article's draft, reciprocal action locks and delayed project reset.
- Full logs: `/Users/superstorm/.codex/visualizations/2026/09/05/01a06f12-717a-7352-9e52-ea6e306e4141/verification/learning-workflow-final-{1..18}.log`.
  Runner: `/tmp/codetrap-learning-regression.py`. No runtime code changed after this
  full regression; subsequent changes are documentation and delivery verification.
- `bun run typecheck` (project and strict DOM), `bun run check:web` and whitespace
  checks pass. The generated bundle was rebuilt, never hand-edited. The npm dry-run
  manifest `/tmp/codetrap-learning-pack.json` includes all new runtime modules and
  `client-bundle.generated.ts`.
- `/tmp/codetrap-learning-verified` was built with the supported standalone helper.
  `/tmp/codetrap-verify-learning.ts` confirms identical embedded browser bytes,
  fresh bare-link authorization, Learning practice/proposal drafts, Library/Back,
  preview, explicit practice save, Candidate Inbox creation and matching Review
  title/fix in disposable data. No confirmed trap was created. The standalone
  server on 4749 and disposable home/project were stopped/removed afterward.
- Inspected desktop/phone screenshots next to the logs:
  `learning-standalone-desktop.png`, `learning-standalone-mobile.png`,
  `learning-source-desktop.png`, `learning-source-mobile.png`. The real source
  preview has zero Learning Insights across registered projects; its verification
  therefore covers desktop/phone empty states. Populated workflow coverage uses
  isolated fixtures. No page errors or horizontal overflow occurred. Two earlier
  delivery-script visibility assumptions were corrected; see the decision log.
- The original audit still matches the user's attachment byte for byte. The
  maintainer search fixture remains identical to `d221695`, 15 traps/24 queries,
  SHA-256 `118f398837b2bee02812815f6bb123d0a354bb9276dae4237695450eec2d0dfd`.
  No `.codetrap/evals/suite.json` was created in the real project.

## Workspace and remaining boundaries

- This development stage is checkpointed on `main` after `d221695`, titled
  `feat: preserve Learning drafts and coordinate workflow actions`. The preceding
  Review/access work is committed there; stages through Library are in `6d54a4e`.
  No push or publication was performed. Further development requires its own checkpoint instruction.
- Owned source preview: `/tmp/codetrap-experience-preview.ts`, port 4748, PID 40166,
  exec session 40405 at verification. Check PID/command before stopping it. It was
  restarted with the existing token. An authorized in-app Learning tab was opened,
  its actual Learning empty-state UI verified and marked deliverable. No old tab
  was reloaded. A fresh tab still needs the full authorized launch link; never put
  the token in logs or a handoff.
- Real preview actions were read-only. No real candidate, confirmed memory,
  observation hook, feedback or model-task experiment was changed. Preserve both
  pending proposed candidates, including
  `2026-09-05-capture-bind-serialized-browser-functions-by-an-explicit-stable` /
  `cand-001`; see the preceding Review/access handoffs for prior context.
- F8 remains partially open. Learning list/filter/collection selection/presentation,
  collection rename/reorder and Run-choice hydration remain in the legacy workspace.
  List decoding validates workflow fields, not every optional collection-display
  field. Review presentation and broader Impact state are separate boundaries.
- Backend cross-process editing/version semantics are unchanged. Browser guards
  do not provide cross-tab concurrency or durable draft recovery. Large-data
  performance (F6) and real-task benefit evidence (F7) remain unverified.
- Next highest-value development slice: durable draft recovery with explicit
  restore, expiry and cleanup rules. Reuse source identities and raw field versions;
  preserve explicit save/review and never replay mutations automatically.

## Restart verification

```sh
git status --short
bun run check:web
bun run typecheck
bun test src/tests/web-learning-model.test.ts
bun test src/tests/web-learning-browser.test.ts
```

Expected: the Learning source/docs changes above on `d221695`, current generated
artifact, strict checks green, eight model tests and six rendered tests. Chrome or
Chromium is required for browser tests. Run browser-heavy files separately if the
existing exit-137 resource issue recurs; do not count an interrupted run as passing.

Docs sync: [task brief](task-brief.md), [implementation log](implementation-log.md),
this complete handoff and the [current task index](../INDEX.md) are updated.
README, installation guidance, browser architecture, audit progress and parent
roadmap describe the delivered slice and its limits. No wiki or global memory was
created; historical handoffs remain intact with the index pointing to current state.

Restart opener:

> Continue `/Users/superstorm/Documents/Code/windsurf/codetrap`. Read the Learning
> workflow handoff and preceding access/Review handoffs. Learning changes are
> checkpointed on `main` after `d221695`, passing 630 tests. Preserve raw per-source
> drafts, original async identities, explicit review and no mutation replay. F8
> still has documented legacy boundaries; the next slice is durable draft recovery.
> Preview is port 4748 and a new tab needs an authorized launch link. Start with
> `bun run check:web` and `bun run typecheck`. Do not implicitly commit, publish,
> accept pending memory or activate observation.
