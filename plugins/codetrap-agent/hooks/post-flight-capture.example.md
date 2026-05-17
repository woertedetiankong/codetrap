# Post-flight Codetrap Capture

Use this template after a task reveals a reusable pitfall. Do not write the trap automatically; ask the user to confirm first.

```json
{
  "title": "Short pitfall title",
  "category": "bug",
  "scope": "project",
  "context": "When this situation appears...",
  "mistake": "The agent tends to...",
  "fix": "Do this instead...",
  "tags": ["area", "tool"],
  "severity": "warning",
  "path_globs": ["src/example/**"],
  "module": "example",
  "owner": "platform"
}
```

After confirmation:

```bash
codetrap add --json '<json above>' --output-json
```
