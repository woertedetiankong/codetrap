# Task Brief: Existing Skill Improvement Loop

> Created: 2026-08-28
> Parent plan: [Agent Experience Compiler Roadmap](../../agent-experience-compiler-roadmap.md)
> Status: Complete

## Goal

Extend the governed Phase 3 lifecycle from whole-skill replacement to a complete
local loop for evidence-backed, minimal, resource-preserving improvements of an
existing Skill.

## Success Criteria

- A structured local improvement interface can target an existing Skill shared
  by explicit Codex and Claude homes and stage a normal `skill_candidate`.
- The candidate binds to the exact current directory hash and carries explicit
  file operations instead of copying unchanged resources into the candidate.
- Patch operations can add or replace text resources, add binary resources from
  bounded base64, replace text exactly once, append text, and explicitly delete
  a file without allowing path traversal or symlink traversal.
- Preview remains read-only and reports added, modified, deleted, and unchanged
  files plus before/after directory hashes.
- Install refuses client drift, stale approval, wrong paths, an invalid final
  Skill, or any base change after preview; partial failure restores both clients.
- Existing references, examples, scripts, assets, binary files, and empty
  directories survive unless the reviewed patch explicitly changes them.
- Legacy full-artifact candidates continue to preview, install, and roll back.
- Static validation, targeted tests, typecheck, build, and the full suite pass.

## Scope

In scope:

- Phase 3 patch proposal schema and `phase3 improve` CLI command.
- Exact-base target discovery across explicit Codex and Claude homes.
- Deterministic patch application and final-artifact validation.
- Resource-level change summaries, authorization binding, install, and rollback.
- Integration documentation, roadmap state, task index, and restart handoff.

Out of scope:

- Calling an external or hosted LLM from Codetrap.
- Authenticating to GitHub or another remote feedback source.
- Background scheduling, unattended approval, or automatic installation.
- Executing candidate-supplied scripts during validation.
- Publishing, releasing, global installation, committing, or pushing.

## Constraints

- Preserve the existing Feedback Improver and pending `cand-001` without
  rewriting their state.
- Keep old Phase 3 replacement candidates compatible.
- Treat a model or agent as the proposer of a structured principle and patch;
  deterministic Codetrap code owns path safety, base checks, validation,
  approval, receipts, installation, and rollback.
- Require identical existing Skill baselines in both client homes for an
  improvement candidate; do not guess how to reconcile divergent clients.
- Candidate scripts are data only and are never executed by this workflow.

## Expected Knowledge Updates

- Rewrite the Phase 3 and Feedback Improver integration guidance in `README.md`.
- Update the parent roadmap dashboard, task index, latest handoff, and
  `NEXT-SESSION.md`.
- Task index: update required because this changes the Phase 3 store, operations,
  CLI, tests, and the Improver-to-Skill product contract.
- Project wiki: not required; no hand-maintained wiki exists.
