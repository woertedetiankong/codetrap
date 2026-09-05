# Web access recovery — handoff

Updated: 2026-09-05 (America/Los_Angeles).
Status: Complete.
Parent: [Review handoff](../2026-09-04-review-state/handoff.md), [roadmap](../../agent-experience-compiler-roadmap.md).
Durable contract: [browser architecture](../../browser-architecture.md#access-recovery).

## Delivered behavior

The user-reported fresh-tab entry no longer misdiagnoses every 401 as a server
restart. Missing credentials show an explicit authorization form, rejected
credentials show reconnection, and network failures versus invalid/server-error
bootstrap responses have distinct explanations. A meaningless refresh is no
longer the only recovery path.

`src/web/browser/access.ts` parses a pasted launch URL locally, requires the
current origin and an entry path, rejects user/password or invalid token structure,
and probes only `/api/bootstrap` with no cache, no redirects and a ten-second
timeout. It does not fetch or navigate to the supplied URL. The new credential
replaces the in-memory and optional tab-storage token only after a valid bootstrap
response. The input is cleared and the pasted route is ignored; the selected
project/candidate remains the user's original selection.

`platform.ts` supports current-credential request headers and classifies recovery.
The shell is hidden rather than removed. `workspace.js` resumes the existing
DOM/controllers on reauthorization, retaining Review drafts and route without a
page reload or bootstrap reset. API 401s open recovery even during writes or
background polling. While disconnected, new API calls are blocked and polling is
paused. Reconnect advances a generation so old 401s cannot reopen the panel even
when retry used the same credential. Failed writes are never automatically replayed.

Two-locale text and accessible form controls use the existing recovery card design.
The restart hint includes the current port and is explicitly for a stopped server.
Network retry stays in place and works even when sessionStorage is unavailable.
Fatal synchronous entry failures still use the entry's reload fallback.

## Validation

- **616 tests across 88 files pass in 16 sequential processes**, up from the
  previous 608. Added five recovery browser tests, two parser/transport tests and
  one server-error entry test; updated entry/text expectations to the new behavior.
- The rendered regression opens a bare URL in a separate tab in the same browser
  context as an authorized tab. It verifies the missing-token state, authorization
  form, original route and subsequent reload. Other cases prove multiline Review
  draft survival after save gets 401, rejected replacement-token handling, explicit
  subsequent save, no write replay, other-origin/port rejection, storage-denied
  network retry and same-token late-401 isolation.
- Final logs: `/Users/superstorm/.codex/visualizations/2026/09/05/01a06f12-717a-7352-9e52-ea6e306e4141/verification/access-recovery-final-{1..16}.log`.
  Runner: `/tmp/codetrap-access-regression.py`. Earlier Review logs are preserved.
- `bun run typecheck` (project + strict DOM), `bun run check:web`, whitespace and
  npm package inclusion pass. The generated bundle was rebuilt, not edited by hand.
  `/tmp/codetrap-access-pack.json` contains the dry-run package manifest.
- Rebuilt `/tmp/codetrap-access-verified` embeds exactly the source browser bundle.
  `/tmp/codetrap-verify-access.ts` proves fresh bare-link authorization, Review
  draft navigation/Back, explicit save/reload and Chinese phone layout in disposable
  standalone data, followed by real source-preview read-only authorization.
- Inspected recovery desktop/phone and restored desktop screenshots beside the logs:
  `access-source-missing-desktop.png`, `access-source-missing-mobile.png`,
  `access-source-restored-desktop.png`. Additional saved delivery screenshots are
  `access-source-restored-mobile.png` and `access-standalone-mobile.png`. No page
  errors or horizontal overflow were found. Standalone server and disposable data
  were stopped/removed after verification.

## Workspace, boundaries and follow-up

- Review and access recovery are checkpointed together on `main`, after baseline
  `6d54a4e`, at the user's request. The commit containing this handoff is titled
  `fix: preserve review drafts and recover web authorization in place`. No push
  was requested or made. Older uncommitted notes describe pre-checkpoint state.
- Source preview on port 4748 was restarted with its existing token via the owned
  `/tmp/codetrap-experience-preview.ts`; PID 37116 at verification, exec session
  76155. Verify PID/command before stopping it. Standalone port 4749 is stopped.
  A new authorized in-app tab was opened and its Review title confirmed; do not reload old tabs
  as an incidental action because they may contain drafts.
- New tabs still require authorization. There is no persistent cookie, automatic
  cross-tab sharing, unauthenticated token endpoint or cross-origin reconnection.
  Moving between ports requires a separate authorized tab. Local drafts remain
  in tab memory, not durable autosave; closing or reloading can lose them.
- A reconnected view whose earlier read failed keeps its explicit read retry.
  Retained edits do not bypass existing backend approval/version checks. Do not
  add automatic mutation retries to make recovery look seamless.
- The real preview was read-only. No real candidates, confirmed memory, observation
  hooks, eval corpus or feedback records were changed. Preserve pending proposed
  memory, including the browser-function binding candidate in the Review handoff.
- The next slice remains Learning state and practice/proposal draft protection.
  Review presentation and broader Impact state still have legacy boundaries.
  F8 is not wholly closed; scale and real-task benefit evidence remain separate.

## Restart verification

```sh
git status --short
bun run check:web
bun run typecheck
bun test src/tests/web-browser-platform.test.ts
bun test src/tests/web-access-browser.test.ts
bun test src/tests/web-browser-entry.test.ts
```

Expected: the Review/recovery checkpoint after `6d54a4e`, a clean working tree
(unless subsequent work has begun), current artifact,
strict checks green, eight platform tests, five access browser tests and four
entry browser tests. Supported Chrome/Chromium is required for rendered tests.
If the artifact is stale, regenerate and inspect with `bun run build:web`.
Run browser-heavy files separately if the existing exit-137 resource limit recurs.

Docs sync: created task brief, decision log and this complete handoff; rewrote
README, installation guidance, browser architecture, audit implementation status,
roadmap and current task-index entry. No wiki or global memory was created.
Historical handoffs remain intact; the index corrects their startup/recovery and
commit-state claims. No known errata in this handoff.

Restart opener:

> Continue `/Users/superstorm/Documents/Code/windsurf/codetrap`. Read the access
> recovery handoff and preceding Review handoff. Both slices are checkpointed
> after `6d54a4e` and pass 616 tests. Browser entry is `src/web/browser/entry.ts`; recovery
> is `access.ts`. Preserve in-place drafts, same-origin credentials, no write
> replay, prior rollback destinations and proposed memory. Preview is port 4748;
> a new tab needs an authorized launch URL. Start with `bun run check:web` and
> `bun run typecheck`. Next: Learning state and practice/proposal drafts. Do not
> implicitly commit, publish, accept memory or activate observation.
