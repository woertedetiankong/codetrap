# Implementation decisions

## 2026-09-04 — State ownership and transport boundary

The existing detail loader reports failure only in a global status bar while its
reader stays in loading state. A single loading key also permits duplicate A/B/A
requests. List failures escape without a scoped error transition. Move Library
state and rendering together, invalidate pending work by project/list generations,
and use per-item detail states. Keep Learning practice state for its own future slice.

Share pure experience DTOs between server and browser without importing a server
implementation through the DOM-only type graph. Decode Library responses as unknown
before installing state; preserve independent unavailable source/observation statuses.

## 2026-09-04 — Verified state and rendered recovery

Nine deterministic transport/model tests passed, including project A/B/A races,
scoped ID collisions, per-item request deduplication, stale failures and pagination.
Two new rendered tests passed malformed-list, detail-404 and experience-503 recovery
in the Chinese phone reader, and desktop filter races/history. All five existing
browser smoke journeys also passed. Root and DOM-only typechecks remain strict.

## 2026-09-04 — Slow history navigation regression

The first complete run passed 592 tests. A further rendered test reproduced a
separate routing defect: Back remained blocked until a superseded Library list
request completed (4-second timeout, retained before-fix log). Library now starts
its self-contained load without holding the workspace history-navigation lock;
its generation checks handle completion and errors. Other legacy route loaders
retain their existing behavior pending their own typed migrations.

Releasing the navigation lock alone did not pass the test. Server request logs
showed the repeated identical GET arriving only after the first was released.
Adding `cache: "no-store"` to Library reads eliminated that browser cache wait;
the same test then passed before releasing the first request, including its late
503. No unique query tokens or artificial delays were added. Temporary debug
logging was removed. Preserve both the routing and request-cache protections.

## 2026-09-04 — Final validation and delivery

The final complete run passed 593 tests across 85 files in 14 processes, including
all three Library rendered regressions. Both strict typechecks, browser artifact
freshness, package contents and whitespace checks pass. A freshly compiled 86 MB
standalone delivers exactly the source bundle and passes rendered detail, reload,
Chinese phone, Back and token cleanup checks. The first standalone fixture used
an unsupported category and failed before launching; corrected isolated test data
then passed. No application change was made for that fixture mistake.

Read-only source screenshots were inspected at desktop and phone sizes. The source
preview was restarted. The original audit and legacy eval fixture remain byte-equal;
no real project suite was created. Earlier successful 592-test logs and the later
failed navigation attempt are retained separately from the final complete evidence.
