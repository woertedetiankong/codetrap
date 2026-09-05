# Implementation decisions

## 2026-09-05 — Reproduce the delivered entry

The previous delivery provided a bare hash URL; credentials live in sessionStorage,
so an independently opened tab can lack authorization. Read-only checks returned
401 without a credential and 200 with the running preview's credential. The old
UI reported every 401 as a server restart and retried through location.reload.
Earlier browser tests entered with launch credentials and did not establish that
the delivered fresh-tab link was usable. The user screenshot exposed that gap.

Use an explicit full-launch-link form that validates only the current origin.
Switch credentials after a fixed-path bootstrap probe succeeds, retain the existing
DOM/state, and resume the original page. New tabs still require authorization.
Different-port links are rejected locally because navigating there would lose
in-tab drafts and cross-origin API calls would change the authorization boundary.
The restart hint now includes the current port; it is only for a stopped service.

An epoch protects against old 401s even after a retry with the same token. Pause
background polling and block new API calls while recovery is open. Do not replay
failed writes after reconnect. A valid in-tab token still works with storage denied.

## 2026-09-05 — Recovery tests

Five rendered recovery tests pass fresh-tab authorization, raw multiline draft
preservation after a rejected save, no automatic write replay, local rejection of
other-origin/port links, network retry with storage denied, and late-401 isolation.
Two transport/parser tests cover URL boundaries and per-request token capture.
Existing entry tests now assert a hidden retained shell; server-error bootstrap is
an additional case. One initial test incorrectly expected a receipt from Save,
which has no receipt contract; it now checks draft completion and persisted data.

The installed `codetrap` shim was not executable for the preflight check. Running
the same project CLI through Bun returned no applicable memory; installation was
not changed. Existing proposed memory remains untouched.

## 2026-09-05 — Final evidence and docs

616 tests across 88 files pass in 16 sequential processes. Project and DOM-only
typechecks, generated asset freshness, whitespace and npm package inclusion pass.
The rebuilt standalone embeds the identical source bundle and passes fresh bare
link authorization, draft navigation, explicit save/reload and phone rendering.
The real source preview was checked read-only from a fresh unauthenticated page
through the form to its original Review route; desktop/phone screenshots were
inspected with no page errors or horizontal overflow. Real candidates were not
edited. Restarted only the owned source wrapper, preserving its service token.

README, installation guidance, browser architecture, audit status, roadmap and
task index now describe the in-place recovery and its boundaries. This complete
handoff supersedes the Review handoff's startup/recovery state. The next development
slice remains Learning state and drafts. No wiki, confirmed memory or observation
data was created. No new commit or push occurred.

## 2026-09-05 — User-requested checkpoint

The user requested a local Git commit of the current workspace after the recovery
fix. Review and access recovery are included together. Asset freshness, project
and DOM typechecks and whitespace checks passed again; the preceding full
regression remains 616 passing tests. Current handoff/index/audit commit-state
claims were reconciled; historical pre-checkpoint entries remain intact. No push.
