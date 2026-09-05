# Review state and draft protection

Created: 2026-09-04 (America/Los_Angeles).
Status: Complete, verified 2026-09-05 (America/Los_Angeles).
Parent: [Library handoff](../2026-09-04-library-state/handoff.md), [audit F8](../../reviews/2026-09-04-product-audit-status.md).
Baseline: user-authorized checkpoint commit `6d54a4e`; its 109 files contain all
preceding stages. The working tree was clean before starting this slice. No push.

Move Review session/candidate selection, request state, per-candidate in-tab drafts,
background refresh and candidate mutation coordination into strict browser modules.
Retain the existing destination-specific presentation templates as an explicit
legacy adapter; preserve their review/approval/rollback operations and receipts.
Bind responses and actions to the original project/session/candidate, restore draft
fields across navigation and locale/layout rerenders, and provide clear recovery.
Do not expand this into new destination lifecycles or a global workspace rewrite.

Validate fast navigation, stale successes/errors, local drafts, refresh, saves and
accept/approve/reject/rollback, cross-project same IDs, mobile history and all prior
flows. Run strict checks, asset/standalone delivery and complete sequential tests.
Keep genuine observation, confirmed memory and real project data unchanged.

Result: 608 tests across 87 files pass, including 11 new model/transport tests and
four new rendered Review tests. Project/browser strict checks, generated asset
freshness, npm packaging and rebuilt standalone/source delivery checks pass.
See the [complete handoff](handoff.md) for evidence, boundaries and the next slice.
