# Implementation log

## 2026-09-04 — Explicit links before a graph engine
- Use existing Learning promotion records and the candidate’s accepted_scope/accepted_trap_id as provenance. Candidate draft scope is not a substitute for an accepted identity.
- Keep the personal practice note in Learning progress; it does not become shared content, a candidate draft, or telemetry.
- Build an accessible source/experience/exposure/feedback path and paginated evidence list instead of adding a canvas graph library. Only explicit scoped references participate; full revision strings stay private, while current-versus-different revision counts are safe to show.
- Evidence and learning sources fail independently. Usage queries select only the requested scoped trap and fetch Run metadata for the current page.

## 2026-09-04 — Integration and verification
- New `GET /api/trap/experience` validates exact identity and pagination before querying; both endpoints retain Web token and registered-project checks. `POST /api/learning/practice-note` stores only local personal progress, with lazy legacy defaults.
- A typed projection/presentation module holds the experience path; a small serialized browser adapter preserves the standalone packaging contract.
- Browser checks cover origin-project navigation, accepted scope, retained drafts during saves, recoverable evidence outages, and rejection of delayed responses from a previous selection.
- API tests caught an omitted offset default and permissive integer parsing. The new route now defaults offset explicitly and validates numbers without truncation.
- Mobile browser testing exposed a Grid header shrinking below its content while bounds-only checks still passed. Its intrinsic height and three explicit content rows now keep the tools clickable in Library as well as Overview.
- Verification fixtures remain in temporary project/home directories. No user learning content, confirmed trap or observation settings are changed by these checks.

## 2026-09-04 — Standalone release check
- The executable's page opened but the experience panel stayed loading: Bun renamed the presentation function to `experiencePathContent2`, while its browser adapter still referenced `experiencePathContent`. An explicit serialized binding fixes the contract.
- The cross-project browser regression now runs on bundled HTML, covering function-name rewriting and the full personal-practice/evidence journey. Actual standalone output was also opened against the real project and returned the unconfigured state correctly.
- Updated an obsolete onboarding text assertion and removed a variable-spelling assertion; request origin/scope is now covered through real browser behavior.
- One intermediate full run exited 137 while other validation work was running; it is not counted as passing evidence. Final full-suite verification runs separately.
- Recorded the durable serialization pitfall as proposed `cand-001` in session `2026-09-05-capture-bind-serialized-browser-functions-by-an-explicit-stable`. The CLI uses that generated session ID; this journal uses the machine's local date (2026-09-04, America/Los_Angeles).

## Final validation
- Full suite: 555 passed, 0 failed, across 75 files (33.91 seconds); 2,996 assertions. Typecheck and diff whitespace checks pass.
- Source and bundled browser journeys pass. Standalone build/help and a real compiled Web Library page were verified.
- README, parent roadmap, task brief, task index/current-session pointer and handoff now match the delivered scope. Follow-ups and evidence limits remain explicit.
