# Implementation log — Phase 1D

Decisions affecting the product model, data model, Web review, or CLI/MCP
contract (§19.3). Ceremony evidence lives in `handoff.md`.

## Decisions

### D1 — One advisory lock, reentrant, with an ownership token

`SessionStore.withLock` was private, jitter-free, and reported nothing. It is
now `src/lib/advisory-lock.ts`, shared with the learning store, and hardened in
four ways the review forced:

- **Ownership token.** Two processes can both judge a lock stale and both remove
  it; without a token the second `rmSync` deletes the *live* lock the first just
  created, and both enter the critical section. Release now only removes a lock
  this process still owns.
- **`mkdir` errors other than `EEXIST` rethrow.** The first version treated every
  failure as contention, so `EACCES` on a read-only mount produced an unbounded
  hot loop that never timed out and never reported the cause.
- **Stale (5s) is now shorter than the acquire timeout (10s).** With stale >
  timeout a waiter dies before it can ever reclaim an abandoned lock, so every
  command in the window after a crash failed and told the user to hand-delete a
  directory.
- **Reentrant.** A `mkdir` lock is not reentrant, so a locked method calling
  another locked method would block on itself until the timeout. Depth counting
  makes the nested acquisition a no-op.

### D2 — Session auto-creation is atomic

`captureCandidate` read the active session outside the lock and then called
`startSession`. Two concurrent captures both saw "none", both tried to create,
and the loser died with "already active" — losing its candidate. `getOrStartSession`
does both under one lock.

The concurrency test found this before the fix existed, which is the reason it
spawns real processes rather than mocking the lock.

### D3 — Consolidation is exact-hash only, and never onto a closed or committed decision

§13.4 consolidates identical revision hashes and preserves combined evidence.
Two exclusions matter:

- **Rejected/suppressed candidates.** Merging onto one would route a re-mined
  lesson around the suppression index and quietly revive something the user
  declined. Found by an existing 1C test failing.
- **Committed candidates.** Merging evidence onto one leaves the candidate and
  its durable trap permanently disagreeing, because the trap row is untouched —
  and updating the trap is an authorized write (§3.2), not a staging side
  effect. These are reported as `already_committed` with a pointer to
  `add_trap_evidence`, never modified.

### D4 — Clusters are two-sided and keyed by content hash

The first version labelled only the newly staged candidate, so a reviewer
opening the older one saw no neighbour — a "single review cluster" with one
labelled member. Both sides now carry `review_cluster` and `similar_to`.

The cluster id was also derived from candidate ids, which are unique only
*within* a session: ids collided across sessions and changed depending on which
member was staged first. It is now derived from content hashes alone.

### D5 — Check and write share one lock

`learn stage --apply` read the candidate corpus unlocked and then wrote under a
separate acquisition. Two concurrent stages of the same lesson both saw "no
duplicate" and both created one — defeating the §13.4 guarantee in exactly the
multi-agent scenario §13.1 exists for. The whole apply loop now runs inside one
`withCandidateCorpus` lock, with the in-memory corpus kept current so a duplicate
*within* one batch is caught too.

### D6 — Coverage refs are session-qualified

Candidate ids are per-session, so a bare `cand-001` exists in almost every
session and verified as true against a project-wide set — the deterministic check
rubber-stamping a dangling reference. A qualified `<session-id>/cand-001` is
checked exactly; a bare one is accepted only when precisely one session has it,
and reported as ambiguous otherwise.

### D7 — Retention keeps hashes, not content

`learn delete` removes the excerpt-bearing artifacts and writes a tombstone with
counts, roots, dates and file SHA-256s. A trap committed from that review still
resolves its provenance; the user's actual conversation content does not survive.

The review id is validated first: it becomes a path segment and deletion is
recursive, so `learn delete ../..` would have removed the entire `.codetrap`
directory, `traps.db` included.

### D8 — Evidence refs cannot drift silently

The manifest and evidence pack record `normalizer_version`. Staging refuses a
pack built under a different one, because turn indices are assigned after noise
filtering and a changed filter would make every later ref resolve to a different
excerpt (1C risk 1, closed).

## Contract changes

```text
codetrap learn delete <review-id> [--json]
codetrap learn reviews            # now reports deleted reviews as such
```

`learn stage` output gains `consolidated`, `already_committed`,
`coverage_flagged`, `review_cluster` / `similar_to` per staged entry, and
`lock_wait_ms`.

`CandidateTrap` gains `contributing_sources`, `review_cluster`, `similar_to`,
`coverage` — all optional and additive, so the Web console is unaffected.

## Out of scope, deliberately

No Inbox UI or context-pack export (1E). No new destination kinds, no insight
shelf (Phase 2). No runtime injection or currency mechanics (Phase 2/3).

## Test and typecheck state

`src/tests/learning-concurrency.test.ts` — 7 tests spawning real concurrent
processes: eight simultaneous captures, six simultaneous rejects, four
simultaneous stages, plus lock release-on-throw, timeout, and stale reclaim.

`src/tests/candidate-dedup.test.ts` — 12 tests: cross-client consolidation,
semantic clustering on both sides, rejected/committed exclusions, coverage
verification including path-escape and ambiguity, retention, normalizer drift,
and the delete traversal guard.

Full suite: 335 pass, 1 fail — the pre-existing `embedding reindex API` failure
that reproduces on a clean `HEAD` worktree. `bunx tsc --noEmit` clean.
