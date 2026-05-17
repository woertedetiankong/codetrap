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

Ask the user to confirm before writing. After confirmation, run:

```bash
codetrap add --json '{...}' --output-json
```
