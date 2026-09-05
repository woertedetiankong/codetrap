# Five-stage product optimization

Created: 2026-09-05 (America/Los_Angeles).
Status: Complete; Git checkpoint: `feat: complete five-stage product polish`. Baseline: clean `main` at `f763195`, 648 tests.
Final regression: 662 tests across 95 files; see [handoff](handoff.md).
Parent: [roadmap](../../agent-experience-compiler-roadmap.md),
[audit status](../../reviews/2026-09-04-product-audit-status.md),
[Learning draft recovery](../2026-09-05-learning-draft-recovery/handoff.md).

Complete the five stages explicitly requested by the user:

1. Review and Evals durable drafts, binding restoration to candidate version and
   evaluation context. Never restore approval, consent, preview or pending actions.
2. Typed ownership and guarded asynchronous reads/actions for remaining Learning,
   Review and Impact business state. Keep navigation, errors and retry consistent.
3. Plain-language guidance and empty states. Learning alone is a complete product
   path; practice and promotion to Agent experience are optional, separate actions.
4. Measure growing-history reads/refresh, optimize evidenced bottlenecks and keep
   equivalent outputs, project boundaries, ordering and cache invalidation.
5. Validate on actual development work: record retrieval, actual adoption and test
   results separately. Report missing evidence and causal limits honestly.

Use this real development task for stage 5 where existing confirmed lessons apply.
The user now authorizes actual-task validation, superseding the prior UI-only
verification scope. Do not manufacture favorable feedback or accept pending memory.
No external model experiment, automatic hook activation, commit, push or deployment
is implied. Preserve the original audit and maintainer evaluation corpus. Functional
and performance fixtures use disposable data, labelled separately from real work.

Each stage gets targeted tests and dated evidence in the implementation log;
finish with full regression, build/strict browser checks, packaged delivery and
rendered desktop/phone verification. Keep README, installation, browser architecture,
audit status, roadmap and task index current. Handoff must report all five outcomes.
