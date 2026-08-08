# Task Brief: Phase 2 Low-Risk Destinations and Longitudinal Validation

> Created: 2026-08-08
> Parent plan: [Agent Experience Compiler roadmap](../../agent-experience-compiler-roadmap.md)
> Status: Done

## Goal

Complete the Phase 2 destination, study, currency, and longitudinal-feedback
loop without weakening Phase 1 authorization, reversibility, or compatibility.

## Success Criteria

- An authorized `project_convention` proposal lands equivalent approved patches
  in `AGENTS.md` and `CLAUDE.md`, records a receipt, and can be reverted.
- Authorized `docs_guidance` and `search_eval_case` proposals commit through the
  same review-bound contract and can be reverted.
- Insight-hinted legacy candidates migrate to a stable `insight` kind; at least
  one insight is shelved, browsed, and marked consulted.
- Committed lessons carry validation currency; stale lessons are down-ranked or
  excluded from default recall, and a graduated lesson visibly leaves recall in
  favor of a deterministic-check reference.
- Cross-client exact dedup, repeated suppression, authorization edit
  invalidation, useful recall, inbox growth, and retrieve-vs-curate outcomes are
  exposed as measurable Phase 2 metrics.
- Real acceptance evidence proves suppression prevents repeated noise, at least
  two lessons are useful in later work, one insight is consulted, and one stale
  or graduated lesson leaves default recall.
- The full test suite and release build pass on Windows.

## Scope

In scope:

- Candidate schema/authorization widening with backward-compatible migration.
- Low-risk file/fixture patch planning, preview, approval, apply, and revert.
- Insight shelf storage and study/consultation commands.
- Trap currency, validation, stale ranking/exclusion, and graduation.
- Phase 2 metrics and decision-rule reporting across CLI and JSON contracts.
- Targeted Web read visibility where existing review surfaces consume the same
  candidate payload; mutation parity remains CLI-first unless required by an
  acceptance gate.

Out of scope:

- Skill, custom-agent, or automation installation; those are Phase 3.
- Background transcript mining or automatic context injection.
- Claims of longitudinal product success beyond the measured local evidence.
- Modifying or committing the user's untracked `question.txt`.

## Constraints

- Durable writes require revision-bound user authorization and append-only
  receipts; an agent cannot self-authorize.
- Patch destinations may touch only explicit allowlisted files beneath the
  project root and must preserve byte-for-byte revert material.
- Existing v1/v2 candidate documents and Phase 1 CLI/Web behavior remain readable.
- Stale and graduated recall behavior must be observable and reversible; no
  lesson is silently deleted.
- Work stays on `phase2-low-risk-destinations`; do not push without user request.

## Expected Knowledge Updates

- Parent roadmap dashboard and Phase 2 status/evidence block.
- README command/workflow documentation.
- `docs/tasks/INDEX.md` and `docs/tasks/NEXT-SESSION.md`.
- No wiki exists; do not create one.
