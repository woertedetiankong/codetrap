---
name: codetrap-learning-review
description: Look back over recent sessions and stage reusable lessons for codetrap review. Runs only when the user explicitly asks for it; never writes durable memory on its own.
---

Run this **only when the user explicitly invokes it**. Do not scan history during
ordinary coding tasks, and do not trigger implicitly from a search or capture.

Use `codetrap` when it is available on `PATH`. In a Codetrap source checkout
where the global command is intentionally absent, run the same arguments with
`bun run src/index.ts` from the repository root. Outside that checkout, report
the missing CLI; do not install or update it without user approval.

## 1. Confirm scope, once

If the user already gave a scope ("review the last 30 days"), do not re-ask.
State the red lines and proceed:

> I will read the last 30 days of <client> sessions and draft at most 10 lesson
> candidates. This run is dry-run only; results go to
> `.codetrap/learning/reviews/<review-id>/`. I will not write traps.db, edit
> guidance, install skills, create agents, or enable automations.

If they gave no scope, ask once: last 7 days / last 30 days (default) / custom
range / last N sessions.

## 2. See what history exists

```bash
codetrap learn sources --json
```

This is read-only and opens no transcript bodies. Use `--source` to pick one
client, `--project-only` to restrict to sessions whose cwd is inside this repo.

## 3. Build the evidence pack

```bash
codetrap learn review --source <codex-sessions|claude-code-sessions> \
  --since 30d --limit 10 --project-only --json
```

Use the source matching the client you are running in. codetrap reads the
sessions itself, redacts secrets, caps every excerpt at 500 characters, and
writes `source-manifest.json`, `evidence-pack.json` and `discovery-prompt.md`
into a new review directory. Nothing durable is written.

## 4. Draft candidates

Read `evidence-pack.json` and follow `discovery-prompt.md` in that directory.
Write `lesson-candidates.json` beside them.

Every `evidence[].ref` must be a real ref copied from `evidence-pack.json`.
Staging verifies each one and rejects the candidate if it does not resolve —
an invented pointer is not evidence.

A lesson with no trigger cannot become a guardrail, and one with no recommended
action cannot enter runtime; both are rejected. A lesson that carries real
understanding but no agent action is still worth keeping — mark it directly as
`"candidate_kind": "insight"`.

For every user-study insight, generate the study body with this instruction:

> 用ASCII流程图结合通俗易懂的例子讲解

Put the compact ASCII flow diagram and the concrete, plain-language example in
`recommended_action`, because that field becomes the insight body after Phase 2
migration. Explain what the reader should notice, and do not imply that saving
or marking the insight trains the model. Keep ordinary pitfall candidates
concise; this teaching format applies only to user-study insights.

When one AI conversation yields several study insights, give them the same
`collection.id`, `collection.title`, and shared `collection.topics`, set
`source_type` to `conversation`, and
assign consecutive `collection.position` values in the recommended reading
order. Use the conversation evidence refs as the source refs; do not combine
unrelated conversations merely because they were reviewed in one run.

Before drafting those insights, inventory every relevant evidence item as a
stable source unit. Put the same `collection.source_coverage` manifest on every
candidate, using mode `sampled` and the exact `source_fingerprint` printed in
`evidence-pack.json`/`discovery-prompt.md`. Route study material through a
candidate's `source_unit_refs`; preserve conversation-level background in
shared `collection.context_sections` with its own source-unit refs. Use
`skip` only for non-content or irrelevant evidence, with a reason. The CLI
rejects inconsistent manifests, unexplained units, and duplicate or gapped
positions. Because evidence packs are budgeted samples, never describe the
result as full-source complete.

## 5. Stage, then stop

```bash
codetrap learn stage --review-dir <dir> --json          # validate, writes nothing
codetrap learn stage --review-dir <dir> --apply --json  # stage into the inbox
```

Staging fills the review inbox. It is **not** a commit. Report to the user:

- what was staged, with candidate ids
- what was rejected and why
- what was skipped because they had already suppressed it
- confirmation that no durable destination was modified

Then stop. The user reviews with `codetrap web` or `codetrap session candidates`.
For a `pitfall_trap`, approval is followed by `codetrap session accept <id>
--executor agent`. After the user approves an `insight`, commit it with
`codetrap phase2 apply <id> --session <session-id> --executor agent --json`.
The Web console can also let the user approve and add an insight to Learning in
one explicit action. You cannot approve on their behalf.
