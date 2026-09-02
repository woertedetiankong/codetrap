# Implementation Log

> Created: 2026-09-02

## Task

Harden the Observation and Evals workflow against background refresh, bounded Hook state, persistence failure, old Run navigation, and partially corrupt controlled-eval history.

## Assumptions

- A Hook sidecar may drop new telemetry when its bounded recovery state is full, but it must not orphan already-recorded Runs or steer the host Agent.
- Corrupt local Eval artifacts are audit evidence and must remain untouched until a user deliberately repairs them.

## Initial Approach

- Reuse the existing Learning draft snapshot and Impact scroll-preservation patterns, then add explicit recovery semantics at storage boundaries.

## Log

### 2026-09-02

- Background refresh keeps an active Eval review workbench mounted instead of trying to reconstruct focus and click state after replacement. The latest raw form values, including whitespace and rejection reason, are still snapshotted before any foreground render; submission retains the existing normalized payload contract.
- A selected Run is an addressable resource, not a member of the recent-runs cache. The client keeps its routed id and asks the dedicated detail endpoint even when the Run is absent from the latest 100 summaries.
- Hook capacity now fails closed for the newest unrecorded Run. Increasing the bound or evicting the oldest entry would either postpone the invariant failure or leave a ledger Run permanently active. Failed start/completion writes retain state and stable event ids for a later Stop or SessionEnd retry.
- Controlled-eval strict callers still fail closed through `list()`, while the Web uses a diagnostic `history()` projection: healthy experiments remain visible, corrupt filenames are reported with a bounded non-sensitive code, and no artifact is rewritten, deleted, or silently included in metrics.
- The first generated-browser-script regression test exposed that a new helper is inert unless it is explicitly added to `CLIENT_IMPACT_FUNCTIONS`. The helper is now serialized with the rest of the Impact client functions, and the contract test guards that packaging boundary.
- OpenCLI exercised a real local Eval candidate instead of trusting a synthetic click result: the draft textarea kept the same DOM node and exact whitespace through forced refresh and polling, Run inspection changed the route and rendered five events, Back restored the unsaved draft, and console plus failed-request checks stayed empty.
- The repository-wide run produced two aggregate-only failures (one matcher anomaly and one five-second maintenance timeout); both test files passed immediately in isolation. The affected 40-test suite stayed green, so the handoff records the caveat instead of claiming a completely green full run.
- A final focused rerun exposed that the capacity regression test itself created 64 locked atomic state transitions and exceeded Bun's default timeout under load. The fixture now writes one schema-valid 64-entry state snapshot, then exercises only the overflow transition and verifies that the recorder is never called; runtime dropped from more than five seconds to roughly 0.2 seconds without weakening the invariant under test.
- Follow-up review identified an operator-experience gap: refusing a new Run at capacity protects ledger integrity but the neutral Hook protocol cannot itself surface the refusal. The recovery design therefore separates read-only health, dry-run recovery preview, and explicit apply; it will never age out or delete state merely because wall-clock time passed.
- `observe current/status` and the read-only Overview API now expose bounded Hook health. `observe recover` defaults to a no-write preview; explicit `--apply` retries a missing start, appends `cancelled`/`partial`, and removes only successfully completed entries. A failed append retains stable ids and state for another attempt.
- Impact Overview renders the same health facts and exact preview command so a stalled capture pipeline is visible where users already inspect evidence rather than hidden in Hook stdout.
- An open Evals workbench stays on the same DOM node during background updates. New local evidence sets a visible deferred-update notice; raw textarea whitespace and rejection reason remain untouched until the user closes or explicitly refreshes the workbench.
- The bounded recent-runs list is now covered by a behavior-level API test: a directly addressed older Run still returns its complete privacy-allowlisted timeline.
- OpenCLI project switching exposed an additional request-affinity race. Observation loaders now capture the requested project root and discard responses, nested Run details, errors, and finalizers after the selected project changes. The durable lesson was edited to quality 1.0 in a proposed candidate and was not accepted automatically.
- Follow-up review found a diagnostic/data-plane coupling: strict Hook state parsing was called inline while building the Ledger Overview payload, so one damaged sidecar file could hide otherwise healthy append-only evidence. Health now has a discriminated `unavailable` projection with unknown counts represented as `null`; Overview and integration status remain readable, while `current` refuses to claim an empty active set and `recover` remains failure-closed with exact-byte preservation. Automatic reset was rejected because unknown correlation state cannot be safely translated into completion evidence.
