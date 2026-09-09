---
name: codetrap-capture
description: Capture coding experience from current tasks, corrections or external sources; stage agent-discovered candidates and save explicitly confirmed user-authored rules.
---

## Select the mode

- Current-task mistakes and agent discoveries: use the candidate procedure below.
- User explicitly asks to save confirmed memory: read
  [confirmed-memory.md](references/confirmed-memory.md); retain draft confirmation.
- External article/document/code: read the shared
  [source procedure](../codetrap-study/references/external-source.md), bundled with
  the default study skill. Honor memory-only, Learning-only or both. Learning-only
  requests belong to `codetrap-study`; do not additionally save coding rules.

User intent selects the destination. Memory-only does not mean inventing rules
for background facts. For both destinations, keep concise rules separate from
complete teaching content and retain the same source references.

## Stage an agent-discovered candidate

Use this after a task exposes a recurring mistake pattern. Draft a candidate with:

Use `codetrap` when it is available on `PATH`. In a Codetrap source checkout
where the global command is intentionally absent, run the same arguments with
`bun run src/index.ts` from the repository root. Outside that checkout, report
the missing CLI; do not install or update it without user approval.

- triggering context
- mistake to avoid
- fix to apply next time
- severity
- tags
- optional `path_globs`, `module`, and `owner`

Do not write the confirmed trap directly. Put the draft into the session candidate inbox:

```bash
cat <<'EOF' | codetrap session capture --trap-markdown - --kind review --json
Title: <durable pitfall>
Context: <when it triggers>
Mistake: <what the agent did wrong>
Fix: <what to do instead>
Severity: warning
Tags: <area>,<tool>
EOF
```

Use `--trap-json` only when you already have a structured object. Prefer Markdown for agent-drafted lessons because it avoids shell-escaping long text.

If no session is active, `session capture` creates and closes a post-flight session automatically. Tell the user the returned candidate id and session id, then ask whether they want to accept, edit, reject, or supersede the candidate. Pending candidates are also visible through `codetrap session status`, `codetrap session list`, `codetrap doctor`, and `codetrap web`.
