# Task Brief: Phase 3 Evidence Gate

> Created: 2026-08-08
> Parent plan: [Agent Experience Compiler roadmap](../../agent-experience-compiler-roadmap.md)
> Status: Done

## Goal

Determine which Phase 3 high-side-effect destination, if any, has enough
organic Phase 0-2 evidence to justify implementation without manufacturing
demand.

## Success Criteria

- Inventory organic candidate, review, suppression, and handoff evidence for
  `skill_candidate`, `custom_agent_candidate`, and `automation_idea`.
- Exclude implementation examples, tests, and roadmap prose from demand counts.
- Record a go, conditional-go, or no-go decision for each destination with
  traceable evidence and known weaknesses.
- Name the smallest justified Phase 3 implementation slice and any user
  decision required before a high-side-effect commit or install.

## Scope

In scope:

- Phase 0 accepted-candidate records and metrics.
- Phase 1 genuine review, Inbox, suppression, and cross-client evidence.
- Phase 2 runtime state and installed-skill overlap checks.
- Roadmap/dashboard, task index, handoff, and restart continuity.

Out of scope:

- Implementing or installing a skill, custom agent, or automation.
- Treating blanket Phase 0 approval as individual install authorization.
- Reading or modifying `question.txt` if the user's transient prompt file reappears.

## Constraints

- A destination needs organic evidence, not merely a roadmap entry.
- Phase 3 installation/enablement requires a fresh, candidate-specific user
  authorization and reversible audit receipt.
- Dual-client symmetry remains a product requirement.
- Do not push without explicit instruction.

## Expected Knowledge Updates

- Parent roadmap Phase 3 dashboard and gate note.
- `docs/tasks/INDEX.md` and `docs/tasks/NEXT-SESSION.md`.
- No wiki exists; do not create one.
