# Handoff — Extractor blind spot experiment

## Result: Phase 0 risk 4 is CONFIRMED. The 1-of-34 number was substantially an artifact.

The Phase 0 extractor could not see the evidence that carries codebase lessons.
Measured over the same corpus with the same code, changing only what the reader
is allowed to look at:

```text
                              turns read   failure signatures   distinct failure shapes
narrow lens (Phase 0's)          198              1                        1
wide lens (+reasoning +tools)   1298             93                       38
```

Of the 38 distinct failure shapes the wide lens sees, **32 (84%) are specific to
this project's own source** — TypeScript errors naming our types, test failures
naming our own behavior. The narrow lens found **zero**.

The single failure shape the narrow lens did see was **node module resolution** —
which is Phase 0's cluster C01, the one lesson that became trap #2. The Phase 0
extractor was effectively looking at one class of failure, and that is exactly
the one lesson that survived to be committed.

## Why the blind spot was so large

The adapters kept only `text` content blocks. Measured on this session's own
transcript:

```text
kept      text          165 blocks
discarded tool_use      397   (Bash, Write, Edit — where the diffs are)
          tool_result   397   (command output, compiler errors, test failures)
          thinking      155   (assistant reasoning)
```

**15% of the content was visible.** Phase 0's risk 4 was not a hypothesis about
a small gap; it was a hypothesis about the 85% that was never read.

## A second artifact found on the way

Evidence packs were built with `turns.slice(0, 40)` — the **first** 40 turns of
each session. On a 700-turn session that is the opening 6%, where the user states
the task and nothing has gone wrong yet. Every pack was biased toward intentions
and away from the failures, edits and corrections that occur later — precisely
the material a lesson is made of.

This was found because the first experiment run showed zero `[Edit]` and
`[Write]` markers even with the wide lens: the cap was truncating before any
editing happened. Sampling now spreads evenly across the session.

This bug affected Phase 0 too, and compounds with the lens blind spot: the
narrow lens saw 15% of the content, and only from the opening of each session.

## What this does and does not establish

**Establishes:** the corpus contains far more codebase-specific failure evidence
than Phase 0 could see. Any conclusion about what kind of lessons this corpus
holds, drawn from the Phase 0 extractor, is unsafe.

**Does not establish:** that 32 durable codebase lessons exist. The measure is
*lesson-bearing evidence availability*, not validated lessons. Many tsc errors
are transient self-inflicted slips fixed within seconds and are not durable
lessons at all. Turning this evidence into candidates is the mining step, and
turning candidates into lessons is the human review step — neither was run here.

**Scope:** 6 sessions, one project, one user, and the work in them was
TypeScript-and-tests development of codetrap itself. A corpus of, say, infra or
data work would look different.

## Consequences for the roadmap

- **Phase 0 risk 4: resolved, confirmed.** The extractor blind spot was real and
  large.
- **Phase 0 risk 3 (positioning): NOT confirmed, and its evidence is withdrawn.**
  The "only 1 of 34 candidates is about the user's own source code" finding
  cannot support a positioning conclusion, because the extractor that produced it
  was blind to codebase evidence. §1.6 and §11's destination ladder are **not**
  invalidated — but they are no longer supported by that number either. The
  question is now genuinely open rather than answered in the wrong direction.
- **Phase 2 is unblocked**, with a caveat: it was going to build three more
  destinations on the assumption that codebase pitfalls are rare in real
  corpora. That assumption should not be carried forward untested.

## Shipped alongside

- `--include reasoning,tools,all` on `codetrap learn review`, off by default.
  The default stays narrow because the wide lens is ~5x the volume and produced
  **64 redactions versus 6** on the same corpus — an order of magnitude more
  secret material passing through, exactly the §3.2 surface the flag widens.
  Redaction and the 500-character excerpt cap apply to it unchanged, and the
  lens used is recorded in the review's `scope` so a pack's provenance says what
  it could have contained.
- Even sampling across sessions instead of head-truncation.
- Codex's adapter also admits `reasoning`, `function_call` and
  `function_call_output` items under the wide lens, since Codex records those as
  sibling response items rather than as content blocks.

## Risks and honest caveats

1. **The wide lens is a privacy escalation.** 10x the redactions on the same
   corpus means 10x the secret material being handled. It stays opt-in, and the
   §4.2 evidence-pack budget (80 KB per 10-candidate batch) is **exceeded** by
   the wide lens at 141 KB for 6 sessions. That budget needs revisiting or
   chunking before the wide lens becomes routine.
2. **The classification is mine.** Criteria were written before counting and are
   in the brief, and the raw shapes are listed above, but a reader who disagrees
   with "a tsc error naming our own type is a codebase signal" would get a
   different number.
3. **`useful_count` is still the only real outcome measure**, and it has one
   sample. This experiment says the *input* to mining was impoverished; it says
   nothing about whether the output changes behavior.
## Next highest-ROI task

**Re-run Phase 0's mining with the wide lens and a genuine per-item review.**

That is the experiment this one makes possible, and it answers the question
Phase 0 actually set out to answer: *do mined candidates survive human
scrutiny?* Phase 0's answer was 100%-by-construction (blanket approval); Phase
1A's was n=1. With the blind spot removed, a real mining run over a real window,
reviewed per item, would produce the first honest candidate-quality number the
project has.

Only after that should Phase 2 freeze three more destinations.

Still outstanding and unchanged: **close Phase 1E criterion 1** — put `codetrap`
on `PATH` and run the pre-flight search from a Codex session. Ten minutes, and
Phase 1 closes.
