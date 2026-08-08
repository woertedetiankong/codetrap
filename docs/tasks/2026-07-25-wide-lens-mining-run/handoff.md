# Handoff — Wide-lens mining run and first genuine per-item review

## Headline: 1 of 5 candidates approved. The first honest candidate-quality number is 20%.

Phase 0's number was 100% by construction (blanket approval, §17 falsifier
bypassed). Phase 1A's was n=1. This run mined with the blind spot removed and
put every candidate through a real per-item decision.

```text
mined            5 candidates from 23 transcripts / 13.7 MB / 30-day window
approved         1  (20%)
rejected         4  (80%), all suppressed with reasons
review time      2s for 5 candidates      (§4.2 budget: 10 in < 5 min)
durable writes   1 trap, on explicit approval, committed by an agent
```

The one that survived — *sleep-polling is blocked; use a background task or
Monitor* — is a **harness lesson, not a codebase lesson**, and it committed to
global scope.

## What the rejections say

The user's stated reasons are the most useful output of this run:

| Candidate | Reason given |
|---|---|
| Edit fails on escape sequences | Trigger too narrow; unlikely to fire again |
| Embedding test is pre-existing | Memorialises a defect that should be fixed instead |
| No `node_modules/.bin/tsc` | Single occurrence; belongs in CLAUDE.md, not a trap |
| `src/db` vs `src/lib` layout | Single occurrence; ordinary codebase familiarity |

Two distinct failure modes, and neither is "the lesson is false":

1. **Insufficient recurrence.** Three of four were single-occurrence. Frequency
   is doing more work in a human's judgement than the quality score models —
   `quality_score` was 0.7 for all four rejects and 1.0 for the accept, but the
   real discriminator was "how many times did this actually happen".
2. **Wrong carrier.** Two were true and useful but belong in guidance or in a
   bug fix, not in trigger-matched recall. This is §11's destination ladder
   working as designed, and it means a trap-only Phase 1 will keep generating
   candidates it cannot place.

## Bearing on Phase 0 risk 3 (positioning)

Uncomfortable and worth stating plainly: **the extractor blind spot was real,
and removing it still did not produce an approved codebase lesson.**

The blind-spot experiment showed the evidence was there — 38 distinct failure
shapes against the narrow lens's 1, 84% of them naming this project's own
source. But when those failures were turned into candidates and judged, the
codebase-derived ones were rejected as one-offs, and the survivor was a harness
lesson.

That is **one data point at n=5**, not a refutation of §1.6. But it is the
second independent signal pointing the same way, and the first one's evidence
was withdrawn. The honest position: risk 3 is now *supported by weak evidence*
rather than *unsupported*, and it should be tested deliberately rather than
waited on.

The cheapest next test is a corpus of a different shape — this one is codetrap
developing itself, which is unusually tool-heavy work.

## Extractor fixes this run forced

Each was found by trying to use the pipeline for real, not by review:

1. **Evidence refs collided across transcripts.** Claude Code writes subagent
   transcripts as separate `agent-*.jsonl` files carrying the **parent's**
   `sessionId` — 15 files shared one id in this repo. `<sessionId>#<turn>`
   therefore resolved to several different excerpts (6 collisions in one pack),
   breaking the §9.3 deterministic verification that 1C and 1D are built on.
   Refs are now keyed on a per-file `transcript_id`; `TURN_NORMALIZER_VERSION`
   bumped to 2 so older refs are refused rather than mis-resolving.
2. **The per-session floor grouped by session id**, so one main session and its
   15 subagents shared a single floor — 23 transcripts collapsed to 5.
3. **The §4.2 pack budget was unenforced.** The wide lens produced 141 KB
   against an 80 KB budget. Packing is now budget-aware and reports what it
   dropped, per §4.2's "overflow is chunked and reported".
4. **Budget filling was positional.** Later sessions lost their evidence
   regardless of signal. Now: a floor per transcript, then value-ranked fill.
5. **Uniform sampling missed the lessons.** Phase 0's extractor *selected* for
   failure signals; uniform sampling of a budgeted pack yielded 5%
   failure-bearing content. Ranking by `lessonSignalScore` and keeping the top
   slice raised it to **34%**.
6. **A staged batch created one session per candidate**, so reviewing five
   meant walking five sessions. Batches now share one.

## An operational mistake, and what caught it

While re-staging I deleted `.codetrap/suppressions.json` to avoid the batch
being suppressed — destroying two real user decisions. It was unnecessary
(neither matched) and it was mine.

The append-only receipt log let me reconstruct both, with reasons and
timestamps intact. That is precisely what §3.2's audit metadata is for, and it
is the first time it has been needed.

**Recommendation:** ship `codetrap session suppressions --rebuild` so this
recovery is a command rather than a hand-written script. The data is already
there; the capability is not.

## Red lines honored (trust receipt)

```text
history read       read-only, explicit trigger, allowed roots, 74 redactions
transcripts copied 0 — pointers, hashes and <=500-char excerpts only
pack budget        81,919 of 81,920 bytes; 720 items dropped and reported
durable writes     1 trap (global #1), on explicit approval
suppressed         4 new, 6 total; 2 recovered from the receipt log
```

## Risks carried forward

1. **n=5.** One review, one corpus, one user, one unusually tool-heavy project.
   A 20% approval rate is a real number but not yet a stable one.
2. **The quality score does not model recurrence**, which is what the human
   actually judged on. All four rejects scored 0.7; the accept scored 1.0, but
   for reasons (tags, scope) unrelated to why it was approved.
3. **Phase 1 still generates candidates it cannot place.** Two rejects were true
   lessons with no Phase 1 destination. Until Phase 2 ships
   `project_convention` and `docs_guidance`, mining will keep producing them and
   users will keep rejecting them — which depresses the approval rate for a
   reason that is not about lesson quality.
## Next highest-ROI task

Phase 1 closed on 2026-08-08 after the missing Codex cross-client proof ran, and
the embedding reindex defect was fixed by the loopback proxy change. The next
evidence task is:

- Re-run this mining against a **different project's** history before drawing
  any positioning conclusion from the 20%. This corpus is codetrap building
  itself and is not representative.
- Then begin Phase 2's low-risk destinations from the roadmap acceptance gate.
