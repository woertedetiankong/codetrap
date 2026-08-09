---
name: review-ui-screenshots
description: Review screenshots of a UI before changing code. Use when the user provides screenshots, rendered pages, or visual comparisons and asks for a critique, polish pass, visual bug review, prioritized findings, or implementation of approved UI fixes. Rank evidence-backed findings, distinguish observed problems from hypotheses, obtain approval for the exact fix list, and land approved work in subsystem-sized commits.
---

# Review UI Screenshots

Turn screenshots into an inspectable UI review and an approval-bound
implementation sequence. Treat pixels as evidence, not as a complete account of
runtime behavior.

## Review the Evidence

1. Inspect every supplied screenshot at the highest useful detail.
2. Record viewport, state, route, theme, and comparison baseline when available.
3. Separate directly visible findings from hypotheses that require code or
   browser inspection.
4. Inspect the relevant implementation only far enough to verify likely causes
   and avoid recommending changes already handled by responsive or state logic.
5. Do not infer inaccessible behavior, interaction quality, or off-screen layout
   from a static image alone.

## Present Ranked Findings

Lead with findings, ordered by user impact:

- `P0` blocks the task or makes the UI unusable.
- `P1` creates a major usability, hierarchy, accessibility, or responsive issue.
- `P2` is visible polish or consistency debt worth fixing.
- `P3` is optional refinement.

For each finding, name the visible evidence, affected area, likely cause if
verified, and a concrete correction. Mark uncertain causes as hypotheses. Group
duplicates across screenshots instead of repeating them.

Include a short proposed fix list with stable identifiers such as `F1`, `F2`,
and `F3`. State which findings should be handled together because they share a
component, token, layout primitive, or test surface.

## Bind Work to Approval

Do not edit code until the user approves an exact set of finding identifiers.
Treat broad language such as “looks good” as review feedback, not authorization
to implement an unstated item.

If implementation discovery materially changes a proposed fix, show the changed
item and get renewed approval for that item. Small mechanical consequences of an
approved fix do not require a second approval.

## Implement the Complete Approved Set

1. Map each approved finding to its owning subsystem and existing design system.
2. Implement all approved items; do not silently omit low-priority items.
3. Preserve unapproved behavior and unrelated user changes.
4. Verify the relevant states and viewports, preferring fresh rendered evidence
   when the project supports it.
5. Report any approved item that could not be completed instead of substituting
   a different change.

Keep commits reviewable and organized by subsystem. Combine findings that must
move atomically; otherwise separate independent component, layout, token, and
test changes. Never commit unrelated work.

## Close the Loop

Summarize the implemented finding identifiers, validation performed, and commit
boundaries. Ask for or generate a follow-up screenshot when visual comparison is
needed, and explicitly carry unresolved hypotheses or unapproved findings into
the handoff.
