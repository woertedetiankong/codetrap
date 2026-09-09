---
name: codetrap-study
description: Help users learn from blogs, documentation, code or existing Learning records; organize readable explanations and optionally generate HTML/SVG interactive lessons for the Learning library.
---

# Learn and organize knowledge

Use `codetrap` from the intended project; in this source checkout use
`bun run src/index.ts` if the CLI is unavailable. Match the user's language.

## Choose what to save

A learning request defaults to Learning only. Honor an explicit request for
experience memory only or both; ask once if the destination is ambiguous.
Do not convert background facts into coding rules or add a second destination
silently. For experience-only requests use the bundled `codetrap-capture` entry.
A preview request alone does not authorize saving.

## Read only the needed procedure

- For a new article, document or code source, read
  [external-source.md](references/external-source.md): source coverage, selected
  destination, collection schema and approval before applying records.
- For animation/interactive HTML generation, attaching an existing HTML file or
  version updates, read [interactive-html.md](references/interactive-html.md).
  Animation is optional; ordinary reading notes do not require HTML.

For every Learning insight: 用ASCII流程图结合通俗易懂的例子讲解。
Keep a compact ASCII flow and concrete plain-language example in its text body,
even with an interactive attachment. Preserve substantive source background in
collection context. Say when source access is incomplete; never claim full
coverage from sampled material. Mark simulated numbers separately from evidence.

New records use the existing candidate approval flow; do not approve your own
proposals. Authorized attachments to existing records need no extra candidate
review. Report saved IDs, destinations, sources and anything awaiting approval.
Historical session mining is not part of this skill: use optional `codetrap-review`
only on an explicit historical review request.
