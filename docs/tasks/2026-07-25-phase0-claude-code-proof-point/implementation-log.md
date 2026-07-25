# Implementation log — Phase 0 (Claude Code proof point)

Decisions affecting the product model, data model, or contracts. Per §19, this
is the only place implementation detail lives; the parent plan gets status and
links only.

## D1 — Codex dropped; Phase 0 is single-client

Measured before deciding: the authorized 30-day window contains 2 Codex session
files totalling 32 KB, against a §16 bar of >= 10 substantive sessions. Codex's
real corpus (232 files, 165 MB) predates the window by four months, and
`~/.codex/memories` is empty.

Offered the user three routes; they chose to drop Codex this round. Recorded as
a **failed** go-gate item rather than a waived one. §3.1 dual-client symmetry is
shipped in code but remains unproven in use, and nothing in this dossier may be
read as evidence for it.

## D2 — Mining machinery is throwaway, by design

§16 forbids `learn` subcommands before the gate closes. The extractor,
verifier, consolidator and renderer live in `evidence/*.py` as dossier
artifacts, **not** in `scripts/` and not in the CLI. They are reproducible
record, not product surface. If Phase 1C builds `codetrap learn evidence-pack`,
`extract.py` is a reference for the digest shape, not code to lift.

## D3 — Four lenses over one corpus, not one prompt

The §7.3 discovery prompt was split across four subagents (failures, human
turns, workflow/insight, plus the independent repeat run). Rationale: a single
pass over 105 KB tends to return the loudest signal only. Four blind lenses give
a convergence measurement that a single pass cannot — and that measurement
(11/16 clusters found by 2+ runs) turned out to be the strongest quality
evidence in the batch.

Every miner was explicitly told that returning 4 well-evidenced candidates beats
10 padded ones, and required to list rejections. They rejected 39 of 73 leads
(53.4%). Without that instruction the natural failure mode is filler that looks
like yield.

## D4 — Verification gates, similarity only advises

Implemented §9.3 literally. The miners *claimed* evidence; `verify.py` checked
every claim against the original transcript and would have failed the batch on a
fabricated pointer. 100/100 resolved.

Two initial failures were both verifier bugs, worth recording because they
generalize:

1. **JSON escaping** — comparing an excerpt against the raw JSONL line fails
   when the source contains escaped quotes. The compiler must compare against
   *decoded* message text.
2. **Annotation in a verbatim field** — one miner appended
   `[repeated in the same session at L1315 @ ...]` to an `excerpt`. Harmless
   here, but it means "verbatim" was not enforced, only requested.
   **Phase 1B action:** `evidence[].excerpt` must be schema-constrained to
   source-derived text, with commentary in a sibling field. An unenforced
   verbatim contract silently degrades into paraphrase, and paraphrased evidence
   is not evidence.

## D5 — Clusters group, they never merge

34 candidates → 16 clusters. Per §9.3/§13.4 no candidate was dropped or
rewritten: each cluster lists every member with its run provenance, and merge /
supersede / separate stays the user's call. The 52.9% collapse rate is
reported as a *dedup* measurement, not as a yield reduction.

Consequence for Phase 1D: dedup is not a nice-to-have. Four independent miners
over one corpus produced 34 cards for 16 lessons. At scale, an inbox without
clustering fails the §4.2 cap on its own duplicate traffic.

## D6 — Public repo forced an evidence-publication boundary

The mined corpus is the user's private, unrelated projects; this repository is
public (verified against the GitHub API, not assumed). Verbatim excerpts,
private paths and project internals are therefore gitignored and stay local;
only method and aggregates are committed.

This is a **product** finding, not just a housekeeping one. §3.2 already forbids
copying transcripts into codetrap, but it says nothing about the destination's
publication surface. A user who runs a learning review inside a public repo and
commits `.codetrap/learning/` would publish exactly what §3.2 was written to
protect.

**Proposed roadmap follow-up (not yet applied to the parent plan):** review
artifacts should be gitignored by default at creation, and `codetrap doctor`
should warn when a review directory is tracked by git in a repo with a public
remote. Cheap to build, and it closes a gap between the letter and the intent
of the red lines.

## D7 — The composition finding, and what it implies for Phase 1

Of 34 candidates: 9 are harness mechanics (26.5%), most of the rest are process
conventions, and **exactly one** is a lesson about the user's own source code.

Three readings, all worth stating because they lead to different Phase 1 work:

1. **The mining is fine; the corpus is honest.** Modern agent sessions on a
   working codebase genuinely do fail more often on tool mechanics than on
   domain logic. If so, codetrap's highest-value store is agent-operational
   memory, and the §11 destination ladder is roughly right.
2. **The signal is thin.** Codebase lessons may live in the *assistant's*
   reasoning and diffs, which this extractor deliberately discarded — it kept
   human turns and failure signals only. That is a fixable extractor gap, and
   the cheapest next experiment.
3. **It is a positioning question.** If most durable lessons are harness
   mechanics, they are largely *not project-specific*, which weakens the
   per-project trap store and strengthens a global one. §1.7's "two consumers"
   framing is affected: harness mechanics teach the agent, not the user.

This is not resolvable from Phase 0 data and must not be resolved by assumption
(§1.5). It is the sharpest question the proof point produced, and it belongs in
front of the user before any Phase 1B schema work.

## D8 — Corpus limitation the miners flagged unprompted

Roughly 45 of ~180 human turns in the primary corpus are bare attachment
pointers (`@question.txt`, `@1.png`) whose content is not in the transcript.
Every frequency count is therefore a **floor**, not the true rate.

Notably, the miners independently surfaced this as a *lesson* (cluster 2), which
is a small piece of evidence that the mining is not merely pattern-matching
error strings — it recognized a workflow convention from the shape of the
turns.
