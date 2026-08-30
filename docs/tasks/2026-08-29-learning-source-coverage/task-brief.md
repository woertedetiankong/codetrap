# Task Brief: Learning Source Coverage

> Created: 2026-08-29
> Parent plan: [Agent Experience Compiler roadmap](../../agent-experience-compiler-roadmap.md)
> Status: Complete

## Goal

Make source omissions visible and mechanically reviewable when articles or AI
conversations become ordered learning collections. Preserve substantive source
background at collection level without turning it into an artificial study
chapter or an alarming skipped item.

## Success Criteria

- New multi-Insight extractions carry a shared source-unit manifest and each
  Insight identifies the units it teaches.
- Deterministic staging rejects malformed manifests, duplicate/gapped chapter
  positions, unexplained skips, inconsistent collection metadata, and source
  units that silently disappear from a proposed batch.
- Partial collections remain usable but are labeled incomplete; fully accounted
  full-source, sampled, curated, and legacy states remain visibly distinct.
- Candidate review and Learning show coverage and unresolved source units before
  and after durable writes.
- Legacy shelves without metadata remain readable and honestly unaudited.
- Substantive background can live in collection context sections, count toward
  coverage, and remain visible without inflating chapter counts.
- Collapsed cards prioritize study progress and reduce source accounting to a
  plain-language secondary status.
- External-article and AI-conversation Skills use an inventory-and-account
  workflow, and focused plus full regression gates pass.
- Existing collection positions cannot collide, and a single Insight write
  cannot replace an audited collection's manifest or source context.
- Web save, approval, and apply routes enforce the same Insight coverage
  contract as the CLI.

## Scope

In scope:

- Backward-compatible source-coverage types, normalization, validation, and
  derived collection status.
- Collection-level source context sections and source-unit refs.
- Learning-review batch validation and Phase 2 Insight payload validation.
- Candidate-review and Learning-catalog coverage presentation.
- Bundled Skill/discovery-prompt guidance, tests, and current documentation.

Out of scope:

- Claiming that a model can discover every possible interpretation of a source.
- Blocking users from saving a useful partial collection.
- Automatic web crawling inside the Codetrap CLI.
- Cross-source paths, quizzes, spaced repetition, or mastery scoring.
- Commit, push, release, package-version changes, or global installation.

## Constraints

- “Complete” means every substantive declared source unit has a durable
  destination in a chapter or collection context. Page chrome is outside the
  source inventory; intentional editorial skips remain possible but are not the
  default for a no-omission collection.
- Keep source coverage separate from existing duplicate/overlap `coverage`.
- Preserve revision-bound authorization, exact Phase 2 rollback, project
  isolation, idempotent learned state, and unrelated working-tree changes.
- Use additive optional fields so legacy version 1/2 shelves need no eager
  migration.

## Expected Knowledge Updates

- Rewrite the README and installation learning workflow.
- Update the parent roadmap status dashboard and task index.
- Refresh `docs/tasks/NEXT-SESSION.md` and the complete handoff.
- No wiki update is required because no hand-maintained project wiki exists.
