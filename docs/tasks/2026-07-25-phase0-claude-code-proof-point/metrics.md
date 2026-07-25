# Phase 0 metrics — Claude Code proof point

Measured 2026-07-25. Machine-measurable figures are final; user-decision
figures are **blank by design** until the review is done.

## Corpus (source manifest)

```text
client                       claude-code
window                       2026-06-25 .. 2026-07-25 (30d, as authorized)
project roots                8
files in window              95
substantive sessions >50KB   79      (§16 bar: >= 10 — PASS)
total source bytes           228,605,259  (228.6 MB)
human turns extracted        282
failure signals extracted    183
```

Failure signals by class — the recurrence backbone for the trap-shaped items:

```text
edit-before-read          59      read-file-too-large        7
command-exit-other        43      tool-input-validation      5
stale-read-before-edit    26      command-timeout-or-kill    4
edit-string-not-found     19      edit-string-ambiguous      3
other                     12      command-exit-2             3
                                  domain-fetch-blocked       1
                                  user-denied-tool           1
```

## Evidence packing (§4.2 budgets)

```text
raw transcripts            228,605,259 bytes
digests handed to miners       104,940 bytes      (2,178:1 compression)
excerpt cap                        500 chars/excerpt   (budget: <=500) PASS
evidence per candidate            <= 3 items           (budget: <=3)   PASS
packed evidence, 16-item batch  ~46,000 bytes          (budget: <=80KB) PASS
```

Note the distinction: the 105 KB of digests is *mining input*, not the evidence
pack attached to a review batch. The §4.2 80 KB budget governs the latter, and
the shipped batch is comfortably inside it.

## Privacy and red lines

```text
secrets redacted before any agent read the corpus   4  (all email addresses)
unredacted sensitive excerpts reaching staging      0
symlinks followed out of allowed roots              0
reads outside authorized roots                      0
```

**Trust receipt (§4.3):**

```text
staged: 0 candidates    suppressed: 0    (nothing is staged in Phase 0 by design)
durable writes: 0 — nothing was written to traps.db, guidance, skills,
agents, automations, or evals.
```

Verified independently: both trap stores (`~/.codetrap/traps.db`,
`Project-A/.codetrap/traps.db`) held **0 traps before this run and 0 after**.
This is a true cold-start, so every candidate's coverage is "no existing
coverage" — not a judgment the miners had to make.

## Candidate yield

```text
raw leads considered by miners     73
self-rejected by miners            39      (53.4% — the quality bar doing work)
candidates produced                34
review clusters presented          16
dedup collapse                     52.9%
```

Per run:

| Run | Corpus files | Candidates | Rejected |
|---|---|---|---|
| primary-failures | 61 | 10 | 11 |
| primary-human | 61 | 8 | 12 |
| primary-workflow | 61 | 8 | 7 |
| repeat-independent | 19 | 8 | 9 |

The repeat run produced 8 candidates from 19 files against the primary's 26
from 61 — yield did **not** collapse on an independent, smaller, unrelated
corpus. That is the single most encouraging number in this table.

## Convergence (substitute for cross-client overlap)

Cross-client overlap is **not computable** — only one client was mined. Two
documented substitutes:

```text
clusters found by >=2 independent mining runs   11 of 16   (68.8%)
clusters found by all 4 runs                     1 of 16   (the scratchpad
                                                            node_modules trap)
cross-project clusters (repeat run, all 3 projects)  2     (@question.txt as
                                                            real prompt;
                                                            plan doc is a
                                                            deliverable)
```

Four miners with different lenses, blind to each other, independently
surfaced the same lesson in 11 of 16 cases. This calibrates the §13.4 dedup
requirement: **dedup is not optional**. Without it this batch would have
presented 34 cards for 16 lessons.

## Composition — the finding that matters most

```text
candidate kind        pitfall_trap 24    unclassified 10
destination hint      trap 19   guidance 7   skill 4   insight 4
confidence            high 20   medium 14   low 0
harness mechanics     9 of 34 candidates (26.5%) / 5 of 16 clusters (31.3%)
grounded in the user's own source code   1 of 34 candidates
```

**Read that last line carefully.** Exactly one candidate (a React hook field
list duplicated between a destructure and a return literal, hit twice nine
hours apart) is a lesson about the user's *codebase*. Everything else is a
lesson about the *toolchain* (Read-before-Edit, blocked `sleep`, token caps,
Bash timeouts) or about the user's *process* (commit granularity, update the
plan doc, fix the whole list).

This is a real result, not a defect in the mining, and it is the most important
input to the Phase 1 decision — see `implementation-log.md`.

## Evidence traceability (§16 go-gate item)

```text
evidence pointers claimed        100
pointers verified against source 100
verification rate                100.0%
```

Every pointer was re-checked against the original JSONL: inside an allowed
root, line exists, timestamp matches, excerpt present at that line. Two
initially failed and both proved to be verifier bugs (JSON escaping; one agent
appended a bracketed annotation to a contractually verbatim field). The
annotation case is logged as a real schema-hygiene finding for Phase 1B.

## User decision — BLANKET APPROVAL (2026-07-25)

The user judged the analysis sufficient and approved all 16 clusters at once,
rather than adjudicating them individually.

```text
candidates approved                     34 / 34   (16 cluster cards)
direct approval        (A)              16 clusters / 34 candidates
edited approval        (E)              0
rejected               (R)              0
suppressed / skipped   (S)              0
useful approval (A+E) rate              100%      (see caveat below)
actual review time for the batch        n/a — not a per-item review
approved items naming a behavior change 30 / 34   (4 insight-shelf items
                                                   carry no action by design)
edit burden on approved items           0 edits requested
```

### What this number can and cannot be used for

**It cannot be used as the §16 go-gate measurement.** The gate exists to test
whether mined candidates survive independent human judgment. A blanket approval
is a decision to proceed, not a measurement of candidate quality — the 100% is
100% by construction, and it would be identical had the mining been worthless.
Reporting it as "useful approval >= 30%, gate passed" would be circular.

Recorded honestly, the position is:

```text
[PASS]     corpus is conclusive (79 substantive sessions >= 10)
[PASS]     0 unredacted sensitive excerpts
[PASS]     0 unauthorized durable writes
[PASS]     100% evidence traceability (100/100 pointers)
[PASS]     >= 20 candidates reviewed (34)
[UNTESTED] direct + edited approval >= 30% — approved in bulk, not adjudicated
[UNTESTED] median review time within budget — no per-item review occurred
[PENDING]  >= 1 lesson committed, later surfacing in another client, marked
           useful — this is Phase 1A's job and remains the real proof
[FAILED]   dual-client sampling — Codex not run (see task-brief.md)
```

So Phase 0 closes as a **single-client run whose candidate-quality gate was
waived by user decision, not met by measurement.** Two of the roadmap's
strongest claims therefore remain unproven: that mined candidates survive
scrutiny, and that dual-client symmetry works in practice.

The falsifier (§17) has not been fired *or* cleared — it was bypassed. If Phase
1A finds that committed lessons do not change agent behavior, this is the first
place to look, and re-running a genuine per-item review is the cheapest
corrective.

### What still carries real evidential weight

Independent of the approval decision, these hold:

```text
11 of 16 clusters found by >= 2 blind mining runs   (68.8% convergence)
39 of 73 raw leads self-rejected by the miners      (53.4%)
100/100 evidence pointers verified against source
repeat run on an unrelated corpus did not collapse  (8 candidates / 19 files)
```

These are measurements, not decisions, and they are the honest basis for
proceeding to Phase 1.
