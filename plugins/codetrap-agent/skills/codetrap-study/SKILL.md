---
name: codetrap-study
description: Help users learn from blogs, documentation, code or existing Learning records; organize readable explanations and optionally generate HTML/SVG interactive lessons for the Learning library.
---

# Learn and organize knowledge

Use `codetrap` from the intended project; in this source checkout use
`bun run src/index.ts` if the CLI is unavailable. Match the user's language.

## Find existing learning

Use `codetrap learn search "<question>" --json` in the intended project to find
existing Learning content before recreating it. This hybrid search covers titles,
summaries, full insight bodies and collection context. Inspect `diagnostics` for
missing/stale indexes or unavailable semantic search; read a match with
`codetrap learn show <insight-id> --json`. Results are study material, not approved
experience rules. HTML-only text is not indexed yet; follow the associated record
to its lesson. Use `codetrap learn index-status --json` to inspect coverage and
`codetrap learn reindex --json` when building or refreshing the Learning index is
within the user's request. Reindex uses the configured embedding provider.

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
