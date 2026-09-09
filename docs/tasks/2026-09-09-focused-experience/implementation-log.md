# Decisions

### 2026-09-09 — Preserve ranked consumption across scope groups

Keep the grouped store contract and attach a one-based merged position. Cards
and observation receipts flatten through the same ordering helper. Semantic and
successful hybrid scores share a ranking scale; cross-corpus FTS and hybrid
fallback do not. Interleave each scope's local ranks in the latter cases, with
project first on ties and an explicit diagnostic. Keep native scores and scoped
IDs; do not silently manufacture cross-corpus confidence scores.

### 2026-09-09 — Reuse the handoff and existing evidence model

Add a memory-only mode to the existing handoff. Draft keys include entry mode
and project; Review/Library share a correction, Learning remains independent.
The browser prepares a copyable request and performs no capture or acceptance.
Keep loading, missing-link and filtered-empty states distinct from empty data.

Expose source evidence and applicability before the existing usage section.
Keep recorded exposure, feedback and task validation separate; do not infer
adoption or prevented mistakes. Reuse Run/revision links and the scoped archive
command instead of introducing another mutation API. Update Skill reporting
examples and the shared agent template to match those evidence boundaries.

### 2026-09-09 — Preserve browser assertions while budgeting CI startup and navigation

Remote commit `82c6cd0` passed Linux CI and both retrieval benchmarks. Windows
passed the new tests but timed out two existing workbench browser journeys at
their fixed 15/30-second test deadlines, before reporting an action failure.
Use the existing shared browser timeout/page configuration for that suite and
settle breakpoint rendering before interacting. Keep all assertions and local
deadlines; CI receives the same bounded workflow budget used by other browser
suites, with shorter per-action/navigation deadlines for actionable failures.
