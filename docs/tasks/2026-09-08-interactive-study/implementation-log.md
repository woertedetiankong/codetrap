# Implementation decisions

### 2026-09-08 — Attachments rather than a second library

Keep Phase2 insights/collections as the source of identity and textual content. Store artifact metadata separately and copy HTML into a content-addressed local store. Every update adds an immutable version; replacing the latest requires its expected version. This avoids rewriting existing insight approval and source-coverage contracts.

### 2026-09-08 — Player trust boundary

Deliver HTML only through authenticated JSON, then render as srcdoc in an opaque-origin sandbox allowing scripts only. Prepend restrictive CSP before untrusted markup. Never expose the launch token to the child or interpret child messages as progress/commands. No server filesystem import endpoint: imports use the local CLI. Source tests use isolated temporary projects, not demonstration records in the real project.
