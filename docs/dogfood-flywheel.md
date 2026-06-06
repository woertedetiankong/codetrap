# codetrap Dogfood Product Flywheel

Date: 2026-06-06

This document defines the internal product-learning loop for improving
codetrap through real codetrap development. It is a process spec, not a new
feature spec.

The flywheel is:

```text
pre-edit search
  -> dogfood observation
  -> promotion decision
  -> search eval, trap candidate, product backlog, docs guidance, or no promotion
  -> roadmap and implementation choices
  -> better codetrap behavior
```

## Purpose

Use real codetrap development as the first reliable data source for product
iteration. The goal is to learn from actual searches, failures, corrections,
reviews, and candidate-review decisions without adding telemetry or hidden data
collection.

The first version is internal dogfood only. Early-user feedback packages,
automatic capture, and user-facing analytics can be considered later, after the
manual loop is stable.

## Artifacts

- `dogfood-log.md`: raw observation log. Keep it lightweight and record real
  pre-edit search outcomes here.
- `src/tests/fixtures/search-eval.json`: curated search regression fixture.
  Promote only representative search-quality cases.
- `.codetrap/sessions/`: temporary notes, recaps, and candidate traps from real
  development sessions.
- `docs/codetrap-optimization-roadmap.zh-CN.md`: product direction and larger
  roadmap decisions.
- `docs/dogfood-flywheel.md`: this process spec.

## Judgments

Use the existing dogfood judgments:

- `useful_hit`: a result prevented, changed, or confirmed the next action.
- `miss`: a relevant existing trap should have appeared but did not.
- `noisy_hit`: results looked plausible but distracted from the task.
- `no_relevant_trap`: the memory bank had no applicable prior lesson.

These judgments describe the search experience. They do not automatically imply
that an observation should be promoted.

## Promotion Lanes

Every observation should get one promotion lane:

| Lane | Use when | Destination |
| --- | --- | --- |
| `search_eval` | A known existing trap should be recalled or ranked for a real query. | `src/tests/fixtures/search-eval.json` |
| `trap_candidate` | The work exposed a reusable mistake pattern with clear trigger, mistake, and fix. | `codetrap session capture --trap-markdown - --kind review --json` |
| `product_backlog` | The signal is about workflow, UX, onboarding, visibility, defaults, or release polish. | roadmap, issue, or implementation brief |
| `docs_guidance` | The signal changes how agents or users should use codetrap. | AGENTS, README, skills, or docs |
| `no_promotion` | The observation is useful raw history but should not change evals, traps, docs, or roadmap. | keep in `dogfood-log.md` |

## Promotion Rules

Promote to `search_eval` only when all are true:

- The query came from real work, not a synthetic wish list.
- The expected trap already exists in the fixture or can be copied into the
  fixture as a compact representative trap.
- `goldTrapIds` are clear.
- The behavior is worth protecting from search regressions.

Do not promote a routine `no_relevant_trap` observation to `search_eval`.
`no_relevant_trap` belongs in the fixture only when the absence of relevant
results is itself a behavior worth preserving.

Promote to `trap_candidate` when the observation reveals a durable lesson:

- The trigger is specific enough to recognize before repeating the mistake.
- The wrong behavior and preferred fix are both clear.
- The lesson would change future implementation behavior.
- The candidate can be drafted with explicit `Title`, `Context`, `Mistake`, and
  `Fix` fields.

Promote to `product_backlog` when the observation points to tool friction rather
than search quality. Examples: pending candidates are hard to notice, review
workflow is awkward, setup guidance is unclear, release preflight misses a user
path, or the web console hides the next action.

Promote to `docs_guidance` when the implementation does not need to change, but
agent or user instructions should.

Use `no_promotion` when the observation is a normal new-product task, a one-off
UI tweak, or a topic with no existing memory and no durable lesson.

## Operating Rhythm

During codetrap development:

1. Run a pre-edit search for non-trivial implementation work.
2. Review up to the top three action cards.
3. Record the observation in `dogfood-log.md`.
4. Assign one judgment and one promotion lane.
5. Promote only after deciding the destination artifact.

After a milestone or about every ten observations:

1. Count judgments and promotion lanes.
2. Inspect `miss` and `noisy_hit` observations first.
3. Promote representative search cases with:

   ```bash
   bun run eval:dogfood -- record --json '{"query":"...","mode":"hybrid","goldTrapIds":[1],"judgment":"useful_hit"}'
   ```

4. Draft trap candidates for recurring implementation mistakes with:

   ```bash
   codetrap session capture --trap-markdown - --kind review --json
   ```

5. Run:

   ```bash
   bun run eval:dogfood -- report --json
   ```

6. Update the roadmap only when observations change product priority.

## Success Signals

This flywheel is working when:

- Dogfood observations consistently include a judgment and promotion lane.
- Search eval gains only representative, high-signal cases.
- `miss` and `noisy_hit` observations lead to search-policy or fixture decisions
  instead of staying buried in the log.
- Reusable implementation mistakes become candidate traps, not ad hoc prose.
- Product friction becomes roadmap work instead of search-eval pollution.
- Eval reports stay clean, or failures point to specific search behavior to fix.

## Non-Goals

- No hidden telemetry.
- No automatic `.codetrap` mining.
- No automatic user feedback upload.
- No new public `codetrap eval` command in this iteration.
- No database schema, CLI, MCP, or Web UI changes for the process-only version.
