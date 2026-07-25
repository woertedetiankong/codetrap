# Task brief — Extractor blind spot: is the 1-of-34 result an artifact?

Parent plan: `docs/agent-experience-compiler-roadmap.md` §1.5, §1.6, §1.7, §17
Predecessor: `docs/tasks/2026-07-25-phase1e-learning-inbox-and-runtime-proof/`
Date opened: 2026-07-25
Status: **complete** — risk 4 confirmed; see `handoff.md`

This is an **experiment**, not a feature slice. It exists to answer a question
that changes what gets built next.

## The question

Phase 0 mined 34 candidates and found that **only 1 was a lesson about the
user's own source code**. The rest were toolchain mechanics or process
conventions. Phase 0 recorded two competing explanations and could not
distinguish them:

- **Risk 3 (positioning):** the product's real store is agent-operational
  memory, not codebase pitfalls. §1.6 and §11's destination ladder are aimed
  slightly wrong.
- **Risk 4 (artifact):** the extractor kept human turns and failure signals and
  discarded assistant reasoning and diffs — plausibly where codebase lessons
  live. The result is a measurement artifact.

Six phases have now been built on the assumption that risk 3 is not true.
Phase 2 would add three more destinations on top of it.

## What discovery already shows

Measured on this session's own transcript (the largest available):

```text
content blocks the adapters KEEP:     text        165
content blocks the adapters DISCARD:  tool_use    397   (Bash, Write, Edit — the diffs)
                                      tool_result 397   (command output, errors)
                                      thinking    155   (assistant reasoning)
```

The adapters see **165 of 1114 blocks — about 15%**. Phase 0's risk 4 is not a
hypothesis about a small gap; it is a hypothesis about the 85% that was never
read. `file-history-delta` lines turn out to be backup pointers, not diff
content, so the edits themselves live in `tool_use`.

## Method

1. Add opt-in inclusion of reasoning and tool content to the adapters
   (`--include reasoning,tools`). Off by default: this content is far larger and
   far more likely to carry secrets, so §3.2 redaction and the §4.2 excerpt caps
   must apply to it exactly as they do today.
2. Mine the **same corpus twice** — once with the Phase 0 lens (text only), once
   with reasoning and tools included.
3. Classify every candidate from both runs on one axis:
   **codebase lesson** (about this project's own source, architecture or data
   model) vs **toolchain/process** (about the harness, the CLI, or how to work).
4. Compare the codebase-lesson fraction. Report the number honestly whichever
   way it falls.

## What each outcome means

| Result | Reading | Consequence |
|---|---|---|
| Codebase fraction rises materially with the wider lens | Risk 4 confirmed: the Phase 0 number was an artifact | Keep §1.6 positioning; make the wider lens the default for mining; Phase 2 proceeds as planned |
| Codebase fraction stays ~1/34 | Risk 3 confirmed: the corpus really is mostly agent-operational | §1.6, §11 and Phase 2's destination ladder need revisiting before more destinations are built |
| Mixed / unclear | The experiment did not settle it | Say so; do not launder ambiguity into a green light |

## Honesty constraints

- The classification is a judgement I am making, so the criteria go in writing
  **before** the counts, and every classified candidate is listed with its call
  so the reader can disagree.
- n is one user, one corpus, mostly one project. Whatever the number, it is
  evidence about *this* corpus, not about the product's market.
- The §17 falsifier language applies: a result that contradicts the roadmap is
  the valuable one, and must not be softened.

## Out of scope

No new candidate kinds, no destination changes, no Phase 2 work. This
experiment ends in a number and a recommendation, not a refactor.
