# Implementation Log

> Created: 2026-08-28

## Task

Add a complete local, governed loop for improving an existing resource-rich
Skill without replacing unrelated files.

## Assumptions

- "Complete" means the local evidence-to-candidate-to-install-to-outcome
  architecture is runnable without requiring a remote model or account.
- A model or agent may supply the structured principle and patch proposal, but
  Codetrap must deterministically enforce every mutation boundary.

## Initial Approach

- Add a backward-compatible patch variant to the Phase 3 destination payload,
  stage it through the existing candidate inbox, and reuse the existing
  revision-bound authorization, dual-target transaction, receipts, and rollback.

## Log

### 2026-08-28

- Chose file-operation patches bound to an exact base directory hash instead of
  storing a complete copy of every unchanged resource. This keeps candidates
  reviewable and makes "minimal change" enforceable.
- Existing Codex and Claude Skill directories must both exist and have identical
  hashes before an improvement candidate is created. Silent reconciliation would
  hide cross-client drift and make one approval authorize two different results.
- Legacy full-replacement candidates remain supported. New patch candidates
  preserve unrelated resources, while scripts remain inert data during static
  validation.
- Authorization scope now includes both before and after directory hashes as
  well as exact client paths. The store recomputes and compares that plan inside
  the Phase 3 lock, closing the preview-to-install drift window for both legacy
  replacements and new patches.
- Validation confirmed the new contract without changing live client homes:
  the focused Phase 3 suite passed 10 tests, the full suite passed 429 with one
  configured browser-smoke skip, typecheck and compiled builds passed, and the
  compiled CLI exposes `phase3 improve`. Journal validation reported 0 errors;
  its 4 warnings are known roadmap template placeholders and README resource
  labels, not new milestone prose.
