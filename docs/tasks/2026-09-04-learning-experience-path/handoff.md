---
title: Learning to experience evidence
status: Complete
updated: 2026-09-04
---

# Handoff

## Result
The personal growth workflow now connects a private practice note, an explicitly accepted Agent lesson, and the lesson's observed task evidence. Learning opens the actual accepted scope/ID and original project; Library returns to the Learning source or opens the relevant Run.

## Implementation and contracts
- `src/lib/learning-impact.ts`: nullable, length-limited `practice_note` in local progress; lazy defaults for legacy records; accepted scope in promotion state; explicit accepted provenance lookup. Saving a note changes no shared Insight, candidate, or observation event.
- `src/lib/trap-experience.ts` and `src/lib/observation-ledger.ts`: exact project/scope/ID selection, current-versus-other version exposures, corrected current ratings, scoped miss reports, and 20-Run pages. Run metadata is fetched only for that page. The projection still reads all matching events for accurate totals; pagination does not bound total ledger projection cost.
- `src/web/experience-view.ts`: independent availability for Learning sources and telemetry. Missing observation stays unconfigured; corrupt evidence cannot hide healthy confirmed content.
- `GET /api/trap/experience?project=...&scope=project|global&id=...&offset=0`: token-authenticated, registered-project-only, explicit safe-integer identity and offset. No raw queries, commands, note text, or full revision strings in this payload.
- `POST /api/learning/practice-note`: `{ projectRoot, id, practiceNote }`, string up to 1,000 UTF-16 code units or null. Empty/whitespace text clears. Returns updated Learning Impact state. Existing personal progress locking and actor ownership remain in effect.
- `src/web/client-experience.ts`: typed presentation component with four explicit stages, source links, evidence rows and pagination. Its serialized function expression has an explicit stable binding because bundlers can rename function declarations.
- `src/web/client-experience-actions.ts`: origin-bound navigation, isolated loading/retry, request generation guards, and per-Insight draft preservation during asynchronous saves. Notes must be saved before tab reload/close; unsaved drafts are only in browser memory.
- The mobile header uses intrinsic content height, so Library no longer overlays language/refresh tools. Technical Library fields are collapsible; practice notes and experience evidence use the existing theme and bilingual UI.

## Evidence boundaries
- Sources and activity are from the selected project, including for a global lesson. This is not an aggregate across registered projects.
- Sources require explicit accepted promotion scope/ID. Draft scope and unqualified historical references are not inferred.
- The current version is an equality check against the stored trap revision. Other versions are not assumed to be older.
- Ratings are current per Run and scoped trap, across revisions. Full feedback history remains in the Run. A scoped `should_have_matched` judgment remains a separate signal; unscoped missed reports cannot be attributed safely here.
- A presented lesson does not establish adoption. Run-level validation is context, not proof of this lesson's effect. No feedback automatically updates confirmed memory.
- Learning/Library item selection still uses the existing in-tab state; their hash routes identify the view, not a persistent item deep link. Run links retain their existing route.

## Validation
- `bun test src/tests`: **555 passed, 0 failed**, 75 files, 2,996 assertions, 33.91 seconds. This final run includes the bundled browser workflow.
- `bun run typecheck`: passed. `git diff --check`: clean.
- Standalone CLI built successfully; help ran and the compiled browser interface loaded real project Library content and its unconfigured observation state.
- Desktop and 390px phone layouts were checked in the browser. English/Chinese controls remain clickable and the evidence path uses two columns on phones.
- Artifacts: `/Users/superstorm/.codex/visualizations/2026/09/05/01a06f12-717a-7352-9e52-ea6e306e4141/experience-desktop.png`, `practice-desktop.png`, and `verification/learning-experience-full.log`.
- Temporary fixture and compiled-preview servers were stopped; the source preview remains on port 4748.

## Working state and restart
Both this slice and the preceding Impact foundation are uncommitted on `main`, based on `8b1c065`. Preserve both. No commit, push, deployment, binary installation, or observation enablement was performed. Temporary project/home fixtures contain the synthetic walkthrough data; they are not user telemetry. The source preview is on localhost port 4748.

```bash
git status --short
bun run typecheck
bun test src/tests/learning-impact.test.ts src/tests/trap-experience.test.ts src/tests/web-browser-smoke.test.ts src/tests/web-client-text.test.ts src/tests/web-client-script.test.ts
```
The browser workflow uses Chrome; that part skips if Chrome is unavailable. It exercises bundled HTML plus source APIs, including cross-project navigation, drafts typed during save, evidence outages/retry, and stale response rejection. The separate standalone executable was also opened against the actual project.

## Implementation memory and docs
[Task brief](task-brief.md), [implementation log](implementation-log.md), [task index](../INDEX.md), README and the [roadmap](../../agent-experience-compiler-roadmap.md) describe the implemented workflow and its boundaries. No separate wiki is needed. The post-flight bundling lesson is a proposed candidate `cand-001` in session `2026-09-05-capture-bind-serialized-browser-functions-by-an-explicit-stable`; it has not been accepted into confirmed memory.

## Next useful slices
1. Make Learning and Library selections refresh/back-linkable with explicit project and scoped item identity.
2. Reduce mobile Library filter density and nested scrolling; validate the whole search-to-detail journey.
3. Build longitudinal experience review from explicit version/change/outcome links, then consider richer graph visualization. Do not infer adoption or causality.
4. Profile matching-event projection cost with large real ledgers before adding indexes or cached summaries.

## Restart opener
Read this handoff and the task index. Verify the working tree, then continue the next user-selected slice. Preserve private practice notes, explicit acceptance, unknown evidence states, scoped identity and standalone bundling behavior.
