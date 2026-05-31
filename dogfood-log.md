# Dogfood Log

Raw observations from real codetrap use. Keep this lightweight: record every pre-edit search outcome here, then promote only representative cases into `src/tests/fixtures/search-eval.json`.

Judgments:

- `useful_hit`: A result prevented, changed, or confirmed the next action.
- `miss`: A relevant existing trap should have appeared but did not.
- `noisy_hit`: Results looked plausible but distracted from the task.
- `no_relevant_trap`: The memory bank had no applicable prior lesson.

## Template

```md
## YYYY-MM-DD - short task name

Task:
Query:
Mode:

Top results:
1.
2.
3.

Judgment:
Action changed:
Promote:
Note:
```

## Observations

## 2026-05-31 - Web locale toggle

Task: Add a Chinese/English language toggle to the web console.
Query: web language toggle chinese english i18n static ui text
Mode: hybrid

Top results:
1. No results returned.
2. No second result.
3. No third result.

Judgment: no_relevant_trap
Action changed: no
Promote: no
Note: Implement as browser-only UI localization in `src/web/static.ts`; do not translate stored trap content or change CLI/MCP contracts.

## 2026-05-31 - Web Library follow-ups

Task: Add Review-to-Library trap navigation, Library sorting, and a standalone Insights view.
Query: web review library view trap sorting insights
Mode: hybrid

Top results:
1. #2 Legacy home-scoped project trap - partially applicable reminder to keep frontend requests centralized through the existing web `api()` helper.
2. #3 Applicability filters must normalize absolute paths and empty scope fields - relevant warning not to duplicate or weaken module/owner filtering while adding Library sorting and Insights aggregation.
3. No third result.

Judgment: useful_hit
Action changed: yes
Promote: no
Note: Keep this iteration on top of the existing web API helper and returned trap JSON; defer backend search/pagination rather than adding a second filtering path.

## 2026-05-30 - Web Trap Library MVP

Task: Add a read-only web Trap Library view with filters, full trap details, and lightweight growth insight summaries.
Query: web trap library readonly list
Mode: hybrid

Top results:
1. #2 Legacy home-scoped project trap - partially applicable reminder to keep frontend requests centralized, though this repo uses the local `api()` helper rather than a named fetchWrapper.
2. #3 Applicability filters must normalize absolute paths and empty scope fields - relevant to `/api/traps` filter behavior and regression coverage for module/owner filters.
3. No third result.

Judgment: useful_hit
Action changed: yes
Promote: no
Note: The search confirmed that API tests should cover module/owner filters and that new browser calls should use the existing request helper.

## 2026-05-30 - CLI UX next-action hints

Task: Improve agent-facing UX hints for doctor, embed, and dogfood eval report without changing core search semantics.
Query: doctor embed search json dogfood report ux next_action diagnostics
Mode: hybrid

Top results:
1. #3 Applicability filters must normalize absolute paths and empty scope fields - not applicable to CLI output hints.
2. No second result.
3. No third result.

Judgment: noisy_hit
Action changed: no
Promote: no
Note: The result was search-policy related but did not apply to output guidance, so this stays as a raw dogfood observation.

## 2026-05-30 - dogfood eval judgment support

Task: Add no_relevant_trap support, improve unknown goldTrapIds guidance, and create this dogfood log.
Query: dogfood eval record goldTrapIds fixture judgment
Mode: hybrid

Top results:
1. No results returned.
2. A second concurrent check for related terms hit `database is locked`.
3. Not applicable.

Judgment: no_relevant_trap
Action changed: no
Promote: no
Note: Keep future pre-edit checks serial when using the same SQLite-backed store.

## 2026-05-30 - SQLite startup lock fix

Task: Fix `database is locked` when concurrent agent pre-edit searches open the same SQLite database.
Query: sqlite database locked concurrent search busy_timeout
Mode: hybrid

Top results:
1. #3 Applicability filters must normalize absolute paths and empty scope fields - not applicable to connection startup locking.
2. No second result.
3. No third result.

Judgment: noisy_hit
Action changed: no
Promote: no
Note: The result was search-related but the fix belongs in `src/db/connection.ts`, not applicability filtering.
