# Implementation Log

> Created: 2026-08-31

## Task

Complete Learning Impact without collapsing personal study state, shared Insight
content, proposed Agent experience, and confirmed runtime memory into one store.

## Assumptions

- Version 1 has one local actor per project; the persisted actor key remains
  explicit so Team Hub can add identities later without changing Insight content.
- A deterministic draft is an editable starting point, not a claim that Codetrap
  semantically understood arbitrary study prose.

## Initial Approach

- Persist personal state in a locked atomic side document beside Phase 2 data.
- Overlay that state onto the existing read-only Insight payload.
- Reuse `SessionOperations.captureCandidate` for Inbox staging and preserve the
  existing human authorization path for confirmed memory.

## Log

### 2026-08-31

- Legacy `consulted_count` lives inside the Insight record, but the accepted
  product contract says progress belongs to a person. New reads therefore derive
  `learned` from the legacy field only when no explicit progress row exists; new
  writes never mutate the Insight document.
- Candidate generation cannot honestly infer a precise new pitfall from arbitrary
  prose without a model. The local generator will use transparent templates plus
  reviewed Insight text, require an editable preview, and describe the result as
  a draft rather than an automatic judgment.
- Learning actions should contribute metadata to Impact only when Observation is
  already configured. Opening or updating Learning must not create an Observation
  Ledger as a hidden side effect.
- Personal progress writes are idempotent. Repeating the same status, feedback,
  or Run link returns the current record without refreshing its timestamp or
  manufacturing a duplicate Observation event.
- The Learning page snapshots every candidate-draft field and both pane scroll
  positions before an async preview or create request. Background session polling
  leaves the active Learning detail DOM untouched, so a user does not lose text or
  jump to the top while reviewing a long Insight.
- OpenCLI verified the Chinese and English three-state controls, Helpful feedback,
  an existing Run link, deterministic preview, exact edited Fix preservation,
  Candidate Inbox handoff, and addressable review route. The journey produced no
  confirmed trap, failed network request, or console error.
- A Windows validation fixture exposed that launching the compiled CLI through a
  Bun helper did not honor the intended temporary working directory. Safety checks
  found and precisely removed the test-only home-scoped files twice; final browser
  validation invoked the compiled CLI directly with the terminal workdir set to
  the verified temporary project. The durable lesson is staged as candidate
  `cand-001` in session
  `2026-08-31-capture-launch-compiled-windows-cli-fixtures-from-an-explicit-te`.
