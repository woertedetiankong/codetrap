# Handoff — Phase 1D (compiler hardening)

## Capability layer completed

The compiler is now safe for two agents sharing one store, and coverage claims
are verified rather than asserted.

```text
concurrent writes   -> per-resource advisory lock, jitter, lock_wait_ms reported
exact duplicate     -> consolidated, both provenances kept
semantic near-match -> one review cluster, both candidates intact, both labelled
coverage claim      -> trap ids, paths and anchors verified, or flagged
deleted review      -> excerpts gone, audit metadata kept
```

## Red lines honored (trust receipt)

```text
durable trap writes from any learn subcommand: 0
dry-run paths taking a lock:                   0
candidates lost across 8 concurrent captures:  0
suppressions lost across 6 concurrent rejects: 0
rejected/committed candidates modified by staging: 0
arbitrary paths deletable via learn delete:    0 (guarded and tested)
```

## Acceptance criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Concurrent stages lose no candidates | met | 8 concurrent captures, 6 concurrent rejects, 4 concurrent stages — all present in the union |
| 2 | Exact duplicates consolidate provenance | met | same lesson from Codex and Claude Code becomes one candidate with `contributing_sources: [claude-code, codex]` and merged evidence |
| 3 | Semantic matches remain distinct inside one review cluster | met | near-match stays a separate candidate; both members carry the same `review_cluster` and each other in `similar_to` |

The concurrency test earned its place: it failed on first run and exposed a real
race in session auto-creation that the lock alone did not fix.

## Debts closed

| Debt | From | Closed by |
|---|---|---|
| Suppression index unlocked read-modify-write | 1A risk 5 | D1 |
| Coverage check unexercised for four phases | 1A/1B/1C | D6 + `coverage-verify.ts` |
| Evidence refs would drift if the noise filter changed | 1C risk 1 | D8 |
| Cross-client overlap uncomputed | 0 risk 2 / 1C risk 4 | D3 |
| No retention/delete for review artifacts | §3.2 | D7 |

## What the pre-commit review caught

Two reviewers, twelve findings acted on. The three that mattered most:

1. **`codetrap learn delete ../..` would have `rm -rf`'d `.codetrap`** — traps.db,
   sessions, receipts and suppressions. The review id became a path segment and
   deletion is recursive, with no validation anywhere in the chain.
2. **The lock could be held by two processes at once.** Two waiters could both
   judge a lock stale and both remove it, the second deleting the live lock the
   first had just taken. Fixed with an ownership token.
3. **`mkdir` failures other than EEXIST spun forever.** A read-only or
   permission-restricted `.codetrap` produced an unbounded hot loop that never
   timed out and never surfaced the error.

Also fixed: stale-timeout inversion; a non-reentrant lock that would deadlock on
nested acquisition; `captureCandidate`'s cleanup deleting a session other
processes had already written into; the check-then-write TOCTOU that defeated
criterion 2 under concurrency; cluster ids derived from session-local candidate
ids; one-sided clusters; evidence duplicated on re-running a review; bare
candidate coverage refs verifying against any session; and consolidation onto a
committed candidate silently desyncing it from its trap.

## Measured UX budgets

```text
8 concurrent captures      all landed, no retry visible to the user   PASS
lock wait reported         lock_wait_ms on locked JSON payloads       PASS
learn delete               one command, tombstone shown               PASS
coverage verification      per-ref detail, flagged not dropped        PASS
```

## Risks carried into Phase 1E

1. **The lock is advisory and never refreshed.** A critical section that outlives
   the 5s stale window can still have its lock reclaimed. The window is now
   larger than any observed operation, and the ownership token means the
   original holder no longer deletes someone else's lock on the way out — but a
   long stall (laptop sleep, a very large candidate document on a network share)
   remains theoretically reachable. A heartbeat would close it.
2. **Similarity is lexical, not semantic.** `findSemanticMatches` uses token
   Jaccard over title/body/tags. It will miss two lessons that say the same
   thing in different words, which is precisely the case a human would call a
   duplicate. §9.3 permits this — the CLI only advises — but the recall is
   unmeasured and there is no eval fixture for it.
3. **Consolidation is exact-hash, so trivial rewording defeats it.** The Phase 1B
   content hash normalizes whitespace and case only. Two adapters producing the
   same lesson with one different word produce two candidates, clustered but not
   merged.
4. **`already_committed` has no follow-through.** Staging reports that a lesson
   is already a trap and points at `add_trap_evidence`, but nothing carries the
   new client's provenance onto the trap automatically — correctly, since that is
   an authorized write, but it means §13.4's "committed-trap evidence records
   every client history" is only true if the user acts on the hint.
5. **Phase 0 risk 4 is still open, and is now the oldest unpaid debt.** Both
   adapters still discard tool output and assistant reasoning. Five phases have
   been built on the unverified assumption that this does not matter.
6. **Codex history remains thin for this user** (2 sessions in 30 days, 0 for
   this repo), so cross-client consolidation is proven in fixtures and not in use.
7. **The pre-existing `embedding reindex API` test failure remains**, reproduced
   on a clean `HEAD` worktree.

## Next highest-ROI task

**Phase 1E — Learning Inbox and runtime proof (§16).**

This is the last Phase 1 slice, and its acceptance is the first end-to-end
behavioral claim the product makes: a user reviews within budget, authorizes an
agent-executed commit, and the trap later surfaces in a pre-flight search *from
the other client* and is marked useful.

Carry into 1E:

- Inbox list/card with approve, edit, reject, skip, authorize, commit, rollback,
  trust receipts, and the §4.2 UX budgets measured rather than asserted.
- A `/api/candidate/approve` route — 1B's approval is still CLI-only, so a
  console-only user cannot authorize an agent-executed commit (1B risk 2).
- Render the 1D additions the console cannot currently show: `review_cluster`,
  `similar_to`, `coverage`, `contributing_sources`.
- Curated context-pack export (§10, §12.1).

Before 1E's runtime claim, the honest thing is to settle **Phase 0 risk 4**. The
adapters make it a flag now. If the product's real store turns out to be
agent-operational memory rather than codebase pitfalls, 1E's "surfaces in a
pre-flight search and is marked useful" gate is measuring the wrong thing, and
that is much cheaper to learn before building the Inbox than after.
