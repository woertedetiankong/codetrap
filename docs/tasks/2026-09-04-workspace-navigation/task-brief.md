# Workspace navigation and observation readiness

Created: 2026-09-04 (America/Los_Angeles)
Parent: [Roadmap](../../agent-experience-compiler-roadmap.md)
Status: Complete

## Outcome
Make Learning and Library reliable daily workspaces: addressable project/item selection, focused mobile reading, and accurate observation readiness.

## Acceptance
- Refresh, browser Back/Forward and cross-view evidence links restore the registered project and exact scoped item; unknown projects/items never silently open a different target.
- Routes use opaque, deterministic project references without embedding local filesystem paths. Existing view/Run/Review links still parse.
- Mobile list and detail have clear transitions, collapsed filters, and a single main scroll region. Drafts remain intact across navigation.
- Observation distinguishes missing configuration, configured clients awaiting a Run, recorded evidence, and unreadable state. Reads do not enable hooks or create telemetry.
- Source and bundled browser journeys, relevant API/route tests, full tests, typecheck and standalone build pass.

## Boundaries
Preserve both previous uncommitted stages. Do not accept the existing proposed bundling lesson, enable hooks, rewrite the frontend framework, install a binary, commit, or deploy.
