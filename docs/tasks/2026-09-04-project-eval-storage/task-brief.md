# Project-local evaluation suites

Created: 2026-09-04 (America/Los_Angeles)
Status: Complete; corpus replacement/upload and real-task benefit remain outside this slice.
Parent: [audit F5](../../reviews/2026-09-04-product-audit-status.md), [previous handoff](../2026-09-04-feedback-revision-loop/handoff.md).

Deliver a usable evaluation workflow in ordinary registered projects: preview and create a private corpus from confirmed lessons or copy an existing legacy fixture, author/preview/confirm manual examples, run existing comparisons, and export a portable suite. Keep scoped live IDs separate from fixture positions. New local suites take precedence; legacy reads and already-bound review/rollback records remain compatible. Never silently replace corpus identity, remap old IDs, migrate on GET, or overwrite the source fixture during import/export.

Validation: empty/legacy/corrupt states, cross-scope collisions, content-bound creation and case acceptance, retry and later-edit protection, old draft/commit rollback after migration, portable export, existing comparisons and browser journey in an isolated ordinary project. Typecheck, full sequential regression, bundled browser and standalone checks. No model calls, real feedback fabrication, hook activation, memory acceptance or publishing.

Result: 584 tests in 81 files passed, plus typecheck, final text/browser checks and the standalone Web preview. See [handoff](handoff.md) for verification evidence and restart state.
