# Learning durable draft recovery — handoff

Updated: 2026-09-05 (America/Los_Angeles).
Status: Complete. Recovery changes are checkpointed on `main` after `ccc317b`
at the user's request in the commit containing this handoff.
Depends on: [Learning workflow](../2026-09-05-learning-workflow/handoff.md),
[access recovery](../2026-09-05-web-access-recovery/handoff.md).
Parent: [roadmap](../../agent-experience-compiler-roadmap.md).
Contract: [browser draft recovery](../../browser-architecture.md#learning-browser-draft-recovery).

## Delivered behavior and closed decisions

Learning practice notes and raw experience proposals are backed up as the user
edits. Reopening an authorized Learning item in the same browser profile/origin
(including port) offers explicit inspection, restore or deletion. Restoring does
not send data, restore validation/approval or replay an operation. The user still
saves notes or sends proposals explicitly through the existing backend lifecycle.
Review and Evals persistence are separate work, not included in this slice.

`src/web/browser/learning-draft-store.ts` validates and stores immutable UUID-keyed
localStorage snapshots. Records contain raw fields, source-project/Insight identity,
timestamp, schema version and a practice note's original saved baseline. No token,
request, validation or approval is stored. Limits are 100 valid snapshots and 64 KiB
of UTF-8 serialized text per snapshot, with 30-day expiry after the last successful
edit backup. Expiry cleanup touches supported valid records only. Malformed/future
formats are skipped with a notice, not migrated or used as model state.

Each tab writes its new snapshot before removing only its own previous immutable
key. If writing fails, the last successful backup survives and the newest text
stays in the editor with a storage warning. No live draft is evicted to make room.
Successful save/send/discard removes the tab's own backup, not another tab's newer
version. LocalStorage remains browser-readable data, not encrypted project storage
or cross-device sync. Browser-data clearing, expiry, denial and quota limit recovery.

`learning-recovery.ts` coordinates backup and recovery UI. A loaded source identity
is required; missing/deleted items never restore into a substitute. Saved text uses
textContent with wrapping. Restoring cannot replace an active draft of the same
kind. Practice-baseline differences and existing proposal review records are shown.
Consuming a restored snapshot removes the inspected key only after a new backup
succeeds. Concurrent updates invalidate a vanished selection; actions disable until
another choice. Storage events never replace editor text.

`learning-model.ts` carries practice baselines and advances them only when its own
practice save is acknowledged while newer edits remain. Unrelated status/feedback/
Run actions preserve the original baseline. Restored proposals start unvalidated;
creation still uses the existing backend validator, without a new mandatory preview
gate. Unconfirmed create responses remain recoverable and expose existing Review
records after a fresh load; no automatic retry was added.

`learning.ts`, the legacy workspace, two-locale text and minimal static CSS connect
the feature. The unload guard permits successfully backed-up Learning drafts to
leave; pending operations, failed backups or externally removed owned snapshots
retain the warning. Review's own unload protection remains unchanged. No backend
API/storage/concurrency protocol or dependency was added.

## Validation evidence

- Full regression: **648 passing tests across 92 files in 19 sequential processes**.
  Added 7 storage tests, 10 rendered recovery tests and 1 practice-baseline test
  above the 630-test checkpoint. Existing workflows remain covered.
- Browser tests cover reload and tab close/reopen, exact raw fields, explicit
  restore/delete, no write replay or validation restoration, changed server notes,
  source isolation, concurrent writers, invalidated selection, storage quota and
  complete localStorage denial, malformed/expired records, safe text rendering,
  phone overflow, unconfirmed creation and newer edits during a save.
- Logs: `/Users/superstorm/.codex/visualizations/2026/09/05/01a06f12-717a-7352-9e52-ea6e306e4141/verification/learning-recovery-final-{1..19}.log`.
  Runner: `/tmp/codetrap-learning-recovery-regression.py`. Runtime code is unchanged
  since that complete run; subsequent changes are docs and delivery verification.
- `bun run typecheck` (project + strict DOM), `bun run check:web`, whitespace and
  npm module-inclusion checks pass. The generated bundle was rebuilt, not hand-edited.
  Manifest: `/tmp/codetrap-learning-recovery-pack.json`.
- `/tmp/codetrap-learning-recovery-verified` is built with the supported helper and
  embeds the identical source browser bundle. The isolated
  `/tmp/codetrap-verify-learning-recovery.ts` verifies fresh authorization, raw
  Learning drafts, Library/Back, reload recovery without writes or validation reuse,
  explicit practice save, proposal creation, matching Review fields and token cleanup.
  Temporary home/project and standalone server on 4749 were removed/stopped.
- Inspected recovery screenshots beside the logs:
  `learning-recovery-standalone-desktop.png`, `learning-recovery-prompt-mobile.png`.
  Additional delivery screenshots: `learning-recovery-standalone-mobile.png`,
  `learning-recovery-source-desktop.png`, `learning-recovery-source-mobile.png`.
  Source Learning has no real Insights; actual-source checks are read-only empty
  states. No page errors or horizontal overflow were observed.
- The original audit still matches the user attachment exactly. Maintainer fixture
  remains identical to `ccc317b` (15 traps/24 queries); no real project
  `.codetrap/evals/suite.json` was created.

## Git, preview and next work

The requested pre-development commit is **`ccc317b`**, titled
`feat: preserve Learning drafts and coordinate workflow actions`. It includes the
prior workflow and refreshed handoff. The durable recovery stage is checkpointed
in the commit containing this handoff, titled
`feat: recover Learning drafts across browser reloads`.
Review/access is `d221695`; stages through Library are `6d54a4e`. No push occurred.

Owned source preview: `/tmp/codetrap-experience-preview.ts`, port 4748, PID 42990,
exec session 54945 at verification. Verify PID/command before stopping it. It was
restarted with the existing token and source changes. A request to open a fresh
authorized Learning preview was queued by the app; the user's existing in-app tab
was observed on Evals and left undisturbed. Do not claim that queued opening was
visibly delivered, and do not reload a user's existing tab incidentally. A new tab
needs a full authorized launch link; never print the token in logs or docs.

Next work by value:

1. Extend durable drafts to Review with candidate/version/status-aware recovery;
   Evals needs its own project/suite/context contract. Do not mechanically persist
   their approval or operation state with the Learning helper.
2. Complete remaining feature typing: Learning collections/filter presentation and
   Run choices, Review presentation and broader Impact state.
3. Measure history/refresh performance and real-task benefits; F6/F7 remain open.

Closed boundaries: browser backups do not solve backend cross-process editing,
cloud sync or cross-device identity. A global draft manager is not implemented;
leftover drafts for removed sources expire on subsequent access. Keep recovery
source-specific and explicit, and do not add silent mutation replay.

Red lines: preserve real proposed candidates and confirmed memory; do not activate
observation or run real model experiments as part of UI verification. No real data
mutations were performed. Keep the pending browser-function binding and visible
acceptance-field candidates for explicit user review. Do not implicitly commit,
push, publish or accept memory in follow-up development.

## Restart verification

```sh
git log -1 --oneline
git status --short
bun run check:web
bun run typecheck
bun test src/tests/web-learning-draft-store.test.ts src/tests/web-learning-model.test.ts
bun test src/tests/web-learning-recovery-browser.test.ts
```

Expected: the recovery checkpoint after `ccc317b`, a clean working tree unless
subsequent work has begun, fresh
artifact, both typechecks green, 16 store/model tests and 10 rendered recovery tests.
Chrome/Chromium is required. Use separate browser-heavy processes if the existing
exit-137 resource issue recurs; interrupted results do not count as passing.

Docs sync: created [task brief](task-brief.md), appended meaningful decisions in
[implementation log](implementation-log.md), completed this handoff and updated the
[current task index](../INDEX.md). README, installation, browser architecture,
audit progress and parent roadmap are reconciled. No wiki/global memory was created.
Historical handoffs remain intact; the index identifies the current checkpoint and
supersedes their in-tab-only Learning limitation.

Restart opener:

> Continue `/Users/superstorm/Documents/Code/windsurf/codetrap`. Read the Learning
> draft recovery handoff and task index first. Prior workflow is committed as
> `ccc317b`; durable recovery is checkpointed after it and passes 648 tests. Entry is
> `src/web/browser/learning.ts`, persistence is `learning-draft-store.ts`. Preserve
> immutable snapshot identities, explicit recovery, current server state and no
> write/approval replay. Preview is port 4748; fresh tabs require an authorized
> launch link. Start with `bun run check:web` and `bun run typecheck`. Next is a
> separately scoped Review recovery contract. Do not implicitly commit, publish,
> accept memory or activate observation.
