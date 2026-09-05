# Learning durable draft recovery

Created: 2026-09-05 (America/Los_Angeles).
Status: Complete. See [handoff](handoff.md) for validation and remaining limits. Baseline: clean `main` at `ccc317b`.
Parent: [Learning workflow](../2026-09-05-learning-workflow/handoff.md),
[roadmap](../../agent-experience-compiler-roadmap.md).

Persist raw Learning practice/proposal drafts in this browser while editing, then
offer explicit restore/delete after reload or reopening an authorized page. Bind
recovery to the source project and Insight, preserve distinct concurrent-tab edits,
expire drafts after 30 days, and expose storage denial/quota/malformed-data failures.
Recovery does not submit data, restore validation/approval or replay writes. A
practice note changed on the server must be called out before restoration.

This slice covers Learning; Review and Evals draft persistence are separate work.
Storage is local to the browser profile and origin (including port), not server or
cloud sync. Keep all existing save/review semantics and in-tab recovery guarantees.
Use disposable data for mutations; preserve real candidates, confirmed memory,
observation configuration and evaluation fixtures. Commit `ccc317b` checkpoints the
prior stage. The user subsequently requested a local recovery-stage checkpoint;
no push is requested.

Validate storage contracts, model integration, reload/close/new-tab recovery,
concurrent tabs, save/delete cleanup, denied storage, expiry, reauthorization,
source identity, phone UI, full regression and standalone delivery. Reconcile
README, installation, browser architecture, audit progress, roadmap and task index.
