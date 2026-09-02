# Implementation Log

> Created: 2026-08-30

## Task

Make the empty Overview/Runs experience understandable and explorable without requiring a user to compose metadata-only JSON commands.

## Assumptions

- The first-run sample teaches the information model; it is not evidence and must not affect real metrics.
- Automatic Agent observation remains a separately authorized integration slice.

## Initial Approach

- Add a browser-memory sample Run and a compact connection explanation to the existing blue Impact shell, reusing the real timeline renderer where its allowlisted shape matches.

## Log

### 2026-08-30

- The initial idea was a Web action that appends a demo Run. It was rejected because the Observation Ledger is append-only evidence and Overview totals should remain factual. The accepted design is an explicitly labeled, browser-memory preview that performs no API mutation.
- User feedback established OpenCLI rendered-page verification as a standing Web completion gate. Browser-script syntax tests remain necessary but are insufficient because they cannot detect hidden semantic content, misleading hierarchy, or broken first-run copy.
- OpenCLI semantic extraction verified the complete empty-state explanation and GET-only API path. Its rendered screenshot then exposed `completed` wrapping awkwardly in the Run summary grid, so the summary-value typography was tightened before final validation.
