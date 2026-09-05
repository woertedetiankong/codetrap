# Implementation decisions

## 2026-09-05 — Persistence boundary

The user requested a checkpoint then continued development. The prior Learning
stage is committed as `ccc317b`; freshness and both typechecks passed. Preflight
search found no applicable result; semantic search was unavailable because the
configured model is not ready, so no completeness claim is made.

Learning is the first durable-draft slice. Use browser localStorage, scoped to
origin and source project/Insight, with explicit restore rather than automatically
replacing freshly loaded server state. Retain raw text only, never tokens, pending
operations, validation or approval. Practice snapshots carry their original saved
note for a changed-on-server notice. Proposal restoration always requires fresh
validation and existing review records remain visible.

Use immutable snapshot keys. Each tab replaces only its own previous snapshot;
restoring/deleting one snapshot cannot remove a different tab's newer key. A new
snapshot must be written before removing its predecessor, preserving the last
recoverable version on quota failure. Keep at most 100 snapshots, at most 64 KiB
of serialized text per snapshot, and expire supported valid snapshots after 30
days. Malformed/unsupported records are ignored with a notice, not trusted or
rewritten. No automatic eviction of another live draft to make room.

## 2026-09-05 — Recovery semantics and verification

Recovery never replaces an active draft of the same kind. A successful restore
writes a new owned snapshot before consuming the inspected immutable source key.
Browser storage events update choices only; editor text is untouched. A selected
snapshot removed by another writer invalidates selection and disables restore and
delete until another explicit choice, preventing an action from silently targeting
the next option. Option labels include a short text preview to distinguish versions.

An acknowledged practice save updates a newer draft's saved-note baseline. Status,
feedback and Run actions do not reset that original baseline, preserving the
changed-on-server notice. An uncertain create response keeps its proposal backup;
after reload, the existing review record is shown and no create request is replayed.
Restored proposals start unvalidated; explicit creation still uses the existing
backend validator. The normal preview button is available, not a new approval gate.

Full regression passes **648 tests across 92 files in 19 sequential processes**,
including 7 new store tests, 10 rendered recovery tests and 1 added baseline test.
Both typechecks, generated artifact freshness, npm manifest inclusion and whitespace
checks pass. Compiled delivery verifies reload recovery in disposable data, no
write replay or restored validation, explicit save/send and the resulting Review
fields. Desktop and Chinese phone screenshots were inspected. Actual source preview
verification covers its empty Learning shelf and does not create real content.

The original audit and maintained search fixture remain unchanged; no real project
Eval suite, candidate, confirmed memory, observation configuration or model run was
created. README, installation, browser architecture, audit progress, roadmap and
task index are rewritten to distinguish Learning browser backups from the remaining
Review/Evals in-tab drafts. No wiki or global memory was created.

## 2026-09-05 — User-requested recovery checkpoint

The user requested a local git commit. Browser artifact freshness, both typechecks
and whitespace checks passed again; runtime code remains the 648-test baseline.
The checkpoint includes this dossier and the synchronized current-state pointers.
No remote push or further development was requested in this turn.
