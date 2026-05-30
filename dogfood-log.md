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
