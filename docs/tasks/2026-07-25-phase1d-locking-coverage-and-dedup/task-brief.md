# Task brief — Phase 1D: compiler hardening

Parent plan: `docs/agent-experience-compiler-roadmap.md` §16 Phase 1D
Predecessor: `docs/tasks/2026-07-25-phase1c-learning-review-cli-dual-source/`
Date opened: 2026-07-25
Status: **complete** — all three criteria met 2026-07-25; see `handoff.md`

## Goal

Make the compiler safe for two agents sharing one store, and make coverage
claims verifiable rather than asserted.

```text
two concurrent stages     -> no candidate lost, lock wait observable
an exact duplicate        -> consolidated, with both provenances kept
a semantic near-match     -> one review cluster, both candidates intact
an agent coverage claim   -> deterministically verified or flagged
a deleted review          -> excerpts gone, audit metadata kept
```

## Scope (§16 Phase 1D, unchanged)

- `.codetrap/learning/` locks and concurrent-write regression tests (§13.1).
- Agent-claimed, CLI-verified coverage and exact-vs-semantic duplicate rules
  from §9.3 and §13.4.
- Enforce allowed source roots, evidence budgets, retention/delete, and
  best-effort secret/redaction warnings.

### Explicitly out of scope

- No Inbox UI, no curated context-pack export (1E).
- No new destination kinds; no `insight` shelf (Phase 2).
- No runtime injection or currency mechanics (Phase 2/3).
- The CLI still does not judge semantic equivalence. §9.3 is explicit:
  "Deterministic verification gates; semantic judgment advises."

## Acceptance criteria (§16, unchanged)

1. Concurrent stages lose no candidates.
2. Exact duplicates consolidate provenance.
3. Semantic matches remain distinct inside one review cluster.

## Debts this phase inherits

| Debt | From | Why it lands here |
|---|---|---|
| Suppression index is an unlocked read-modify-write | 1A risk 5 | §13.1 is this phase |
| Coverage check (§9.3) unexercised for four phases | 1A/1B/1C | this phase owns it |
| Evidence refs are position-after-filtering and would drift | 1C risk 1 | I flagged it as 1D's |
| Cross-client overlap uncomputed | 0 risk 2 / 1C risk 4 | §13.4 is this phase |
| No retention/delete for review artifacts | §3.2 | listed in 1D scope |

## Design

### D1 — One lock helper, jitter, and an observable wait

`SessionStore.withLock` exists but is private, has no jitter, and reports
nothing. Extract it into a shared advisory-lock module with retry jitter, and
apply it to the learning store (suppressions, receipts) and review directories.
Every JSON payload for a locked mutation reports `lock_wait_ms` so contention is
visible rather than inferred (§13.1).

Dry-run paths take no lock, because they take no write.

### D2 — Coverage is claimed by the agent and verified by the CLI

`lesson-candidates.json` may carry a `coverage` block:

```json
"coverage": { "covered_by": ["trap:42"], "overlaps": ["AGENTS.md#testing"], "claim": "extends" }
```

Staging verifies every ref deterministically — trap ids resolve in a real scope,
file paths exist, section anchors appear in the file — and records
`coverage_verified` per ref. A failed claim **flags** the candidate; it does not
silently drop it (§9.3, §8.4).

### D3 — Exact duplicates consolidate; semantic ones cluster

- **Exact** = identical `content_hash` (the Phase 1B material-field hash). These
  consolidate: one candidate survives, and both provenances — `source_agent`,
  evidence refs, source manifest refs — merge onto it. This is the §13.4 rule
  "consolidates only identical revision hashes and preserves combined evidence",
  and it is what makes cross-client dedup work now that both adapters exist.
- **Semantic** = similar but not identical. These are grouped into a
  `review_cluster` and both candidates stay. The CLI never decides they are the
  same lesson.

### D4 — Evidence refs stop drifting

The manifest records the normalizer version that produced the turn indices. A
ref minted under a different normalizer is reported as unverifiable rather than
silently resolving to a different excerpt (1C risk 1).

### D5 — Retention and delete

`codetrap learn delete <review-id>` removes the excerpt-bearing artifacts and
leaves a tombstone carrying only non-sensitive audit metadata — review id,
source, counts, hashes, dates — because a committed trap's provenance must
survive the deletion of the review that produced it (§3.2).

## Plan

1. Shared lock module with jitter and wait reporting; apply to LearningStore.
2. Concurrent-stage and concurrent-capture regression tests (criterion 1).
3. Exact-duplicate consolidation with provenance merge (criterion 2).
4. Semantic clustering that keeps both candidates (criterion 3).
5. Coverage claim verification.
6. Normalizer version in the manifest; refs verified against it.
7. `learn delete` / retention, evidence budget enforcement, redaction warnings.

## Risk

The concurrency tests are the ones most likely to be written so they pass rather
than so they would fail. They must spawn real concurrent processes against a
shared store and assert on the union of results, not on a mocked lock.
