# Release decisions

### 2026-09-08 — Align release gates with CI

The release and npm workflows still ran all tests in one Bun process and omitted
Chromium setup. Reuse the file-isolated test runner, pinned Bun and browser setup
already used by CI. Both package.json and the runtime version become 0.1.10.
Windows exposed an immediate post-click assertion in the new study browser test;
wait for its observable result and use the shared CI timeout configuration.

### 2026-09-08 — Preserve the unsuccessful tag and advance to 0.1.11

The 0.1.10 binary release gate failed on the hosted iframe pointer interaction;
its npm workflow was cancelled before package upload. Preserve v0.1.10 instead
of moving an existing tag. Version 0.1.11 uses a fixture-ready signal and actual
keyboard activation to verify child scripting independently of pointer coordinate
behavior. Security assertions remain unchanged. Full local preflight and both
Windows/Linux CI passed at b052d4e; GitHub binary release completed successfully.
