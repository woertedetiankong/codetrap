# Release decisions

### 2026-09-08 — Align release gates with CI

The release and npm workflows still ran all tests in one Bun process and omitted
Chromium setup. Reuse the file-isolated test runner, pinned Bun and browser setup
already used by CI. Both package.json and the runtime version become 0.1.10.
Windows exposed an immediate post-click assertion in the new study browser test;
wait for its observable result and use the shared CI timeout configuration.
