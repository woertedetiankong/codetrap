## Codetrap Dogfood Eval

Use this add-on only for codetrap maintainers working on codetrap itself. For ordinary external projects, use `AGENTS.codetrap.md` without this dogfood section.

After each pre-edit codetrap search, record whether the search was:
- useful_hit
- miss
- noisy_hit
- no_relevant_trap

Record the observation in `dogfood-log.md` with the task, query, mode, top results, judgment, whether the result changed the next action, and the promotion lane.

When a real query should reliably find an existing trap, save it as a live eval case with query, mode, scope, and gold target.

Do not promote every observation. Only promote representative cases that protect search quality.
