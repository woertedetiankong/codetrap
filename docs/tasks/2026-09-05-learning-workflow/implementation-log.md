# Implementation decisions

## 2026-09-05 — Scope and identity

Preflight search via the project CLI found no applicable memory. The current
single proposal slot is cleared on article changes, while async preview replaces
its contents without preserving newer input. Practice notes already protect most
newer input during save; preserve that behavior and add the edge where the user
types the original saved value while a different value is still being saved.

Use raw, versioned drafts keyed by source project and Insight ID, not the workspace
filter or numeric position. Normalize only the submitted payload. A successful
preview validates the submitted version without rewriting visible tags/path text;
a newer version stays unvalidated. Writes capture identity and visible content,
are not automatically retried, and do not overwrite another article's draft.

Practice/status/feedback/Run mutation HTTP responses now include project_root
alongside existing fields so transport validation can reject same-ID wrong-project
responses. Shared domain types retain backend re-exports. Collection/filter
templates stay in the legacy workspace; this is a workflow slice, not complete
Learning renderer typing or durable autosave.

## 2026-09-05 — Async and DOM boundaries

The workflow now owns practice/proposal drafts and one captured operation. DOM
capture checks the form's bound source identity before reading named controls;
it reads disabled controls too, avoiding FormData omission. Rendering restores
focus, selection and scroll for the current item. Preview preserves raw fields
and marks only its submitted version as validated.

A pending practice save must preserve a newer edit even when that edit equals the
previously saved value. A list response predating a workflow revision is replaced
by a fresh read, preventing stale progress and a permanent loading state. Project
reset removes the old form immediately while session loading continues. Review
and Learning exchange busy notifications so actions unlock across view changes.
Learning history releases navigation before awaiting the list, and stale failures
do not replace the restored view. These are browser protections; backend storage
and cross-process concurrency semantics have not changed.

## 2026-09-05 — Verification and delivery

The complete regression passes **630 tests across 90 files in 18 sequential
processes**: 8 new model and 6 rendered Learning tests above the 616-test checkpoint.
Project and strict browser typechecks, generated-bundle freshness and whitespace
checks pass. The supported standalone build embeds the identical browser bundle;
the isolated delivery journey covers fresh authorization, practice/proposal drafts,
Library/Back, preview, explicit save, candidate creation and the resulting Review
fields, without accepting memory. The npm dry-run includes the new domain and
browser modules.

The actual source preview has zero Learning Insights across its registered
projects. The first delivery script incorrectly expected a populated practice
form; a second expected the desktop detail pane to remain visible on a phone.
Read-only DOM inspection confirmed valid empty states, with the phone showing the
list. Corrected the verification assertions to match those states; no product
code was changed in response. Full populated workflow verification uses disposable
fixture data. The final script and screenshots are recorded in the handoff.

README, installation, browser architecture, audit progress, parent roadmap and
current task index are reconciled. The original attached audit remains byte-for-byte
unchanged; the maintained search fixture remains 15 traps/24 queries and no real
project Eval suite was created. No new global memory or wiki was created.

## 2026-09-05 — User-requested checkpoint

The user requested a git commit before the next development stage. Browser artifact
freshness, both typechecks and whitespace checks were reverified; the 630-test
regression remains the unchanged runtime baseline. The local checkpoint includes
this dossier. No push is requested.
