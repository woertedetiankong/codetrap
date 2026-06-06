---
name: codetrap-capture
description: Propose a new codetrap after repeated failures, user corrections, or review feedback.
---

Use this after a task exposes a recurring mistake pattern. Draft a candidate trap with:

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
