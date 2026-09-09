# Three default skills and optional history review

Created: 2026-09-08
Status: Complete
Parent plan: [Agent Experience Compiler roadmap](../../agent-experience-compiler-roadmap.md), with the approved conversation proposal: three default entries plus one optional entry.

## Goal

Expose check, capture and study as defaults, with historical review explicitly
installable. Keep CLI behavior, source coverage and approval semantics intact.

## Success Criteria

New installations contain exactly three default skills; review can be installed
and archived; repeat setup preserves opt-in; legacy folders and user custom files
have recoverable backups; source and standalone binaries include all references.
Doctor detects missing/stale references without demanding optional installation.

## Scope

Skill routing and progressive references; Codex/Claude setup, CLI flags, migration,
health reporting, installation documentation and local installed bundle refresh.

## Constraints

Preserve ASCII explanations in Learning, explicit destination selection, candidate
approval and sampled-history limits. No changes to saved lessons or public npm
release in this slice. Archive retired names, do not discard custom content.

Validation: 105/105 test files passed; focused final setup/health tests 21/21;
typecheck, four skill validators, source/standalone installation and package
resource inclusion checks passed. Both local client bundles are migrated.
