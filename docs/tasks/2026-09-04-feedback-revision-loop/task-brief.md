# Feedback to reviewed experience revision

Created: 2026-09-04 (America/Los_Angeles)
Status: Complete — implementation and validation; real-task benefit remains unverified
Parent: [Product audit, stage B](../../reviews/2026-09-04-product-audit.md), [roadmap](../../agent-experience-compiler-roadmap.md)

## Outcome
From a real scoped Run event, record feedback, author a revision, test positive/negative queries against a frozen local corpus, explicitly accept it, and safely roll it back. Keep the originating evidence and subsequent version-specific activity inspectable.

## Acceptance
- Feedback targets an existing event's exact Run/scope/ID/revision; retries do not duplicate judgments.
- Private rationale, queries and frozen test corpus live in the originating project's local revision dossier. No model calls, raw prompt extraction, or checked-in fixture mutation.
- Preview includes original/proposed content and baseline/candidate FTS results; at least one positive and one negative case, all candidate checks passing, and unchanged content/base are required for acceptance.
- Accepted content and a minimal revision receipt commit atomically in the relevant project/global trap database. Rollback refuses later edits and preserves usage/evidence; restart/retry cannot duplicate a commit.
- Typed new view/controller boundary, accessible bilingual browser journey, mobile layout, API isolation/concurrency tests, bundled browser checks, all tests in sequential batches, typecheck and standalone verification.

## Boundaries
Preserve the preceding uncommitted stages. Do not enable real hooks, accept existing memory, execute user tasks/models, install, publish or commit. Existing candidate destinations remain intact. Full frontend-entry migration, legacy Eval-path migration, and broad longitudinal/causal analysis remain separate audit items.

Evidence: [handoff](handoff.md), [implementation log](implementation-log.md), [workflow and contracts](../../experience-revisions.md).
