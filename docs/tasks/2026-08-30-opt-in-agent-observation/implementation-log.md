# Implementation Log

> Created: 2026-08-30

## Task

Add the smallest project-level, opt-in automatic Observation lifecycle shared by Codex and Claude Code.

## Assumptions

- A user-visible Run should correspond to one user request/Agent response turn, not an entire multi-task session.
- Lifecycle payloads are untrusted integration input even when supplied by a local Agent client.
- A neutral hook must never inject context or use hook decisions to change Agent behavior.

## Initial Approach

- Normalize `UserPromptSubmit` and `Stop` into the existing `run/started` and `run/completed` recorder calls.
- Use client/session/turn identity where available, plus bounded state for Claude Code.
- Add project-local preview/apply/status/disable commands that merge and remove only Codetrap-owned handlers.

## Log

### 2026-08-30

- Official Codex documentation now exposes lifecycle hooks including `SessionStart`, `UserPromptSubmit`, `Stop`, and `SessionEnd`; the earlier assumption that Codex only had completion notifications is obsolete.
- Both clients offer prompt-submit and stop events, so the accepted task boundary is a turn. Prompt and final-message fields are deliberately ignored even though the clients provide them.
- Project-local configuration was selected over global installation: observation is an explicit per-project consent decision and can be disabled without affecting other repositories.
- Codex Run identity is derived from client, anonymized session identity, and the client-provided turn id. Claude Code does not expose a turn id for this lifecycle, so each prompt-submit creates a fresh random Run and bounded project-local state correlates the following `Stop`; transcript inspection was rejected.
- The hook adapter persists active state before appending `run/started`, then records whether start evidence landed. This makes retries idempotent and lets `Stop` retry an interrupted start instead of silently producing an orphan completion.
- Normal search/usefulness and explicit validation/feedback attach automatically only when exactly one automatic Run is active. Two concurrent Agent turns fail closed and require explicit context rather than guessing ownership.
- Hook stdout is always neutral `{}`, stderr is empty, and storage/input failures exit successfully. Observation is a sidecar and cannot block, continue, or steer the Agent.
- Integration setup merges only exact Codetrap-owned command handlers under `UserPromptSubmit`, `Stop`, and `SessionEnd`; writes use a config lock, backup, and atomic replacement. Disable removes only those exact handlers and preserves history plus unrelated settings.
- OpenCLI found that the new onboarding guide called `impactAutoClient` without serializing that helper into the generated browser script. Static parsing could not detect the missing runtime dependency. The helper is now part of `WEB_IMPACT_CLIENT_SCRIPT`, with a named-function regression assertion and a successful rendered click/postcondition check.
- PowerShell `ConvertTo-Json` piping introduced a leading BOM during the isolated replay. Because hooks intentionally fail neutral, checking only `{}` would have produced a false positive. The replay switched to raw UTF-8 bytes and verified `observe current`, the ledger, the Web timeline, and absence of forbidden raw content. A review candidate was edited in session `2026-08-30-capture-powershell-json-pipelines-can-add-a-bom-before-stdin`; it remains unaccepted.

### 2026-09-01

- Applying the project hooks exposed a deployment gap: this checkout did not have
  `codetrap` on `PATH`, so a syntactically enabled handler would fail when the
  client invoked it. A compiled CLI now emits its own quoted absolute executable
  path; source/test execution retains the portable `codetrap` command.
- Ownership detection accepts both the legacy PATH command and an absolute
  `codetrap.exe` launcher, so status, repeated enable, and disable remain
  idempotent and reversible. It still refuses unrelated commands.
- Codex and Claude Code hooks were applied to this project for
  `UserPromptSubmit`, `Stop`, and `SessionEnd`. Codex requires reopening/trusting
  the project before new turns fire; no historical session is imported.
- Focused lifecycle/CLI/recorder tests passed 13/13. OpenCLI reopened the real
  Overview with the existing single Run, proving setup did not manufacture
  evidence; failed requests and console errors remained zero.
