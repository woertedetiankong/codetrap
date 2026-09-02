# Implementation Log

> Created: 2026-08-30

## Task

Repair the local Web console's recovery, routing, Impact navigation, and candidate-review clarity after an OpenCLI user-journey review.

## Assumptions

- A route may restore a view or item only inside the currently registered project; project roots remain outside the URL for privacy.
- “Accept anyway” is a conflict-resolution action, not a normal peer of “Accept.”

## Initial Approach

- Add a small pure hash-route codec to the generated client, keep shared Impact navigation outside data-state branches, and introduce a persistent bootstrap recovery surface without changing server authentication.

## Log

### 2026-08-30

- OpenCLI can only read addressable rendered states. The absence of deep links blocked both user bookmarking and automated read-only Evals verification, so route state is a product contract rather than test-only plumbing.
- Routes intentionally omit the absolute project root. A copied local URL targets the receiver's currently selected project, avoiding a new path-disclosure surface before Team identity and authorization exist.
- Candidate override actions will remain implemented but appear only after a possible conflict. This preserves the governed backend workflow while removing a dangerous default choice from the normal review path.
- A high numerical quality score no longer implies “accept” while any quality warning remains. New candidates receive `edit`, and review summaries reinterpret older persisted `accept` suggestions with warnings so the queue and detail recommendation agree.
- OpenCLI's semantic extraction continued to expose visually hidden static controls. Terminal auth failure now removes the unusable workspace from the DOM, while non-review views clear hidden review-tab labels; native `hidden` state alone was not sufficient for this reader.
- The first full-suite run found one stale CLI assertion that expected a warning-bearing candidate to count as high-quality/accept. The assertion was updated to the new `needs_edit` contract, its file passed independently, and the second full run passed 491 tests with one intentional Windows browser smoke skip.
- Final OpenCLI verification directly addressed `#/impact/overview`, `#/impact/evals`, and a selected candidate. It confirmed the recovery page on 401; visible Overview action and stable tabs; 24-case 100% retrieval metrics; differentiated empty review copy; and the simplified candidate action hierarchy without conflict overrides.
