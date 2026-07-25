# Task brief — Phase 1B: stable envelope and compatibility

Parent plan: `docs/agent-experience-compiler-roadmap.md` §16 Phase 1B
Predecessor: `docs/tasks/2026-07-25-phase1a-existing-surface-vertical-proof/`
Date opened: 2026-07-25
Status: **complete** — all three criteria met 2026-07-25; see `handoff.md`

## Goal

Give the candidate record a stable, versioned envelope, and make authorization
mean something: an authorization is bound to a revision, and a material edit
invalidates it.

```text
candidate v1 on disk
  -> read through a version gate      (today: no gate at all)
  -> normalized into the v2 envelope  (three axes, revision, content_hash)
  -> user approves a specific revision
  -> a material edit invalidates that approval
  -> commit refuses an approval that no longer matches
  -> downgrade back to v1 is byte-faithful
```

## Why this slice, now

Phase 1A closed with risk 8: the receipt **records** an authorization but never
**enforces** it. `session accept` writes whatever the candidate currently says,
so an edit between approval and commit goes unnoticed. Every later phase builds
on the assumption that an authorization means something, so this is the one to
close before 1C adds more producers.

## Scope (§16 Phase 1B, unchanged)

- Stabilize only `pitfall_trap` and `unclassified`, informed by Phase 0 data.
- Add revision/hash, three-axis state, `rationale`, evidence refs, source
  manifest refs, authorization record, staging state, and trust receipt.
- Migrate existing `CandidateTrap` records using §8.3; old CLI/Web/session data
  remains readable, with regression fixtures for every old state.
- Future destination kinds remain non-binding hints, not schema enums.

### Explicitly out of scope

- No `learn` subcommands or pull adapters (1C).
- No `.codetrap/learning/` locks, coverage machinery, or semantic dedup (1D).
- No Inbox UI or curated context-pack export (1E).
- No `insight` shelf — insight-hinted lessons ride as `unclassified` with a
  `destination_hint` until Phase 2.
- No new destination kinds. `destination_hint` is free-form and non-binding.

## Acceptance criteria (§16, unchanged)

1. Migration is **lossless and reversible**.
2. Old accepted records still point to their durable traps.
3. Material edits invalidate authorization.

## Discovery findings (done, before writing code)

| Fact | Consequence for this slice |
|---|---|
| `SESSION_VERSION` is stamped on write and **never read** — no version check anywhere | The version gate must land first, or a v1 file mutated by a v2 binary becomes v2-labelled and v1-shaped |
| `writeCandidateDocument` unconditionally re-stamps `SESSION_VERSION` | Writing must preserve the document's own version until it is deliberately migrated |
| The whole `CandidateTrap` is serialized to the browser; `client-script.ts` is a template string with no typechecking | The envelope must be **additive**; `status` stays as a maintained mirror rather than being replaced |
| Two status vocabularies already drive CSS classes and i18n keys (`CandidateStatus`, derived `SessionCandidateReview.status`) | Do not add a third user-visible vocabulary; derive `status` from the axes |
| No JSON-format migration precedent exists in the repo | Follow `src/db/schema.ts` for the gate and backup, and `project-identity.ts` for tolerant normalize-on-read |

## Design

### D1 — Additive envelope; `status` becomes derived, not removed

New fields on `CandidateTrap`, all optional on read so v1 records normalize
cleanly: `schema_version`, `revision`, `content_hash`, `candidate_kind`,
`destination_hint`, `review_decision`, `delivery_state`, `rationale`,
`source_agent`, `source_manifest_refs`, `authorization`, `migration_warning`.

`status` is retained and kept consistent with `(review_decision,
delivery_state)`. Removing it would break the Web console silently.

### D2 — §8.3 migration mapping, applied on read

```text
old proposed                        -> pending  + draft
old rejected                        -> rejected + draft
old accepted with accepted_trap_id  -> approved + committed
old accepted with missing trap/link -> approved + staged + migration_warning
```

Normalization is pure and lazy (`project-identity.ts` precedent). Persisting the
migration is a deliberate act, so a read alone never rewrites a v1 file.

### D3 — Reversibility is a real downgrade, not a backup file

`session migrate --down` reproduces the v1 record byte-for-byte from a v2 one.
No backup file is written: the exit gate says *reversible*, and restoring a copy
is a weaker claim than being able to invert the transform. Round-tripping
v1 -> v2 -> v1 is the regression test. (The scope-migration precedent takes
backups because it moves rows between databases and cannot invert; a pure field
transform can.)

### D4 — Authorization binds to `content_hash`

`session approve` records `{revision, content_hash, scope, executor, at}` on the
candidate. `session accept` recomputes the hash and **refuses** when it differs
from the authorized one. Editing bumps `revision`, recomputes `content_hash`,
and drops the now-stale authorization.

`content_hash` covers the material fields only — the same normalization as the
1A suppression fingerprint — so reformatting is not a material edit.

## Plan

1. Version gate on the candidate document: read-side check, forward guard, and
   stop re-stamping on write. Land and test this alone.
2. The v2 envelope types plus a pure `migrateCandidate` / `downgradeCandidate`
   pair, with round-trip tests.
3. Lazy normalize-on-read; every existing consumer keeps working off `status`.
4. `session approve`, hash-bound authorization, and enforcement in `accept`.
5. Edit invalidation on `saveCandidate`.
6. `session migrate` (dry-run default, `--apply`, `--down`) and a `doctor`
   next-action when records need migration.
7. Regression fixtures for all four §8.3 legacy states plus the trust receipt.

## Risk

The largest risk is breaking the Web review console, which consumes the record
untyped. Mitigation: additive-only fields, `status` preserved, and the existing
`web-console` / `web-browser-smoke` tests kept green throughout.
