# Implementation Log

> Created: 2026-08-08

## Task

Implement the evidence-approved screenshot-first UI review skill as Phase 3's
first high-side-effect candidate lifecycle.

## Assumptions

- The user's approval selects the artifact and authorizes implementation of its
  lifecycle; modifying live client homes still requires a preview of the exact
  resolved targets.
- The Phase 3 evidence gate is authoritative: only `skill_candidate` ships in
  this slice, while custom-agent and automation work remains closed.

## Initial Approach

- Reuse the Phase 1/2 candidate approval contract, introduce an isolated Phase 3
  directory-snapshot store, and prove the full lifecycle against explicit test
  client homes before offering a live-home install preview.

## Log

### 2026-08-08

- Compatibility discovery: the v3 candidate kind union also controls Phase 2's
  inferred destination type. Adding `skill_candidate` therefore requires an
  explicit Phase 2 allowlist, not merely a new enum member.
- Storage decision: skill installs get a separate Phase 3 commit document.
  Project-file text snapshots cannot represent two external directories or
  restore arbitrary pre-existing bytes safely.
- Safety decision: preview and apply require explicit Codex and Claude homes.
  The product resolves each target to the exact `skills/<name>` child, snapshots
  both before mutation, restores both on partial failure, and verifies installed
  state before rollback.
- Implemented candidate schema v4 with additive v1-v3 migration, an explicit
  Phase 2 destination allowlist, and the `skill_candidate` receipt destination.
- Generated `review-ui-screenshots` with the skill initializer and validated its
  `SKILL.md` plus `agents/openai.yaml`. On Windows the validator must run with
  `PYTHONUTF8=1`; its default GBK read failed before format validation.
- Implemented exact path-bound authorization. Preview returns an authorization
  string containing both absolute targets; install recomputes it and refuses a
  different path pair, stale revision, missing approval, or wrong destination.
- Implemented recoverable dual-directory replacement, byte snapshots including
  empty subdirectories, append-only receipts, conflict-safe user rollback, and
  agent-removal refusal.
- Acceptance tests use real CLI subprocesses and explicit isolated client homes.
  They cover read-only preview, byte-identical install, edit invalidation,
  path-scope mismatch, receipt fields, post-install conflict refusal, and exact
  restoration of binary files plus empty directories.
- Final repository verification: skill validation passed; Phase 3 targeted tests
  passed 5/5; the full suite passed 379 with one intentional browser smoke skip;
  Windows CLI/MCP builds and `git diff --check` passed.
- Roadmap decision: implementation readiness is not Phase 3 completion. Live-home
  installation and later organic behavior-change evidence remain explicit gates.
- Generated the real read-only preview for candidate `cand-001`. Both absent
  targets (`C:\Users\EDY\.codex\skills\review-ui-screenshots` and
  `C:\Users\EDY\.claude\skills\review-ui-screenshots`) would be created with
  identical directory hash `6cffa7490ffed74c01b2dd9d0fa4fe3a9bccd20f66198254a40823fb0c89da51`.
  Installation remains paused for exact path-bound user authorization.

### 2026-08-09

- The user approved the exact previewed targets after the skill's purpose and
  non-automatic behavior were explained. Approval was recorded for candidate
  revision 1 and only the two named client paths.
- Live install succeeded as Phase 3 commit `p3-20260809044652-b3sa2k`; its commit
  receipt records declared executor `agent`, destination `skill_candidate`, and
  both authorized targets. Both targets had `before: null`, so rollback removes
  the created skill directories rather than restoring overwritten content.
- Independent `Get-FileHash` checks matched across clients: `SKILL.md`
  `d36e6239a9b2c507e54b6ec4a280fa843464e4c3153a2fa4e133a56ff581186d` and
  `agents/openai.yaml`
  `6c1d873b2909454d425733872c712fbd91f520eb24f783993d3ebe76b7116804`.
  Post-install preview reports `changed: false` for both homes.
- Phase 3 remains open by design: the roadmap additionally requires evidence
  that the installed skill changes a later organic task.
- The later organic proof arrived when the user supplied the running codetrap
  console screenshot and asked to fix every reviewed issue. The installed skill
  changed the workflow in observable ways: the agent inspected the screenshot
  and real page before editing, separated evidence from hypotheses, presented an
  exact F1-F4 fix list, waited for approval, then implemented only that list.
- The approved pass made the compact console content-first, added a bounded
  project/session expander, localized session states and all deterministic
  quality warnings, and replaced per-row destructive buttons with one selected-
  session action that preserves confirmation. OpenCLI checks at 1440x900 and
  720x900 showed the intended layouts, one delete control, no raw known English
  warnings in Chinese, and zero console errors.
- Repository validation after the proof passed 380 tests with one intentional
  browser-smoke skip and zero failures; Windows CLI/MCP compilation remained
  green. This satisfies the roadmap acceptance sentence without claiming that
  Claude behavior was exercised: installation is cross-client, while the later
  real-work behavior proof is from Codex.
- The complete lifecycle, skill artifact, organic UI proof, tests, and reconciled
  docs landed together as repository commit `d834eb4`.
