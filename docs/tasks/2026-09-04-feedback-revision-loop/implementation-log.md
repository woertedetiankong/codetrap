# Implementation log

## 2026-09-04 — Small reviewed revision path
- Existing candidate supersede cannot safely roll back its predecessor. This slice edits an active scoped lesson in place, retains its ID/provenance, and gives the new content a distinct revision. Before/after snapshots and the commit status share the target SQLite transaction.
- Keep user-authored rationale and queries in the source project's private dossier. Shared/global receipts carry only content snapshots, opaque project ownership, evidence identifiers and a digest; reads do not create the receipt table.
- Freeze both registered current-project and global active lessons with explicit index-to-identity mapping. Compare FTS inclusion/exclusion for the selected lesson, with explicit positive/negative expectations. This measures retrieval behavior only, with zero model calls.
- Use the existing Run as the entry point and Library for returning to revision history. Unknown historical scope or a demonstration Run does not receive real mutation controls.
- Preflight codetrap search returned no applicable confirmed lessons. Preserve the earlier pending bundling candidate.

## 2026-09-04 — Verified vertical slice
- Added real-event feedback and project-private revision operations, an allowlisted API, typed browser controller, scoped Library history, and bilingual responsive dialog. Source judgment is retained in the receipt.
- New targeted suite: 12 tests pass, including both-scope ID collisions, shared global conflicts, draft changes during evaluation, retirement/graduation, transaction rollback on receipt failure, counter-preserving rollback, API privacy and a bundled browser journey.
- Browser test simulates a successful feedback write whose response is lost; retry keeps its request ID and creates one judgment. Original text survives the request. Tested content changes disable acceptance until re-evaluation.
- Initial checks found new colors outside the existing token layer and one incorrect expected HTTP status in a test. Reused the existing semantic tokens and aligned the assertion with registered-project rejection (403); reruns pass.
- Full regression is running in sequential 15-file batches; standalone and final preview checks follow it. No real project feedback, confirmed lessons, hooks or existing memory candidates have been written.

## 2026-09-04 — Completion
- Final sequential regression: 574 tests in 78 files pass. Batch 5 initially hit the old cross-project browser wait; six isolated attempts passed, and the test now awaits the new scoped evidence response instead of accepting unchanged old DOM text. The affected full batch and final batch pass; retain the initial failure log.
- Final typecheck and 22 text/script/bundled-browser checks pass after distinguishing source/latest feedback and checking the Chinese mobile journey. Desktop/mobile screenshots inspected. Final standalone rebuilt; compiled Library history rendered without browser errors, and the source preview at 4748 was refreshed. Temporary compiled server stopped.
- Preserved the attached audit byte-for-byte and added a current progress table. Synced README, workflow/API/storage/recovery guide, roadmap, task index and handoff. Full frontend migration, legacy Eval storage migration and real outcome verification remain open.
- Confirmed the actual project has no experience-revision dossier directory. No real observation feedback or confirmed lesson was created by verification. Existing uncommitted work and the previous proposed memory candidate are preserved.
