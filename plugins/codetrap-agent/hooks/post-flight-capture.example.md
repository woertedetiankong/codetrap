# Post-flight Codetrap Capture

Use this template after a task reveals a reusable pitfall. Do not write the trap automatically; put it in the session candidate inbox first.

```markdown
Title: Short pitfall title
Category: bug
Scope: project
Context: When this situation appears...
Mistake: The agent tends to...
Fix: Do this instead...
Tags: area, tool
Severity: warning
Path globs: src/example/**
Module: example
Owner: platform
```

Capture the candidate:

```bash
codetrap session capture --trap-markdown-file candidate.md --kind review --json
```

Hook-based clients can set `CODETRAP_CANDIDATE_FILE` to a Markdown file with the same fields and run the packaged `post_task` command. The hook must still leave the candidate in the inbox; it must not accept or write a confirmed trap automatically.

Then review it with `codetrap session candidate <candidate-id> --session <session-id> --json` and accept, edit, reject, or supersede it explicitly.
