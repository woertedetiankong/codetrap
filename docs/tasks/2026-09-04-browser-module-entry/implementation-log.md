# Implementation decisions

## 2026-09-04

- Preflight memory search found no applicable confirmed trap. Preserve the
  existing proposed serialization lesson without accepting it.
- A 3,502-line string contains most workspace logic; other modules inject
  serialized functions with ambient globals. Introduce ordinary module imports
  and factories with real dependencies, then bundle for the browser. A checked-in
  generated asset supports existing synchronous static HTML imports and standalone
  delivery without runtime compilation or extra asset servers.
- Migrate startup/session/network/bootstrap contracts into strict TypeScript.
  Keep the large legacy workspace in an explicit JavaScript boundary while
  preserving existing typed feature controllers. Full business-state typing is
  a separate coherent task; no blanket `any` conversion or disabled TS checks.
- Impact, experience actions and pane layout expose only the operations the
  workspace actually uses (5 / 8 / 4). Their internal helpers stay private;
  no `declare` globals or function-source serialization remain in the runtime.
- Browser entry uses a DOM-only strict TS project. Startup validates bootstrap
  data before installing project state. HTTP failures retain their status and
  payload even if the response is HTML; denied storage keeps the explicitly
  launched tab usable while stripping its URL token.
- Replace obsolete source-string assertions with transport/session/bootstrap
  behavior, generated asset identity checks and actual browser recovery. Existing
  review/learning/revision/evaluation journeys remain covered. An external-change
  browser test confirms a typed but unsaved candidate survives background refresh.
- One combined four-file browser process exited 137 after eight passing tests,
  without an assertion failure. Earlier stages saw the same process-level
  limitation. Full regression uses ten-file ordinary batches and isolated browser
  files; preserve the failure log rather than counting an interrupted run as green.
- The first full batch exposed an obsolete CI test expecting only `tsc --noEmit`.
  It now expects both project and browser TS checks. The completed full run passed
  581 tests across all 83 files in 13 processes. The count replaces 15 former
  source-string tests with three build-delivery tests and adds nine platform/
  entry behavior tests; existing rendered workflow tests are retained and extended.
- Npm dry-run contents include the entry, workspace JS/declaration, generated
  artifact, build helper and browser TS config. The 86 MB standalone serves the
  identical browser bytes as source Web, preserves token cleanup and Back/refresh,
  and opens the real 24-case legacy preview in Chinese on a phone without writing
  a suite. Its temporary server was stopped; source preview remains on port 4748.
