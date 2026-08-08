# Handoff — Phase 1A (existing-surface vertical proof)

## Capability layer completed

The §16 Phase 1A loop, driven end to end through surfaces that already existed.
One approved lesson went in, a searchable and reversible trap came out, and a
declined lesson stayed declined across a re-run from the same evidence.

```text
agent-submitted pitfall_trap candidate   -> session capture
  -> existing session candidate surface  -> candidate-traps.json, quality 1.00
  -> user authorizes                     -> per-item review, 2026-07-25
  -> agent executes the commit           -> session accept --executor agent
  -> searchable                          -> codetrap search returns trap #2
  -> reversible                          -> session rollback exercised, not claimed
  -> suppressed lesson stays suppressed  -> C16 refused on re-capture
```

Shipped: an append-only authorization receipt log, a project-level suppression
index that outlives its session, and `session rollback` as the true inverse of
accept. Criterion 3 needed no code — search already found committed traps.

## Red lines honored (trust receipt)

```text
committed:  1 trap   (#2, project scope, from cluster C01)
suppressed: 1 lesson (C16)
rolled back: 1       (trap #1, deleted; store returned to pre-accept state)
global store: 0 traps before and after — untouched
durable writes outside .codetrap/: 0
```

Every durable action left a receipt. The full log, `codetrap session receipts`:

```text
2026-07-25T08:30:43.509Z suppress by agent   C16   scope: cluster C16 only, declined 2026-07-25
2026-07-25T08:30:33.058Z commit   by agent   C01   scope: Phase 0 cluster C01 only, approved 2026-07-25   -> trap #2
2026-07-25T08:30:32.605Z rollback by agent   C01   scope: rollback of cluster C01 to prove reversibility   -> trap #1
2026-07-25T08:30:32.145Z commit   by agent   C01   scope: Phase 0 cluster C01 only, approved 2026-07-25   -> trap #1
```

The ceremony was re-run end to end after the pre-commit review fixes, so this
log is the output of the code that actually ships.

Authorization was the user's, per item, on the candidate content shown in full.
Execution was the agent's on that instruction — the §3.2 split the brief flagged
as most likely to be wrong. `executor` is recorded as a **declared** claim; the
receipt surface says so in as many words, because §3.2 forbids implying codetrap
can tell a human from a same-account agent.

## Acceptance criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Real candidate approved by user | met | C01 reviewed per item and approved as written, 2026-07-25 |
| 2 | Committed by an agent on explicit user instruction | met | `session accept --executor agent`; receipt records both |
| 3 | Findable via `codetrap search` | met (pre-existing) | search returned trap #2 |
| 4 | Reversible, rollback exercised | met | trap #1 deleted, search emptied, store emptied, candidate returned to `proposed` at quality 1.00, then re-committed |
| 5 | Suppressed lesson does not reappear | met | C16 re-captured from identical evidence → refused, no session created, no inbox entry |
| 6 | Receipt records authorization scope and executor | met | four receipts above |

## Source manifest and evidence traceability

Inherited from Phase 0 unchanged; this slice added no new mining. Both committed
and suppressed lessons carry `source_ref` back to their Phase 0 clusters
(`phase0:C01`, `phase0:C16`), which resolve into
`../2026-07-25-phase0-claude-code-proof-point/accepted-candidates.md`.

## Coverage check status

Still untested, and still Phase 1D's. The store was empty when C01 was
committed, so coverage was trivially satisfied for the second consecutive phase.
The §9.3 machinery has now gone two phases without exercise — 1D should not
assume it works.

## Measured UX budgets

```text
per-item review time      one candidate, reviewed on its merits    PASS (vs Phase 0's blanket approval)
candidate quality score   C01 = 1.00, C16 = 0.80                   PASS
commit -> search latency  same command sequence, no reindex step   PASS
rollback completeness     store back to pre-accept state           PASS (except supersede-accepts, risk 4)
```

The Phase 0 gap — "review time not measured — blanket approval, no per-item
review" — is closed for this one candidate. One item is not a rate.

## Risks carried into Phase 1B

1. **Candidate quality is now weakly, not strongly, evidenced.** C01 scored 1.00
   and survived a real per-item review, which is better than Phase 0's 100%-by-
   construction. But n=1. Phase 0 risk 1 is reduced, not cleared. The §17
   falsifier is still live: **if trap #2 never usefully fires in later work here,
   strengthen mining and re-run a genuine per-item review rather than building
   1B architecture on top of it.**
2. **Suppression is exact-match only.** The fingerprint is a normalized hash of
   title/context/mistake/fix/scope. A reworded re-mining of the same lesson
   produces a different fingerprint and will reappear. Semantic dedup is §13.4 /
   Phase 1D; until then "does not reappear from the same evidence" is literally
   scoped to *the same evidence*.
3. **Suppression is project-scoped.** `.codetrap/suppressions.json` lives in the
   project. A `global`-scope lesson suppressed in one project is not suppressed
   in another. Fine for 1A; 1B should decide whether suppression follows trap
   scope.
4. **Rollback refuses a commit that superseded another trap.** `accept
   --supersedes N` retires trap N, and no query can un-retire it (`status` and
   `valid_until` are not updatable). Rather than delete the successor and lose
   both lessons, rollback refuses and names the manual path. This is a real hole
   in "reversible" — **1B should add the restore query** and lift the refusal.
5. **The suppression index is an unlocked read-modify-write.** Two concurrent
   rejects can lose one suppression while both receipts claim success. Locks are
   explicitly Phase 1D's (§13.1), so this is deferred rather than missed, but it
   is a correctness gap in the meantime and 1D should cover it with the same
   concurrent-write regression tests it already owes.
6. **Rollback's two steps are not atomic.** The trap is deleted before the
   candidate document is restored. If the second step fails the candidate is
   left `accepted` against a deleted trap — which re-running rollback repairs,
   since it tolerates a missing trap — but no receipt is written for the delete
   that did happen.
7. **Rejecting an edited candidate suppresses the edited wording.** The
   fingerprint comes from the candidate as stored, so if a reviewer edits a
   candidate in the Web console and then rejects it, a re-mining of the original
   text produces a different fingerprint and returns to the inbox.
8. **The receipt has no revision, only a content hash.** §3.2 wants authorization
   bound to a candidate revision, invalidated on material edit. 1A records
   `fingerprint`, which changes when material fields change but is not compared
   against the authorized value at commit time. **1B must close this**: it is the
   difference between recording an authorization and enforcing one.
9. **Phase 0 risks 2–6 are untouched.** Dual-client symmetry is still unproven in
   evidence, the 1-of-34 codebase-lesson result is still unexplained, and the
   `evidence[].excerpt` verbatim contract is still unenforced.
## Next highest-ROI task

**Phase 1B — stable envelope and compatibility (§16).**

Risk 8 above is the reason to go there next rather than to 1C: authorization is
currently recorded but not enforced, and every phase built on top of an
unenforced authorization inherits the gap. 1B already owns revision/hash and the
"material edits invalidate authorization" acceptance criterion — it should treat
the 1A receipt as the thing it must now bind to.

Carry into 1B, in order:

- Bind authorization to a candidate revision and invalidate it on material edit;
  compare the authorized fingerprint at commit time rather than only recording it.
- Add `revision`/`content_hash` and the three-axis state migration, keeping the
  1A `rejected` + suppression-index shape readable (D1 in the implementation log
  deliberately avoided adding a fourth status for 1B to migrate).
- Add the restore-superseded-trap query so rollback stops refusing (risk 4).
- Decide whether suppression follows trap scope (risk 3).

Still unspent and still cheap, both deferred by user decision in this slice:

- Gitignore review artifacts at creation; have `doctor` warn when a review
  directory is tracked in a repo with a public remote (Phase 0 risk 6).
- Re-run mining with assistant reasoning and diffs included, to test whether the
  1-of-34 codebase-lesson result is an extractor artifact (Phase 0 risk 4).
  Worth doing **before** 1B freezes the envelope.
