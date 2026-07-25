# Handoff — Phase 0 (Claude Code proof point)

## Capability layer completed

Phase 0 of the parent plan (§16) — the empirical test of the §1.5 riskiest
assumption, run before any schema or Inbox architecture, as the roadmap
requires.

- Read-only mining pipeline over Claude Code transcripts: 228.6 MB / 95 files /
  79 substantive sessions → 105 KB of secret-redacted digests.
- Four blind mining lenses producing 34 candidates from 73 raw leads.
- Deterministic evidence verification (§9.3): 100/100 claimed pointers resolved
  against the original transcripts.
- Semantic grouping into 16 review clusters with no silent merges (§13.4).
- Human review surface, approved in bulk by the user on 2026-07-25.

No product code shipped, by design. The mining scripts live in `evidence/` as
reproducible record, not in `scripts/` and not in the CLI.

## Red lines honored (trust receipt)

```text
staged: 0 candidates    suppressed: 0
durable writes: 0 — nothing written to traps.db, guidance, skills, agents,
automations, or evals.
```

Verified independently: both trap stores held 0 traps before and after.
Reads stayed inside explicitly authorized roots; symlinks were not followed;
4 email addresses were redacted before any agent saw the corpus; 0 unredacted
sensitive excerpts reached staging. Learning review ran only on explicit user
trigger, with scope confirmed in-session before any history was read.

## Source manifest and evidence traceability

`evidence/source-manifest.json` records every file read with bytes, SHA-256,
line count, session id, cwd, branch and first/last timestamp.
Evidence traceability: **100%** (100/100 pointers verified).

## Coverage check status

True cold start — both trap stores were empty, so every candidate's coverage is
"no existing coverage". Coverage verification was therefore trivially satisfied
and did **not** exercise the §9.3 machinery. That machinery remains untested and
is Phase 1D's responsibility.

## Measured UX budgets

```text
excerpt cap            <= 500 chars/excerpt      PASS
evidence per candidate <= 3 items                PASS
packed evidence        ~46 KB per 16-item batch  PASS (budget <= 80 KB)
review time            not measured — blanket approval, no per-item review
```

## Risks carried into Phase 1 — do not let these disappear

1. **The candidate-quality gate was waived, not met.** All 16 clusters were
   approved in bulk. The 100% approval rate is 100% by construction and cannot
   support "mined candidates survive human scrutiny". The §17 falsifier was
   bypassed rather than fired or cleared. If Phase 1A shows committed lessons
   not changing behavior, re-run a genuine per-item review first.
2. **Dual-client symmetry is unproven in use.** Codex was not mined (2 sessions
   in window against a bar of 10). §3.1 is shipped in code, untested in
   evidence. Cross-client overlap is uncomputed.
3. **Only 1 of 34 candidates is a lesson about the user's own source code.**
   The rest are toolchain mechanics or process conventions. This may mean the
   product's real store is agent-operational memory rather than codebase
   pitfalls — a positioning question (§1.6, §1.7), not a bug. Unresolved.
4. **Extractor blind spot.** Digests kept human turns and failure signals only,
   discarding assistant reasoning and diffs — plausibly where codebase lessons
   live. This is the cheapest experiment available and may well overturn risk 3.
5. **`evidence[].excerpt` verbatim-ness is requested, not enforced.** One miner
   appended commentary to a verbatim field. Phase 1B must schema-constrain it;
   an unenforced verbatim contract decays into paraphrase, and paraphrased
   evidence is not evidence.
6. **Publication surface is unguarded.** §3.2 forbids copying transcripts into
   codetrap but says nothing about where the review artifacts then live. A user
   running a review inside a public repo and committing `.codetrap/learning/`
   would publish exactly what §3.2 protects. Mitigated here by hand.

## Next highest-ROI task

**Phase 1A — existing-surface vertical proof (§16).**

Push one approved `pitfall_trap` from `accepted-candidates.md` end-to-end
through the surfaces that already exist — no new ontology, no pull adapters:

```text
agent-submitted candidate
  -> existing session candidate surface
  -> Web review
  -> user authorizes
  -> agent executes the commit on that instruction
  -> trap is searchable
  -> trap is reversible
  -> one suppressed lesson does not reappear from the same evidence
```

Acceptance (unchanged from §16): one real candidate approved, committed by an
agent on explicit user instruction, searchable afterward, reversible; one
suppressed lesson does not reappear.

Recommended first candidate: cluster 1 (scratchpad Node scripts cannot resolve
project `node_modules`) — highest evidence weight in the batch, found by all
four blind runs, unambiguous trigger and action, low misuse risk.

Because risk 1 above means candidate quality is unverified, Phase 1A should be
treated as *also* re-testing it: if the committed trap never fires usefully in
subsequent work, that is the falsifier arriving late.

Two cheap items worth doing alongside, both already justified by evidence:

- Gitignore review artifacts at creation, and have `doctor` warn when a review
  directory is tracked in a repo with a public remote (risk 6).
- Re-run mining with assistant reasoning and diffs included, to test risk 4
  before Phase 1B freezes the envelope.
