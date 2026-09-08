---
status: Complete
updated: 2026-09-08
---

# Interactive study — handoff

## Summary

An AI agent can generate HTML/SVG lessons through the bundled `codetrap-study`
skill and attach them to existing Learning insights or collections. The local
console plays isolated lessons alongside the existing written explanation.

## Current State

Complete as of 2026-09-08. Implementation and validation finished; no release or
installed-service upgrade performed.

## Git And Persistent State

Changes are uncommitted on `main`. Browser bundle regenerated. No database
migration; artifact storage is created on first import. Tests used temporary
projects and did not add examples to the real Learning library.

## Validation

- `bun run test`: 104/104 test files passed.
- `bun run typecheck` and `bun run check:web`: exit 0.
- Skill creator `quick_validate.py` via uv/PyYAML: Skill is valid.
- Isolated real-course check: 571,840-byte Portal offline HTML rendered, routing
  control and chapter 12 navigation worked, downloaded HTML matched original.
- Store/CLI/API/browser tests cover immutable history, stale updates, source
  deletion, restore/export, project identity, auth, damaged files, symlinks,
  mobile layout, blocked parent/storage/network access and late async responses.

## Cross-module references

[Store](../../../src/lib/study-artifacts.ts) owns metadata and blobs;
[commands](../../../src/commands/study-commands.ts) own imports and updates;
[player](../../../src/web/browser/study-player.ts) consumes authenticated JSON;
[skill](../../../plugins/codetrap-agent/skills/codetrap-study/SKILL.md) owns source
coverage and generation instructions. Existing Phase2 target approval is preserved.

## Next Steps

No required implementation remains. Follow actual learner feedback on lesson
usability before adding a persistent animation-state or grading bridge. Installing
this source version's skill bundle and restarting the source web process makes
it available in an existing local environment; releases remain separate work.

## Restart Verify

```sh
bun run check:web # expected: exit 0; mismatch means generated bundle drift
bun test src/tests/study-artifacts.test.ts src/tests/study-player-browser.test.ts # expected: 8 passing tests with Chromium; mismatch means store/player regression
```

## Environment and red lines

Existing source preview is documented on port 4750 and installed service on 4751;
neither was restarted. Do not replace real records with demonstration fixtures.
Do not expose launch tokens or publish without user authorization. External
resources and same-origin storage are unavailable inside lessons; downloaded
files use normal browser rules. Detail rebuilds reset in-memory animation state.

## Implementation Log

[Implementation log](implementation-log.md) records storage and trust decisions.
[README](../../../README.md) and [interactive study documentation](../../interactive-study.md)
now explain the workflow, CLI and execution limits; task index and NEXT-SESSION
point here. No wiki was created.
