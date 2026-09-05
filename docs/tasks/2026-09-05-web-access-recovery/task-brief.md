# Web access recovery

Created: 2026-09-05 (America/Los_Angeles).
Status: Complete. 616 tests across 88 files pass; strict checks and source/standalone delivery verified.
Parent: [Review state](../2026-09-04-review-state/handoff.md), [browser architecture](../../browser-architecture.md).

The user opened a bare preview URL in a fresh tab and saw a false server-restart
diagnosis plus a reload button that could not supply authorization. Fix missing,
rejected, network and server-response states. Provide explicit reauthorization in
the same tab, preserve Review drafts and selection, and never replay writes.

Keep per-service authorization and tab storage. Do not add a credential-disclosure
endpoint or accept other-origin links. Preserve the Review slice developed on checkpoint `6d54a4e`. The user subsequently
requested a local checkpoint of both slices; no push is requested. Validate the exact fresh
tab entry, restart/rejected save, recovery with blocked storage, stale requests,
malformed links/responses, browser layout and existing journeys.
