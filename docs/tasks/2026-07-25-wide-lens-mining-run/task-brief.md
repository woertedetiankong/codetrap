# Task brief — Wide-lens mining run and genuine per-item review

Parent plan: `docs/agent-experience-compiler-roadmap.md` §16, §17
Predecessor: `docs/tasks/2026-07-25-extractor-blind-spot-experiment/`
Date opened: 2026-07-25
Status: **complete** — 1 of 5 approved; see `handoff.md`

## Goal

Answer the question Phase 0 set out to answer and could not: **do mined
candidates survive human scrutiny?**

Phase 0's answer was 100% by construction — all 16 clusters approved in bulk, so
the §17 falsifier was bypassed rather than fired or cleared. Phase 1A's was n=1.
With the extractor blind spot removed, a real mining run reviewed per item
produces the first number that means anything.

## Method

1. Mine this project's 30-day Claude Code history with the wide lens
   (`--include all`), which the blind-spot experiment showed is the only lens
   that can see codebase failures.
2. Draft candidates from the evidence, with every `evidence[].ref` resolving
   against the pack — the §9.3 gate refuses invented pointers.
3. Stage them, then have the user decide **each one individually**, with
   reasons recorded.
4. Report the approval rate and the rejection reasons, whichever way it falls.

## Honesty constraints

- The rejection *reasons* matter more than the rate. A rejection for "wrong
  carrier" says something different about the product than one for "false".
- A low rate is a valid result and must not be softened or re-run until it
  improves.
- n is small. Whatever the number, it is one review of one corpus.

## Out of scope

No Phase 2 work, no new destination kinds. This run ends in a number, a set of
reasons, and whatever extractor defects it exposes along the way.
