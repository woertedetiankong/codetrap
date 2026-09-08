# Implementation Log

### 2026-09-08 — Replace the whole Impact interface

The user explicitly rejected keeping the old Impact UI. The approved prototype
therefore owns the shell as well as all four destinations; only the existing
feedback, evaluation and governance behavior is reused. Removed 41 unused legacy
page functions. Library and Review retain their own layouts and entry points.
No commit or PR has been created.

### 2026-09-08 — Real evidence changes the prototype's content

Real task titles and query bodies are absent in current observations. The product
uses client/date identity and explicitly says query text is missing. Counts cover
all time, and task search/filter applies to the loaded history. Historical lesson
text is displayed only for the exact stored version. Prototype seed records and
its artificial failure/demo controls are not copied into production.

### 2026-09-08 — Sessions and saved addresses own revisions

Editor sessions are keyed by project and source, preserve raw input across area
switches, and capture their owner for asynchronous responses. A saved revision
aliases its session and updates its route, preventing a reload from creating a
second draft. Digest and version checks continue to control apply and rollback.
Browser tests retain lost-response retry, edited-result invalidation, recovery,
and cross-context rejection coverage through the new entry points.

### 2026-09-08 — Pending work must actually close

The workbench uses folded current feedback, groups by scope/ID/version, and reads
governed retrieval reviews. Accepted and rejected miss signals leave pending work;
the review receipt remains readable. Retrieval success and later task feedback
remain separate types of evidence, with later activity bound to the applied version.
