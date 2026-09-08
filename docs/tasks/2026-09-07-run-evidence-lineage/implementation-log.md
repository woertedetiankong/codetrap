# Implementation Log

> Created: 2026-09-07

## Task

Make observed tasks actionable through existing revision workflows.

## Log

### 2026-09-07

- Reuse the existing revision engine rather than introducing a pipeline executor. Source Run identity joins existing dossiers; later activity uses the engine's exact scope/ID/applied-version matching and existing 20-run bound.
- Present absent completion as awaiting completion, not running: a killed process can leave the same persisted state. Preserve the stored lifecycle and completeness values.
- Isolate corrupt revision dossiers per file and return an explicit availability warning; do not expose reasons, query text or frozen corpora in the Run projection.
- Browser build accepts client-prefixed modules only. Keep new renderer and text modules inside that boundary instead of relaxing the build guard.

### 2026-09-07 — Feedback-first refinement

- User feedback: the initial evidence section required too much reading. Replace the four-stage prose and visible metric grid with a short summary, up to three visible lesson cards and conditional revision progress. Keep technical evidence in a native disclosure with per-project/Run in-session expansion state.
- Offer one-click judgments only when a current title matches the observed version; historical versions use the inspect-first path. Never reuse a changed title to solicit feedback on an old exposure.
- Quick feedback uses existing explicit-user endpoints, disables concurrent row clicks and retains request IDs across uncertain failures. A successful save invokes the existing project-scoped refresh.
- Validate user-visible feedback save on an isolated fixture so product data does not gain synthetic ratings.
