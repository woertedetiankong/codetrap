# Implementation log — Phase 1B

Decisions affecting the product model, data model, Web review, or CLI/MCP
contract (§19.3). Ceremony evidence lives in `handoff.md`.

## Discovery

Two findings shaped the whole slice.

**`SESSION_VERSION` was write-only.** It is stamped on `session.json`,
`index.json` and `candidate-traps.json`, and never read anywhere — no version
check, no forward guard. Worse, `writeCandidateDocument` re-stamped it
unconditionally, so a v1 file mutated by a v2 binary would have become
v2-labelled and v1-shaped. The version gate had to land before any schema change.

**The whole `CandidateTrap` crosses into untyped browser JS.** `/api/candidates`
serializes every field, and `src/web/client-script.ts` is a template string —
renaming a field would break the review console with no typecheck and no test
failure until the browser smoke test. That ruled out replacing `status`.

## Decisions

### D1 — The envelope is additive; `status` stays

Every §8.2 field is added as optional: `schema_version`, `revision`,
`content_hash`, `candidate_kind`, `destination_hint`, `review_decision`,
`delivery_state`, `rationale`, `source_agent`, `source_manifest_refs`,
`authorization`, `migration_warning`. `status` is retained and kept consistent
with the axes.

Considered and rejected: replacing `status` with the three axes. It would have
broken the Web console silently, and §8.3's compatibility requirement is
explicit that old Web review keeps working during the migration window.

### D2 — Migration must not recompute `status`

The first cut derived `status` from the migrated axes via `statusFromAxes`. The
round-trip test caught it: a legacy `accepted` record with no trap link maps to
`approved + staged`, whose derived status is `proposed` — so migrating would
have moved it out of the reviewed tab and back into the editable inbox.

That is precisely what §8.3 forbids: *"No record changes meaning merely because
it was loaded by the new version."* Migration now preserves `status` verbatim and
only adds the axes. `statusFromAxes` survives as the documented invariant for
records the new code writes, asserted by a test.

This is the single most important correctness decision in the slice, and it was
found by the reversibility test rather than by reasoning.

### D3 — Reversible means the transform inverts, not that a backup exists

`session migrate --apply --down` reconstructs the v1 record by dropping exactly
the fields v1 did not have. The regression test asserts
`JSON.stringify(roundTripped) === JSON.stringify(originals)` — byte-identical,
not merely equivalent.

Restoring a backup would only prove a copy was kept. Inverting the transform
proves the envelope added no information that cannot be discarded cleanly, which
is what lets a migrated project be handed back to an older codetrap.

### D4 — Authorization binds to a content hash, and an agent cannot self-authorize

`session approve` records `{revision, content_hash, authorized_scope,
destination, executor, authorized_at}` on the candidate and appends an `approve`
receipt. Commit then enforces two rules:

- If an authorization exists, the content being committed must hash to the
  authorized value — including content supplied inline via `--edit-json`, which
  is checked separately so an edit cannot be smuggled in at commit time.
- `--executor agent` requires an authorization. A human running the command is
  themselves the authorization; an agent is not.

`content_hash` reuses the Phase 1A suppression fingerprint normalization
(title/context/mistake/fix/scope), so retagging or changing severity is not a
material edit but changing what the lesson says is.

**This is a behavior change from Phase 1A**, where `session accept --executor
agent` committed without any prior approval. Five 1A tests were updated to the
two-step flow. The change makes 1A's criterion 2 stronger, not weaker: the
instruction an agent acts on is now recorded and checked rather than asserted.

### D5 — Migration discovers sessions by directory scan

`migrateCandidateDocuments` and `candidateMigrationStatus` enumerate session
directories rather than reading `index.json`. A data-integrity command must not
be able to miss records because the index is stale or hand-edited; this mirrors
the existing `rebuildIndexEntries` fallback.

### D6 — A user-facing skip is `suppressed`, not `rejected`

`session reject` now sets `review_decision: "suppressed"` (§8.1: skip is a review
action recording a reason and fingerprint, not a candidate kind). `status`
remains `rejected` for compatibility. Phase 1A already records the fingerprint
that makes suppression enforceable.

### D7 — Rollback clears the authorization

A rolled-back candidate returns to `pending + rolled_back` with its
authorization dropped: the approval covered a commit that has since been undone,
so committing again is a fresh decision.

## Contract changes

CLI:

```text
session approve <candidate-id> [--session <id>] [--executor <e>] [--authorized-scope <s>]
session migrate [session-id] [--apply] [--down] [--json]
```

`session accept` now refuses an agent-executed commit without a current
authorization, and refuses any commit whose content no longer matches one.

`doctor` gains `candidate_migration: {pending_sessions, pending_records}` and a
`codetrap session migrate --json` next-action.

Unchanged on purpose: no new MCP tool, no Web route changes, no field renames.

## Out of scope, deliberately

No `learn` subcommands or pull adapters (1C). No `.codetrap/learning/` locks,
coverage machinery, or semantic dedup (1D). No Inbox UI or context-pack export
(1E). No `insight` shelf — insight-hinted lessons ride as `unclassified` with a
`destination_hint` until Phase 2. `destination_hint` is free-form and never
enters an enum.

## Test and typecheck state

`src/tests/candidate-envelope.test.ts` — 28 tests: the §8.3 mapping for all four
legacy states, the byte-identical round trip, meaning-preservation, the forward
guard, read-does-not-write, authorization binding and invalidation, and the
migrate command driven through the real CLI.

Full suite: 288 pass, 1 fail — the pre-existing `embedding reindex API` failure
that reproduces on a clean `HEAD` worktree. `bunx tsc --noEmit` clean.
