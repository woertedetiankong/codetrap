# Browser module entry and typed startup

Created: 2026-09-04 (America/Los_Angeles)
Status: Complete for browser module delivery and typed startup; per-feature business-state typing remains subsequent work.
Parent: [audit F8](../../reviews/2026-09-04-product-audit-status.md), [previous handoff](../2026-09-04-project-eval-storage/handoff.md).

Replace runtime source-string assembly and function serialization with a real
browser entry, ordinary module imports and a reproducible browser build embedded
in source/npm/standalone Web delivery. Type the startup preferences, auth/network
errors and bootstrap contract. Preserve existing routing, drafts, review receipts,
responsive layouts and all previous stage functionality.

The legacy workspace's business state is an explicitly named JavaScript boundary;
its full per-feature DTO migration is a subsequent slice. Do not pretend that
renaming untyped code or adding broad `any` annotations constitutes strict typing.
Existing typed controllers keep their types and receive actual dependencies.
No frontend framework, new dependency, model call, hook activation, confirmed
memory acceptance, commit or publishing is needed.

Validate generated-asset freshness, browser-only runtime graph, startup/auth error
behavior, existing desktop/mobile and draft/retry flows, full sequential tests,
typecheck and an isolated standalone Web run. Reconcile README/build instructions,
architecture guide, audit progress, roadmap, task index and restart handoff.

Results: 581 tests across 83 files passed in 13 sequential processes; project and
browser typechecks, asset freshness, npm package contents and standalone browser
delivery passed. See [handoff](handoff.md) for evidence and restart state.
