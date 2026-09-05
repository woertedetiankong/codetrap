# Implementation decisions

## 2026-09-04 — Commit boundary and state slice

Committed all completed stages as `6d54a4e` at the user's request, then began this
slice from a clean tree. Previous handoffs describe their pre-commit historical
state. The next handoff/index will identify this committed baseline.

Review has destination-specific presentation coupled to Learning coverage helpers.
Migrate the complete state/draft/request/action lifecycle while keeping those
presentation templates as an explicit legacy boundary. Avoid passing mutable
workspace state to the new controller or claiming every Review renderer is typed.

Current form rerenders clear the dirty flag, candidate reads lack project/session
generation guards, and mutation completion uses current navigation identity.
Store raw form drafts per project/session/candidate in tab memory. Candidate writes
must capture identity and visible payload before any await; later completion must
not select or overwrite a different candidate. Keep existing backend authorization
and receipt semantics; this is not a new cross-process concurrency protocol.

## 2026-09-05 — Verified draft and mutation boundaries

Nine model tests pass identity validation, project/session/candidate draft isolation,
request A/B/A, deferred updates, captured mutation payloads, scoped conflicts and
insight metadata preservation. Four rendered tests exercise locale/view/project
navigation, phone layout, slow saves, approvals, conflict acceptance, rejection,
rollback, insight application and slow Back recovery. Existing five smoke tests pass.

The first navigation test initially hit a collapsed project pane; setting that test
preference exposed a real issue: project reset cleared model state but left the old
form visible while sessions loaded. Reset and session loading now immediately update
the Review renderer. A successful save on candidate A while B is selected refreshes
the same session without selecting A or discarding B's draft. A different project's
completion only reports its original identity. Candidate inputs are locked during
an action; receipts carry the originating project/session/candidate and wrap on phones.

Drafts stay in tab memory and protect accidental reload/close through beforeunload;
this is not durable autosave. Session deletion/cleanup clears drafts only for the
explicitly removed records. Backend cross-process edit concurrency is unchanged.

## 2026-09-05 — Post-refresh discard boundary

The first complete regression passed 607 tests and standalone draft/save/reload
verification passed. Final review identified a narrow stale-base gap: after a
background change was deferred, Discard restored the cached pre-change candidate.
It now loads the server version before re-enabling actions. A deterministic test
checks the intermediate loading state and final external content; there are now
11 model tests. This does not add cross-process compare-and-swap semantics.

## 2026-09-05 — Final validation and reconciliation

The final implementation passes 608 tests across 87 files in 15 sequential processes,
plus both strict typechecks, generated-asset freshness and whitespace checks.
The rebuilt standalone embeds the same browser bundle as source and passes isolated
draft navigation, explicit save/reload, Chinese phone and token-cleanup checks.
Read-only source desktop/phone screenshots were inspected; no page errors or
horizontal overflow were found. Destination templates retain their existing layout.

Updated README, browser architecture, audit implementation status, parent roadmap
and the task index; created the complete handoff. Historical pre-commit handoffs
remain intact, with their commit-state correction in the current index/handoff.
The next bounded slice is Learning state and practice/proposal drafts. Review
presentation, broader Impact typing, scale measurements and real benefit remain
open. No wiki or global memory was created. Baseline commit stays `6d54a4e`; this
new Review slice remains uncommitted and no push occurred.
