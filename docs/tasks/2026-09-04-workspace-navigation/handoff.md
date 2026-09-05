---
title: Workspace navigation and observation readiness
status: Complete
updated: 2026-09-04
---

# Handoff

## Result
Learning and Library retain the selected workspace and exact item through reload and browser Back/Forward. Phones have separate list and reader views, collapsed filters, compact Library health controls, and one main scrolling region. Impact Overview reports observation readiness from both current client configuration and real records.

## Contracts
- `src/web/project-registry.ts` derives `p-` plus 24 hex characters from the normalized registered root. Bootstrap/project APIs expose `route_ref` without migrating the registry or creating an identity file. References are local to that root, change if it moves, and are not authorization credentials. Token authentication and registered-project checks remain unchanged.
- `src/web/client-route.ts` supports Library scope/ID and Learning origin/ID plus a workspace project reference. Cross-project Learning links preserve both identities. `pane=list` preserves the phone list state. Existing Review, Run, and view-only links still parse.
- Missing or malformed Learning/Library targets stay explicit. An unknown project opens a recovery view; choosing a registered project closes the phone project sheet and releases the missing target.
- Back/Forward restores reading position within the tab. Search/filter values and scroll positions are not persisted across tab close. Unsaved practice notes survive in-tab navigation; save before reload/close. This is not a general persistent draft store.
- `loadLearningRunsForCurrentInsight` updates only the task options after loading, avoiding replacement of a focused practice editor and its scroll container.
- `src/web/observation-connection.ts` reads Codex/Claude configuration independently. States are `not_configured`, `awaiting_run`, `has_records`, and `unavailable`; individual clients also retain separate unavailable states. Configuration does not establish trust/execution, and historical records do not establish ongoing capture.
- Overview adds `connection` alongside the existing ledger-based `availability`. Corrupt ledgers return unavailable with an unknown Run count, not zero activity. A healthy ledger remains visible despite unreadable client configuration. No hook, identity, or ledger writes occur from these reads.
- The client uses Overview's bounded `recent_runs` instead of issuing a second identical ledger projection request. Evals and evidence still require explicit judgments; nothing automatically changes confirmed memory.

## Validation
- **562 passed, 0 failed**, covering all 75 test files and 3,065 assertions in five sequential batches. Two earlier single-process attempts exited 137; the latter had 469 passes and no assertion failure before termination. Do not describe those interrupted attempts as passes.
- New browser coverage includes cross-project reload/Back/Forward, accepted global versus project identity, missing links, mobile recovery, private note preservation, reading position, filter expansion, and unavailable observation state. Bundled HTML is exercised by the cross-project browser workflow.
- A transient evidence wait timed out once; diagnostics plus five bounded repetitions and the final suite passed. Failure context remains in the test for future diagnosis.
- Typecheck and standalone build passed. The compiled real-project Library restored project lesson #3 on refresh and rendered the new readiness interface.
- After the full suite, a copy-only change clarified that absent observations do not imply absent hook configuration. The 21 text/script checks and a final standalone rebuild also passed.
- Visual artifacts in the session directory: `workspace-list-mobile.png`, `workspace-reader-mobile.png` (isolated synthetic fixture), and `observation-readiness.png` (actual project). Final source preview confirms both clients are currently unconfigured and no task records are present.
- Verification logs: `/Users/superstorm/.codex/visualizations/2026/09/05/01a06f12-717a-7352-9e52-ea6e306e4141/verification/workspace-suite-{1..5}.log` and `workspace-copy-check.log`.

## Working state
This stage, the Impact foundation, and Learning experience path remain uncommitted on `main`, based on `8b1c065`. Preserve all three. No commit, push, deployment, binary installation, or real-project hook activation was performed. Isolated temporary fixtures supplied synthetic visual and browser-test data. The source preview is on localhost port 4748; temporary compiled and fixture servers are stopped after verification.

The existing bundling lesson remains proposed as `cand-001` in session `2026-09-05-capture-bind-serialized-browser-functions-by-an-explicit-stable`. This optimization request does not authorize accepting it.

## Next useful work
The daily reading/navigation slice is complete. A useful next product slice is a periodic experience review: inspect practice notes and actual task feedback, explicitly link a proposed lesson revision to its motivating evidence, and compare later outcomes. Preserve review and uncertainty; avoid assuming causality or adding a graph before those links exist. Profile large real ledgers before adding projection caches.

## Restart opener
Read this handoff, [task brief](task-brief.md), [implementation log](implementation-log.md), and [task index](../INDEX.md). Verify the working tree and preserve all pending stages. Follow the user's next direction; do not activate observation, accept memory, or publish merely because this stage is complete.
