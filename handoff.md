# Handoff

## Summary

The web console now uses the visual order project rail, detail pane, then queue pane. It still supports Codex-style pane controls: horizontal resizing, desktop-only show/hide buttons for the left sidebar and right queue pane, and local persistence without touching the web API.

## Key Decisions

- Kept the existing no-build web architecture: `src/web/static.ts` owns the shell/CSS, `src/web/client-shell.ts` owns browser shell layout behavior, and `src/web/client-script.ts` embeds that shell behavior with the rest of the client script.
- Stored only `rail` and `detail` pixel widths. The queue pane is the flexible rightmost pane with a 320px minimum; old saved `queue` width can be read as a detail-width fallback, but future writes use `detail`.
- Desktop resizing is disabled below the existing 1060px breakpoint. Saved desktop widths remain in storage, but inline grid columns are cleared while mobile CSS is active so the single-column layout still wins.
- Splitters are 8px wide, focusable separators. Arrow keys nudge by 16px, Shift+Arrow nudges by 48px, and double-click resets the saved layout.
- Sidebar collapse is stored separately as `codetrap-sidebar-collapsed`; right queue collapse is stored as `codetrap-queue-collapsed`. On mobile, collapsed classes are removed so saved desktop state cannot hide the stacked panes.
- When the sidebar is collapsed, the detail pane becomes the left visible pane and the right splitter still resizes detail/queue. When the queue pane is collapsed, rail/detail remain visible with the left splitter. If both side panes are collapsed, the detail pane fills the whole shell.
- Dragging the left splitter past the sidebar collapse threshold collapses the rail; dragging the right splitter past the queue collapse threshold collapses the queue. Collapsed panes can temporarily reveal as overlays when the pointer is near the left or right shell edge.
- The side-pane toggles are shell-level edge controls, not part of the queue title or tabs. This keeps the left restore control at the outer left edge and the right restore control at the outer right edge even when either pane is hidden.

## Files Changed

- `src/web/static.ts`: defines the rail/detail/queue DOM order, splitter columns, splitter styling, shell-edge left/right toggle buttons, collapsed side-pane styling, edge reveal overlays, mobile hiding, and two separator elements between the three panes.
- `src/web/client-shell.ts`: owns layout persistence, drag handling, drag-collapse thresholds, edge-hover reveal behavior, keyboard resizing, reset behavior, left/queue collapse persistence, and viewport resize reconciliation for the swapped pane order.
- `src/web/client-script.ts`: embeds the shell client behavior and wires the shell toggles into the broader web console script.
- `src/web/client-text.ts`: added English/Chinese sidebar and queue-pane toggle labels.
- `src/tests/web-client-text.test.ts`: added static regression checks that the splitter/sidebar shell stays embedded and the detail pane appears before the queue pane.
- `implementation-log.md`: appended the implementation decisions and validation notes.
- `dogfood-log.md`: recorded the pre-edit codetrap search observation.

## Validation

- Targeted tests passed: `bun test src/tests/web-client-text.test.ts src/tests/web-console.test.ts`.
- Full suite passed: `bun test src/tests`.
- Type-check passed: `bunx tsc --noEmit`.
- Whitespace check passed: `git diff --check`.
- Browser verification passed against `http://127.0.0.1:4787`: desktop x-order is rail/detail/queue, the right splitter changed widths from approximately `314/567/383` to `314/630/320`, and the layout survived reload.
- Browser verification for queue collapse passed: queue display changed from `flex` to `none`, the right splitter became hidden and unfocusable, and rail/detail remained visible.
- Browser verification for sidebar collapse passed: rail display changed from `flex` to `none`, the left splitter became hidden and unfocusable, and detail/queue remained visible with the right splitter active.
- Browser verification for drag-collapse and edge reveal passed at a 1280px viewport: left drag collapsed the rail, left-edge hover revealed a 330px rail overlay, right drag collapsed the queue, and right-edge hover revealed a 390px queue overlay.
- Browser verification for the edge controls passed: the left toggle stayed at `x=12`, the right toggle stayed within 12px of the viewport right edge, and both controls remained correctly positioned in full, right-collapsed, both-collapsed, restored, and mobile fallback states.

## Known Risks

- The browser behavior is still an embedded script string. The new logic is isolated in helper functions, but a real client bundle would be easier to unit test if the web UI keeps growing.
- The 8px splitters and pane-toggle icons are intentionally subtle; they rely on hover/focus state and tooltip labels rather than visible explanatory text.

## Follow-ups

- None required for this change.
