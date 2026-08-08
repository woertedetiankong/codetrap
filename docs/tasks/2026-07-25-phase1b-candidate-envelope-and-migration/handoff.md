# Handoff — Phase 1B (stable envelope and compatibility)

## Capability layer completed

The candidate record now has a versioned envelope, and an authorization means
something: it is bound to a revision and a content hash, and commit refuses when
either has moved.

```text
candidate v1 on disk
  -> version gate + forward guard      (before: no gate at all)
  -> normalized in memory to v2        (three axes, revision, content_hash)
  -> user approves one revision        codetrap session approve
  -> a material edit invalidates it    revision bumps, authorization dropped
  -> agent commit refuses a stale one  codetrap session accept --executor agent
  -> downgrade inverts exactly         codetrap session migrate --apply --down
```

Shipped: the §8.2 envelope as additive optional fields, the §8.3 migration with
a real inverse, `session approve`, `session migrate` (dry-run by default), a
forward-compatibility guard, and a `doctor` next-action when records are stale.

## Red lines honored (trust receipt)

```text
schema migration      2 sessions, 2 records, v1 -> v2, applied after a dry run
reversibility         verified by diff against a pre-migration snapshot: IDENTICAL
durable trap writes   1 committed and rolled back during verification; 0 net
global store          0 traps before and after — untouched
records altered in meaning by being read: 0
```

The migration was exercised on **real Phase 1A data**, not fixtures: the two
sessions this repo's own `.codetrap/` carried were v1, `doctor` flagged them,
the dry run wrote nothing, `--apply` migrated them, and `--apply --down`
reproduced the pre-migration bytes exactly (`diff -r` clean).

## Acceptance criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Migration is lossless and reversible | met | `JSON.stringify` round-trip equality in test; `diff -r` against a real pre-migration snapshot |
| 2 | Old accepted records still point to their durable traps | met | migrated Phase 1A record still resolves trap #2 and stays searchable |
| 3 | Material edits invalidate authorization | met | revision bumps, authorization dropped, agent commit refused with the two hashes named |

## Coverage check status

Unexercised for a third consecutive phase. The §9.3 machinery is still
Phase 1D's and still has no evidence behind it.

## Measured UX budgets

```text
migration dry run -> apply    2 commands, report names every session   PASS
reversibility                 one command, byte-exact                  PASS
approval -> agent commit      2 commands                               PASS
stale-approval error          names both hashes and the fix command    PASS
```

## What the pre-commit review caught

Eight findings, two of which were unrecoverable states in new code:

1. **Stale `content_hash` deadlock.** `recordCandidateConflictCheck` and
   `accept` rewrote `trap` without refreshing `content_hash`. A later `approve`
   bound to the stale hash, so every subsequent commit *and every re-approval*
   failed identically — with no way out short of hand-editing JSON. Approve now
   recomputes the hash, and both trap-rewriting paths refresh it.
2. **The §8.3 broken-link mapping never fired.** `MigrateCandidateOptions` was
   plumbed into `SessionStore` but no call site ever supplied it, so a legacy
   `accepted` record whose trap had been deleted migrated to `committed` instead
   of `staged` — and the first mutation persisted that lie. `SessionOperations`
   now wires the probe in its constructor.
3. **The content check blocked humans.** It ran before the executor guard, so a
   user could no longer edit-and-accept a candidate they had approved for an
   agent. Moved inside the agent branch.
4. **`--supersedes` was outside the authorization.** An agent approved to commit
   one lesson could retire any other trap — a write `rollback` then refuses to
   undo. Agent-executed supersedes are now refused outright.
5. **The forward guard missed `rawCandidateDocument`**, the path `migrate` and
   `doctor` use — so a v3 document would have been relabelled v2.
6. **Migration wrote outside the session lock**, racing concurrent captures and
   commits. Now locked, and it refreshes the index and recap.
7. **MCP `doctor` never reported migration status**, so an agent saw a project
   as healthy that the CLI flagged.
8. **The README still showed the old one-step agent commit**, which now throws.

## Risks carried into Phase 1C

1. **Downgrade is lossy in the other direction, by construction.** v1 cannot
   express `suppressed` vs `rejected`, or `rolled_back`, or an authorization.
   `migrate --down` now *reports* each loss before applying, but a
   v2 → v1 → v2 round trip does not restore those distinctions. The exit gate
   asks for v1 → v2 → v1, which is exact.
2. **The Web console can display an approval but not create one.** There is no
   `/api/candidate/approve` route, so a user working only in the console cannot
   authorize an agent-executed commit and must drop to the CLI. The console now
   labels approved candidates and warns that editing invalidates them, so the
   state is at least visible. The route belongs with the Inbox UI in 1E.
3. **`source_manifest_refs` and `rationale` are carried but never populated.**
   The envelope has the fields; nothing writes them until 1C's adapters produce
   candidates with real source manifests. They are schema, not capability.
4. **Phase 1A risks 1–7 are unchanged**, notably: candidate quality is still
   evidenced at n=1, suppression is still exact-match and project-scoped, and
   rollback still refuses supersede-accepts (1B added the restore query to its
   own risk list and did not build it — see risk 5).
5. **Restoring a superseded trap is still not possible.** 1A logged this as its
   risk 4 and 1B did not close it: `status` and `valid_until` remain outside
   `TRAP_UPDATE_FIELDS`, so rollback still refuses supersede-accepts and an
   agent is now refused the supersede path entirely. The restore query is small
   and would close both.
## Next highest-ROI task

**Phase 1C — dual-source adapters (§16).**

1B closed the envelope, so 1C can now produce candidates from both clients into
a schema that will not move under it. The §16 order is deliberate here: adding
producers before the envelope stabilized would have meant migrating their output
immediately.

Carry into 1C:

- `codetrap learn sources | evidence-pack | review | stage` against one adapter
  contract, Codex first, then Claude Code.
- Populate `source_agent`, `source_manifest_refs` and `rationale` — 1B reserved
  them precisely so the adapters have somewhere to put provenance.
- Phase 0 risk 2 finally becomes testable: cross-client overlap is uncomputed
  and §3.1 symmetry is still unproven in evidence.

Still unspent, still cheap, deferred twice now:

- Gitignore review artifacts at creation; `doctor` warning for a review
  directory tracked in a repo with a public remote (Phase 0 risk 6).
- Re-run mining with assistant reasoning and diffs included (Phase 0 risk 4).
  The envelope is frozen now, so this no longer blocks 1B — but it still decides
  whether the product's real store is codebase pitfalls or agent-operational
  memory, which is a positioning question worth answering before 1C builds two
  adapters aimed at the wrong target.
