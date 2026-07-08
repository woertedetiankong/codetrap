# codetrap Mature Product Roadmap v2: Agent Experience Compiler

Date: 2026-06-22 (v1)
Updated: 2026-07-07 (v2)
Status: Product direction / long-term roadmap — authoritative parent plan
Scope: Parent plan for codetrap mature product evolution
Clients served: **Codex and Claude Code, symmetrically** (Cursor and others: future)

This document is the parent plan for all future codetrap development. It is written
to be consumed both by humans and by an autonomous implementing agent. Individual
milestones must use the implementation-journal (task dossier, implementation log,
handoff) — see §19.

What changed in v2:

- Added §1 First Principles: the derivation chain the whole design rests on.
- Added §4 UX Principles & Budgets: review experience is now a first-class,
  measurable part of the product, with numeric budgets.
- **Dual-client symmetry (Codex + Claude Code) promoted to a hard requirement** (§3.1).
  v1 was implicitly Codex-first; that assumption is removed everywhere.
- **Evolution path re-sequenced** (§16): the empirical proof point now comes FIRST
  (Phase 0), before any schema stabilization. Evidence before architecture.
- Added §13 Multi-Client Engineering Requirements derived from a competitor case
  study (mempal): session-store concurrency locking, self-describing MCP protocol,
  per-client doctor, candidate provenance and cross-client dedup.
- Added §14 External Validation: a public benchmark is now a roadmap item.
- Added §15 Anti-Goals with rationale (notably: no inter-agent message bus).
- Resolved the v1 design tension in the coverage check (§9.3): coverage judgment is
  agent-assisted; the CLI verifies references deterministically.
- Consolidated the trust red lines into one section (§3.2) instead of repeating
  them in every chapter.
- MVP destination subset defined: `pitfall_trap` + `skip` end-to-end first; all
  other destinations remain proposal-only stubs until Phase 2 (§11).

---

## 0. How to Use This Document (for the implementing agent)

If you are an AI agent implementing this roadmap:

1. Work the phases in §16 **in order**. Do not skip Phase 0. Do not begin
   stabilizing schemas or building the Web inbox before Phase 0's acceptance
   criteria are met and recorded.
2. For each milestone, create a task dossier under
   `docs/tasks/<YYYY-MM-DD>-<slug>/` per §19. One dossier per milestone.
   Do not create process artifacts about process artifacts.
3. Every red line in §3.2 is a hard constraint on every phase. If a task appears
   to require crossing one, stop and surface it to the user instead.
4. Every user-visible claim you add to README or templates must be true of the
   shipped code in the same release (§3.3).
5. When this document and reality diverge, update this document with status and
   evidence links only — do not fork the plan into new standalone vision docs.

---

## 1. First Principles

### 1.1 The irreducible problem

AI coding agents repeat mistakes across sessions and projects because what they
learn is not persisted in a form that changes future behavior. Raw history
(sessions, transcripts, summaries) is abundant but inert; guardrails are scarce
but active. The product converts one into the other.

### 1.2 What makes a lesson actually change behavior

A stored lesson changes a future agent action only if all four hold:

```text
1. Trigger   — it is recalled at the right moment (pre-flight, on-topic).
2. Action    — it prescribes what to do differently, not just what happened.
3. Injection — a runtime path actually delivers it to the agent (search hit,
               guidance file, skill, automation).
4. Trust     — it is true, current, evidenced, and human-approved, so both the
               user and the agent can rely on it.
```

Anything that fails one of these is a note, not a guardrail. The candidate
quality bar (§8.4), the destinations model (§11), and runtime eligibility (§12)
are all direct consequences of this list.

### 1.3 The two scarce resources

Everything codetrap does economizes two scarce resources:

```text
1. User attention   — review bandwidth. Every candidate surfaced spends it.
2. Agent context    — injection token budget. Every runtime guardrail spends it.
```

Raw history is free; these two are not. Therefore:

- Signal-to-noise of the candidate stream is THE core product metric.
- A high-precision small trap database beats a large polluted one.
- `skip` is a first-class product outcome, not a failure: it is how the system
  buys back user attention on every future review.
- An overflowing review inbox is a product failure equal to a missed lesson.

### 1.4 Division of labor (compiler, not brain)

Judging "what was learned" from messy history is probabilistic — that is LLM
work, and it belongs to the agent (Codex, Claude Code). Validating structure,
evidence, duplication, and gating durable writes is deterministic — that is
compiler work, and it belongs to the codetrap CLI.

```text
Agent / Skill:   understands real work history, drafts candidates.
codetrap CLI:    evidence, schema, validation, dedup, staging, write gates.
Web Inbox:       human review and approval.
Destinations:    make confirmed experience influence the next agent action.
```

Trust requires the deterministic layer to gate the probabilistic one, never the
reverse. The CLI must not hardcode learning judgment (no keyword rules like
"session contains 'test failed' → auto-create trap"); the agent must not be able
to bypass schema validation or the durable write gate.

### 1.5 The riskiest assumption — evidence before architecture

The single assumption the entire flywheel rests on:

```text
An agent mining real work history can produce lesson candidates that a real
user actually accepts, at a rate that justifies the review time.
```

This is unproven. It is also cheap to test (§16 Phase 0) and has a written
falsifier (§17). Therefore the roadmap sequences the empirical test BEFORE
stabilizing data models, building the Web inbox, or wiring destinations.
If the falsifier fires, the correct response is to strengthen evidence packs,
coverage checks, and quality scoring — not to build more architecture.

### 1.6 One-line positioning

```text
codetrap compiles real coding-agent work history into human-approved guardrails.
```

Fuller form:

```text
codetrap mines real coding-agent work history, lets agents draft reusable
lessons, validates those lessons with evidence and coverage checks, lets humans
approve what becomes durable, and injects approved lessons back into future
agent work as traps, project guidance, skills, custom agents, automations,
evals, docs updates, or reviewed skips.
```

---

## 2. Product Positioning and Boundaries

codetrap should not stop at being a "failure log repository," nor bloat into a
general-purpose agent memory platform. Its mature form is a local-first,
agent-assisted, human-approved **Agent Experience Compiler**.

The mature flywheel:

```text
real work history
  -> agent-native discovery
  -> LessonCandidate drafting
  -> codetrap compiler validation, dedup, staging
  -> Web Learning Inbox review
  -> user confirmation into the right destination
  -> runtime guardrails
  -> next agent is smarter
```

Key boundaries:

- codetrap does not own all raw history; it owns experience that is reviewable,
  durable, and actionable.
- codetrap does not cram every experience into `traps.db`.
- codetrap does not replace the semantic judgment of agents.
- `.codetrap/sessions` is a candidate and review workspace, not the sole source
  of experience discovery.
- Automation covers discovery, clustering, drafting, triage, validation, and
  staging; final durability is always confirmed by the user.

---

## 3. Hard Requirements

### 3.1 Dual-client symmetry: Codex + Claude Code

codetrap serves Codex and Claude Code as **co-equal first-class clients**. Any
feature, doc, or example that assumes Codex-only is a defect. Concretely:

| Concern | Codex | Claude Code |
|---|---|---|
| Setup command | `codetrap setup codex` | `codetrap setup claude` (to build) |
| Skills / entry points | `~/.codex/skills` bundle | Claude Code plugin skills / slash commands (to build) |
| Project guidance | `AGENTS.md` (template append) | `CLAUDE.md` (same template) |
| History source (pull mode) | Codex local sessions, task/rollout summaries | `~/.claude/projects/<slug>/` JSONL transcripts |
| Agent-native sources | Codex Memories | Claude Code session summaries / memory dir |
| MCP | optional, same server | optional, same server (`.mcp.json`) |
| Doctor checks | per-client integration health | per-client integration health |

Symmetry rules:

- One CLI contract; two thin client adapters. Adding a third client later must
  not require touching the compiler layer.
- The packaged template (`plugins/codetrap-agent/templates/AGENTS.codetrap.md`)
  remains the single source of truth for agent guidance in both clients.
- The learning-review entry point exists in both clients
  (`$codetrap-learning-review` as a Codex skill AND as a Claude Code
  skill/command) and both delegate to the identical CLI commands.
- The shared behavioral contract is additionally embedded in the MCP server's
  initialize instructions (§13.2), so a client that only speaks MCP still
  learns the workflow without per-client prompt configuration.

### 3.2 Trust red lines (consolidated — apply to every phase)

Explicit trigger only:

- Learning review runs only when the user explicitly triggers it (skill
  invocation, CLI command, Web button, explicit MCP call).
- No agent auto-scanning of history during ordinary coding tasks. No background
  scanning by the CLI. No silent reads on Web open. No implicit MCP escalation
  from ordinary search into learning review.

Dry-run by default; no durable write before user confirmation:

- Generating candidates and reports: allowed.
- Writing confirmed traps, editing AGENTS/CLAUDE guidance, installing skills,
  creating custom agents, enabling automations, merging eval fixtures: only
  after explicit per-item user confirmation, each with a visible diff and a
  rollback path.
- `accepted` does not equal runtime injection. Only lessons merged into a
  durable destination in a runtime-eligible state may influence agent behavior.

Privacy and evidence:

- Do not copy full session transcripts into codetrap. Store source manifest,
  evidence pointers, short excerpts, hashes, dates, and necessary metadata.
- Sensitive or external sources require redaction and explicit confirmation.

### 3.3 Documentation accuracy invariant

Every release, the README command table, directory structure, MCP tool list,
and install instructions must be true of the shipped code. Template files are
the single source of truth; README points to them. Rationale: the leading
competitor (mempal) ships a README whose install command references a crate
layout that does not exist and understates its own tool count by 2x —
documentation rot destroys exactly the user trust this product sells.
codetrap's current README accuracy is a competitive asset; it is now an
invariant, verified in release preflight.

### 3.4 Process discipline cap

One task dossier per milestone (§19). No specs about specs, no audits of
audits. If a proposed document does not change what gets built or how it is
verified, do not write it. (Competitor cautionary tale: 112 numbered specs of
which three are separate "completion audits" of the same completion.)

---

## 4. UX Principles and Budgets

The review experience IS the product. If review feels like data entry, the
flywheel stops regardless of how good the mining is.

### 4.1 The user is approving learning, not entering data

- Candidate cards lead with the human question: "should the agent behave
  differently next time, and how?" — not with JSON fields.
- Progressive disclosure: shortlist → card → evidence drill-down on demand.
  Low-context card first; never force reading raw evidence to make an obvious
  call.
- Every card states its recommended destination and why, so the default action
  is one click, and editing is the exception.

### 4.2 Numeric UX budgets (test against these)

```text
Time-to-first-value:      < 10 minutes from install to first useful pre-flight
                          search hit or first accepted lesson.
Review batch:             10 candidates reviewable in < 5 minutes by a user
                          familiar with the project.
Triage actions:           accept / edit / skip / reject reachable in one
                          keystroke or one click from the card.
Inbox cap:                soft cap ~30 pending candidates; beyond it, new
                          reviews warn and suggest triage first.
Staleness:                pending candidates untouched for 60 days are
                          auto-marked stale (needs_more_evidence), never
                          silently deleted.
Learning review runtime:  a 30-day pull-mode review completes in minutes, not
                          hours; long steps stream progress.
```

These budgets are acceptance criteria for the Web inbox and skill UX phases,
not aspirations.

### 4.3 Trust receipts

After every learning review and every review session, show a receipt:

```text
staged: N candidates    skipped: M (reasons archived)
durable writes: 0 (nothing was written to traps.db, guidance, skills,
agents, automations, or evals)
```

The §16 Phase 0 red-line verification generalizes into this permanent UI
element. Users should never have to wonder whether something was silently
written; the product tells them, every time.

### 4.4 Inbox hygiene is a feature

- `skip` archives carry a reason and suppress re-proposal of the same lesson.
- Duplicate candidates are merged or superseded at staging time, not surfaced
  twice for the user to notice.
- The inbox is empty-able: a user who processes all cards reaches a genuine
  "inbox zero" state, with stale items parked out of view.
- Silence beats noise: when mining finds nothing above the quality bar, the
  correct output is "nothing worth your review" plus skips — never filler
  candidates to look productive.

### 4.5 Setup and doctor UX

- `codetrap setup codex` / `codetrap setup claude`: one command per client,
  idempotent, self-healing on re-run after upgrade (safe to re-run always).
- `codetrap doctor` reports per-client integration health: skill installed?
  guidance appended and current? MCP registered? MCP server version matches
  CLI binary version? (Clients spawn MCP servers at startup; after a binary
  upgrade the old server may still be running — doctor must detect and say
  "restart your client," because the failure is otherwise invisible.)
- Error messages name the fix, not just the failure.

---

## 5. Mature Product System

Six systems:

```text
1. Experience Sources
2. Agent-native Discovery
3. Lesson Candidate Layer
4. codetrap Compiler Layer
5. Learning Review Web Workbench (Learning Inbox)
6. Durable Destinations + Runtime Guardrail Injection
```

---

## 6. Experience Sources

### 6.1 First-class sources (dual-client)

Codex side:

- Codex local sessions
- Codex task summaries / rollout summaries
- Codex Memories, when the user explicitly allows access

Claude Code side:

- Claude Code local session transcripts (`~/.claude/projects/<slug>/` JSONL)
- Claude Code session summaries
- Claude Code memory directory contents, when the user explicitly allows access

Shared / codetrap-native:

- `.codetrap/sessions`
- existing traps, pending candidates
- existing skills, custom agents / subagents, automations
- AGENTS.md / CLAUDE.md / project guidance
- docs / roadmap / dogfood log / eval fixtures

### 6.2 Agent-native sources

Some context is only reliably accessible to a specific agent (memories,
internal task summaries, client-side session state). The codetrap core must not
assume it can read these directly. It supports **agent-submitted candidates**:

```text
Agent reads the history it can access
  -> drafts LessonCandidate JSON
  -> calls codetrap learn stage
  -> codetrap does schema, evidence, coverage, risk, staging
```

### 6.3 Supplementary sources

User corrections, review feedback, test/command failures, external articles /
issues / blogs / papers, and future optional integrations (GitHub Issues,
Slack, Jira, Linear, Notion). Principles:

- Reading these is for discovering experience, not bulk-importing raw history.
- For sensitive or external sources, store an evidence pointer, short excerpt,
  hash, date, and source type instead of the full text.
- Discovery-only breadth tools are for finding leads; important facts get
  confirmed in the source system.

---

## 7. Agent-Native Discovery

### 7.1 Division of labor

```text
Codex Skill / Claude Code skill or command
  -> asks the user for scope (or confirms an explicitly given scope)
  -> uses the sessions / memories / summaries that agent can access
  -> drafts candidates
  -> calls codetrap CLI to stage
```

The codetrap core owns only the stable contract.

### 7.2 Entry points (one per client, same contract)

```text
$codetrap-learning-review     (Codex skill)
/codetrap-learning-review     (Claude Code skill or slash command)
```

Both delegate to identical CLI commands and produce identical artifacts under
`.codetrap/learning/reviews/<review-id>/`.

Default parameters:

```text
source: the invoking client's own sessions (plus memories/summaries if allowed)
range: last 30 days, or all available history if shorter
limit: 10 LessonCandidates
mode: dry-run
write_durable: false
output: .codetrap/learning/reviews/<review-id>/
```

Scope handling UX:

- If the user already specified scope ("scan the last 30 days and generate 10
  candidates"), do not re-ask; state the red-line confirmation and proceed:

```text
I will read the last 30 days of <client> sessions and generate at most 10
LessonCandidates. This run is dry-run only; results go to
.codetrap/learning/reviews/<review-id>/. I will not write traps.db, not edit
guidance, not install skills, not create agents, not enable automations.
```

- If the user gave no scope, ask once, briefly (last 7 days / last 30 days
  (default) / custom dates / last N sessions).
- `allow_implicit_invocation: false` — the skill only runs when explicitly
  invoked.

### 7.3 Discovery prompt (shared core, client-specific source lists)

```text
Look back over my recent work from the requested range (default: last 30 days
or all available history if shorter) and identify reusable lessons worth
staging for codetrap review.

Use available evidence in this order:
- This client's recent sessions and task summaries.
- This client's memories / rollout summaries, when explicitly available, to
  find patterns repeated across sessions.
- Existing traps, pending candidates, AGENTS/CLAUDE guidance, skills, custom
  agents, automations, docs, and eval fixtures — so you extend what exists
  instead of duplicating it.

Look for lessons that are repeated, costly, error-prone, context-heavy, or
likely to improve future agent behavior.

Choose the smallest appropriate LessonCandidate type (see types table).
First produce a compact shortlist with: title, type, trigger, lesson,
recommended action, supporting evidence and dates, frequency/confidence,
existing coverage, risk, recommended destination, and why it is or is not
worth staging.

Stage only high-confidence missing proposals. Do not write traps.db, edit
guidance, install skills, create agents, enable automations, or merge eval
fixtures. Do not create speculative, overlapping, or overly broad assets.

Finish with: what was staged, what was deliberately skipped, what needs more
evidence, and confirmation that no durable destination was modified.
```

---

## 8. Lesson Candidate Layer

`LessonCandidate` is the concept one layer above the trap. A trap is one kind
of lesson, not the whole of it.

### 8.1 Candidate types

| Type | Applicable scenario | Recommended destination | Red line |
|---|---|---|---|
| `pitfall_trap` | repeated failure or misuse pattern | confirmed trap + evidence + lifecycle | no auto-write to `traps.db` |
| `project_convention` | stable project/team preference or boundary | AGENTS/CLAUDE guidance patch proposal | no silent guidance edits |
| `skill_candidate` | repeated workflow, SOP, reusable playbook | staged skill draft | no auto-install, no auto-trigger |
| `custom_agent_candidate` | bounded specialist role suitable for delegation | custom subagent proposal | no auto-create or enable |
| `automation_idea` | periodic check, report, reminder, monitor | automation proposal | no auto-enable, no external side effects |
| `search_eval_case` | query/recall behavior worth protecting | eval fixture proposal | no fixture pollution |
| `docs_guidance` | README/roadmap/docs/agent guidance update | docs patch proposal | no writing temporary ideas as long-term facts |
| `skip` | one-off, ambiguous, sensitive, broad, or under-evidenced | skip archive with reason | low-quality candidates must not keep reappearing |

MVP note: Phase 1 implements `pitfall_trap` and `skip` end-to-end (the trap
lane already exists in the product today). All other types are accepted by the
schema and staged as proposal stubs, but their destination workflows come in
Phase 2 (§16).

### 8.2 Minimum fields

```text
id
schema_version
title
type
status
trigger
lesson
recommended_action
evidence
source_manifest_refs
source_agent            # NEW in v2: codex | claude-code | <other>
frequency
confidence
coverage
risk
recommended_destination
runtime_eligibility
created_at
updated_at
```

`source_agent` records which client's history produced the candidate. It is
required for provenance, for cross-client duplicate detection ("both agents
learned the same lesson" must merge, not duplicate), and for per-client noise
analysis. All other field semantics as v1: `trigger` = when it should be
recalled; `lesson` = what was learned; `recommended_action` = what the agent
should do differently; `evidence` = sources, dates, snippets, refs, hashes;
`coverage` = overlap with existing traps/candidates/guidance/skills/agents/
automations/docs/evals/skips; `risk` = misuse, over-breadth, staleness,
privacy, sensitivity, external side effects; `runtime_eligibility` = whether
and when it may enter runtime recall.

### 8.3 State machine

```text
proposed -> edited -> staged -> accepted -> merged
bypass:  rejected | skipped | superseded
```

- `proposed`: generated, not yet reviewed.
- `edited`: content modified by user or agent.
- `staged`: entered a destination proposal/draft; no durable write.
- `accepted`: user accepts candidate + destination; not necessarily written.
- `merged`: written into a long-term carrier with a rollback path.
- `rejected`: not adopted.
- `skipped`: explicitly archived with a reason; suppresses repeat noise.
- `superseded`: covered by an existing or better candidate.

Key principle: `accepted` ≠ runtime injection. Only
merged/installed/enabled/fixture-accepted lessons may become runtime guardrails.

### 8.4 Quality bar

- No trigger condition → cannot become a guardrail.
- No recommended action → cannot enter runtime.
- Insufficient evidence → skip or watch, never forced durability.
- Recurrence is not required: high-cost lessons that will clearly recur qualify.
- Duplicates of existing content merge, supersede, or skip — never re-enter.
- Misuse risk exceeding benefit → must not enter runtime.
- Sensitive-source candidates require redaction and explicit confirmation.

---

## 9. codetrap Compiler Layer

### 9.1 What the CLI owns

- Source discovery for locally readable files (both clients' session dirs).
- Source manifest generation; evidence pack generation; excerpt length limits.
- Redaction / privacy checks.
- LessonCandidate schema validation.
- Coverage verification (§9.3) and duplicate detection, including
  cross-client dedup keyed on content similarity, not just IDs.
- Risk flagging; skip archive; staging review directory.
- Durable write gates.
- JSON / Web / MCP contract.

### 9.2 What the CLI must not hardcode

- Which natural-language summaries are traps / skills / automations.
- Which project files should modify guidance.
- Which candidates should enter runtime.
- Support for only one client, only the last 30 days, or only 10 entries
  (these are defaults, not limits).

### 9.3 Coverage check: agent-assisted, CLI-verified (v2 resolution)

v1 assigned "coverage check" wholly to the CLI. That contradicted "compiler,
not brain": deciding whether a candidate duplicates free-text guidance in
AGENTS.md is semantic judgment. v2 division:

```text
Agent (drafting): proposes coverage claims — "covered_by: trap #42",
                  "overlaps: AGENTS.md section 'testing'", "no coverage found".
CLI (staging):    deterministically verifies every claimed ref exists (trap
                  IDs, file paths, section anchors, candidate IDs); runs FTS/
                  hybrid similarity against existing traps and candidates and
                  attaches a ranked "possible duplicates" report; flags
                  candidates whose claims failed verification.
Web (review):     shows the coverage report; the human makes the final
                  merge / supersede / convert / reject call.
```

The CLI never silently drops a candidate on semantic-similarity grounds alone;
it stages with a duplicate warning. Deterministic verification gates; semantic
judgment advises.

### 9.4 Three review modes

Mode A — Pull (codetrap reads local sources itself):

```bash
codetrap learn review --source codex-sessions --since 30d --limit 10 --dry-run
codetrap learn review --source claude-code-sessions --since 30d --limit 10 --dry-run
```

Mode B — Agent-submitted (agent reads what only it can access, then stages):

```bash
codetrap learn stage \
  --review-dir .codetrap/learning/reviews/<review-id> \
  --candidates lesson-candidates.json \
  --source-manifest source-manifest.json \
  --validate --coverage-check --dry-run
```

Mode C — Hybrid (recommended mature form):

```text
codetrap learn evidence-pack
  -> agent drafts lesson-candidates.json
  -> codetrap learn stage --validate --coverage-check
  -> Web Learning Inbox
```

### 9.5 Command surface (drafts)

```bash
codetrap learn sources --source <codex-sessions|claude-code-sessions|...> --since 30d --json
codetrap learn evidence-pack --source <...> --since 30d --out .codetrap/learning/reviews/<id>
codetrap learn review --source <...> [--since 30d | --from D --to D | --last-sessions N] --limit 10 --dry-run
codetrap learn stage --review-dir <dir> --validate --coverage-check --dry-run
codetrap web
```

---

## 10. Learning Review Web Workbench (Learning Inbox)

Web Review upgrades from trap-only review into a Learning Inbox, honoring the
UX budgets in §4.2.

List view — enough to triage without opening the card:

```text
[type] [title] [confidence] [frequency] [evidence dates] [recommended
destination] [coverage] [risk] [status] [source_agent]
```

Detail card — progressive disclosure order:

1. Trigger, lesson, recommended action (the "what changes next time" block).
2. Recommended destination and rationale; coverage report; risk notes.
3. Evidence drill-down (excerpts, dates, source manifest) on demand.

User actions: accept / edit / merge / supersede / convert type / reject /
skip-as-one-off / stage proposal. Confirmation strength scales with destination
side effects:

```text
pitfall_trap:           accept -> confirmed trap proposal -> confirm -> traps.db
project_convention:     accept -> guidance patch proposal -> review diff -> merge
skill_candidate:        accept -> staged skill draft -> explicit install
custom_agent_candidate: accept -> agent proposal -> explicit create/enable
automation_idea:        accept -> automation proposal -> explicit enable
search_eval_case:       accept -> eval fixture proposal -> explicit merge
docs_guidance:          accept -> docs patch proposal -> review diff -> merge
skip:                   accept skip -> archive reason -> suppress noise
```

UX principles: one unified entry, different destinations; review in one place,
never ingest into one place; the bigger the side effect, the more explicit the
confirmation; every durable write has a diff, a confirmation, and a rollback
path; end every session with the trust receipt (§4.3).

---

## 11. Durable Destinations

| Candidate | Durable destination | User confirmation | Rollback path | Phase |
|---|---|---|---|---|
| `pitfall_trap` | `traps.db` confirmed trap + evidence + lifecycle | required | delete / supersede / lifecycle status | **1 (MVP)** |
| `skip` | skip archive with reason | accept skip | unskip / reopen | **1 (MVP)** |
| `project_convention` | AGENTS/CLAUDE guidance patch | review diff | revert patch | 2 |
| `docs_guidance` | docs patch proposal | review diff | revert patch | 2 |
| `search_eval_case` | eval fixture proposal | merge fixture | remove fixture / mark obsolete | 2 |
| `skill_candidate` | staged skill draft | explicit install | remove / disable skill | 3 |
| `custom_agent_candidate` | custom subagent config draft | explicit create/enable | disable / remove agent | 3 |
| `automation_idea` | automation proposal | explicit enable | disable automation | 3 |

Until a destination's workflow ships, its candidates stage as proposal stubs
that the inbox can display, edit, and skip — they never dead-end or silently
drop.

---

## 12. Runtime Guardrail Injection

Confirmed experience must influence the next agent job; otherwise it is notes.

### 12.1 Injection paths (per client where they differ)

- Confirmed `pitfall_trap` → pre-flight search (`codetrap search --json`),
  identical in both clients; surfaced via skills/guidance instructing pre-edit
  checks, and via MCP `search_traps` for MCP-configured clients.
- Confirmed `project_convention` → AGENTS.md (Codex) / CLAUDE.md (Claude Code),
  from the same approved patch.
- Confirmed `skill_candidate` → installable in the client's native skill
  format (Codex skill dir / Claude Code plugin skill).
- Confirmed `custom_agent_candidate` → client's native subagent format.
- Confirmed `automation_idea` → runs only after user approval.
- Confirmed `search_eval_case` → protects retrieval quality in evals.
- `skip` records → suppress repeated noise.

Note: hook-based injection (e.g., auto-prepending trap search results on prompt
submit) is deliberately NOT on the roadmap. The competitor's experience shows
hook integrations are operationally brittle (multi-artifact installs, client
feature flags, restart requirements). Skills + guidance + MCP cover the need
with far less fragility. Revisit only with strong user demand, as opt-in.

### 12.2 Runtime eligibility

```text
runtime_eligibility: never | after_acceptance | after_durable_merge | manual_only
```

Defaults:

```text
pitfall_trap: after_durable_merge         project_convention: after_durable_merge
skill_candidate: manual_only until installed
custom_agent_candidate: manual_only until enabled
automation_idea: manual_only until enabled
search_eval_case: never (runtime) / yes (eval protection)
docs_guidance: after_durable_merge        skip: never (runtime) / yes (suppression)
```

---

## 13. Multi-Client Engineering Requirements (v2, from competitor case study)

These are engineering prerequisites for two agents sharing one codetrap store.
The competitor (mempal) hit each of these in production; codetrap adopts the
lessons before, not after, the incident.

### 13.1 Concurrency safety for shared state

With Codex and Claude Code both active, concurrent writes are a normal
scenario, not an edge case.

- Database layer: SQLite WAL + busy_timeout already handle `traps.db`
  contention; add regression tests for simultaneous CLI/MCP writes.
- **Session/file layer (the actual gap): `.codetrap/sessions/` active-state,
  index, candidate inbox, and `.codetrap/learning/` review dirs are plain
  files with no locking.** Two agents capturing simultaneously can interleave
  and lose candidates. Requirement: per-resource advisory file locks around
  read-modify-write critical sections (short timeout + retry with jitter;
  lock-wait surfaced in JSON output for observability), plus tests that
  exercise two concurrent `session capture` / `learn stage` invocations.
- Dry-run paths take no locks (no writes, no race).

### 13.2 Self-describing MCP protocol

Embed the codetrap usage contract in the MCP server's initialize instructions:
when to run pre-flight search, how to capture candidates, that accept/reject
stays with the human, and that learning review is explicit-trigger-only. Any
MCP client then learns the workflow with zero per-client prompt configuration.
This is the single cheapest mechanism for keeping two (later N) clients
behaviorally consistent, and it complements — never replaces — the guidance
templates.

### 13.3 Per-client doctor

`codetrap doctor` extends to per-client integration checks (§4.5): skill
presence and version, guidance file presence and template currency, MCP
registration, and CLI-binary vs running-MCP-server version match with a
"restart your client" hint on mismatch.

### 13.4 Provenance and cross-client dedup

`source_agent` on every candidate (§8.2); staging-time similarity check merges
"same lesson, two clients" into one candidate with combined evidence rather
than two inbox entries (§9.3). Accepted-trap evidence records which client's
history produced it.

---

## 14. External Validation

An internal eval harness (Recall@5 / MRR on `search-eval.json`) already
protects retrieval quality. What is missing is a **publicly legible benchmark**
— the competitor's published LongMemEval numbers are its most credible asset,
and codetrap currently has no equivalent artifact.

Roadmap item (Phase 2, after the flywheel is proven):

- Publish a reproducible retrieval benchmark: methodology, dataset (public or
  released), scripts, and honest numbers including weak configurations.
- Additionally publish flywheel metrics from real usage once available:
  candidates proposed vs accepted vs skipped, and precision of the trap
  database over time. Acceptance rate is this product's true north metric —
  more honest than retrieval scores alone.

---

## 15. Anti-Goals

Explicitly not doing, with rationale:

- **No inter-agent message bus / cowork channel.** With two clients it is
  tempting to make codetrap the coordination layer between them. The
  competitor spent 18 spec cycles on inbox/tmux/presence/ack machinery bound
  to fragile client internals (feature flags, hook artifacts, restart
  semantics). codetrap's dual-client story is a **shared experience store**:
  both agents read and contribute to the same traps and candidate inbox —
  asynchronous collaboration within a contract codetrap fully controls.
- No general chat memory store; no whole-codebase RAG.
- No bulk-importing session text into the codetrap database.
- No background scanning; no auto-writes of any durable destination (§3.2).
- No hook-based runtime injection (rationale in §12.1).
- No saving generic knowledge, motivational summaries, or marketing copy as
  guardrails; no low-confidence candidates in runtime recall.
- No client-specific capability hardcoded as the sole entry of the core.
- No process artifacts that do not change what gets built (§3.4).

---

## 16. Evolution Path (v2 — re-sequenced: evidence before architecture)

Each phase has acceptance criteria; a phase is done when they are recorded in
its dossier, not when its code merges.

### Phase 0 — Proof point (FIRST; before any schema stabilization)

Run the riskiest-assumption test (§1.5) with minimal machinery: a hand-rolled
discovery prompt per client, candidates as plain JSON files, review as a
markdown checklist or the existing web console. No new schemas, no new CLI
subcommands, no inbox UI.

```text
Run once per client (this is also the first dual-client symmetry test):
  Codex:       last 30 days of Codex sessions -> up to 10 LessonCandidates
  Claude Code: last 30 days of Claude Code sessions -> up to 10 LessonCandidates

Measure:
  - acceptance: user willing to accept/edit/stage >= 3 of 10 per client
  - actionability: each accepted candidate names the behavior change it causes
  - cross-client overlap rate (how many lessons appear from both histories —
    calibrates the dedup requirement)
  - review time per 10 candidates (calibrates the §4.2 budget)

Red-line verification (trust receipt):
  0 writes to traps.db before confirmation; 0 guidance edits; 0 skill installs;
  0 agent creations; 0 automation enables; 0 fixture changes.
```

If acceptance fails → §17 falsifier response: strengthen evidence packs,
coverage, quality scoring; do NOT proceed to Phases 1-3 architecture.

### Phase 1 — MVP compiler loop (pitfall_trap + skip, both clients)

- Product language: `LessonCandidate` concept documented; existing
  CandidateTrap is the `pitfall_trap` subset; old trap review keeps working.
- Schema (informed by Phase 0 data, including `source_agent`), validation,
  evidence refs, source manifest, staging dirs.
- `codetrap learn sources | evidence-pack | review | stage` for BOTH
  `codex-sessions` and `claude-code-sessions` pull modes + agent-submitted
  mode.
- `codetrap setup claude` + Claude Code skill/command; Codex skill updated to
  the shared contract; MCP initialize instructions carry the contract (§13.2).
- Session/learning file locking + concurrent-write tests (§13.1) — lands
  before both clients are told to use the loop routinely.
- Coverage: agent-claimed, CLI-verified, similarity-advised (§9.3).
- Inbox v1: list + card + accept/edit/skip/reject for pitfall_trap and skip;
  trust receipt; UX budgets measured.

Acceptance: a user on a real project runs learning review from either client,
reviews in the inbox within budget, accepts >= 1 trap that later surfaces in a
pre-flight search from the other client. Doctor passes per-client checks.

### Phase 2 — Low-risk destinations + external validation

- `project_convention` and `docs_guidance` patch-proposal workflows (diff,
  confirm, revert); `search_eval_case` fixture proposals.
- Cross-client dedup hardened with Phase 1 real data.
- Public benchmark + flywheel metrics published (§14).

Acceptance: a convention accepted in the inbox lands as an identical approved
patch in AGENTS.md and CLAUDE.md; benchmark repo/scripts public.

### Phase 3 — High-side-effect destinations + runtime loop closure

- `skill_candidate`, `custom_agent_candidate`, `automation_idea` workflows
  with explicit install/enable and rollback.
- Runtime feedback evidence: accepted lessons observed changing subsequent
  agent behavior in both clients; "the more I use it, the better it
  understands me" is demonstrable, not aspirational.

Acceptance: at least one lesson per destination type merged and later
referenced or triggered in real subsequent work.

---

## 17. Falsifier

If most candidates mined from real history are: vague triggers, unclear
actions, insufficient evidence, generic summaries, duplicates, unwanted by the
user, unable to change next-agent behavior, riskier than beneficial, sensitive
without redaction, or unauditable — then automatic experience mining is not yet
mature. Response: strengthen semi-automatic capture, evidence packs, coverage
checks, quality scoring, skip archive, and inbox UX. Do not push automatic
mining or automatic durable writes. Do not build more architecture to
compensate for weak candidate quality.

---

## 18. Mature Product Success Criteria

- After real use of Codex and Claude Code, codetrap proposes evidence-backed
  candidates from either client's history, and at least some clearly change
  future agent behavior.
- The trap database stays high-precision; the Learning Inbox is the user's
  main entry for managing agent experience and respects the §4.2 budgets.
- Confirmed experience flows back into the next agent job in both clients from
  a single approval.
- High-side-effect destinations all have explicit confirmation and rollback.
- The skip archive measurably reduces repeated noise.
- The user feels "the more I use it, the better it understands me" while
  trusting — via ever-present receipts — that nothing is silently read,
  written, installed, or enabled.

---

## 19. Implementation Journal Protocol

Any milestone implementing this document:

1. Treat this document as the parent plan.
2. Write the slice in `docs/tasks/<YYYY-MM-DD>-<slug>/task-brief.md`.
3. Keep an `implementation-log.md` for decisions affecting the product model,
   data model, Web review, or CLI/MCP/skill contract.
4. End each phase with `handoff.md`: capability layer completed; red lines
   honored (with the trust-receipt evidence); source manifest and evidence
   traceability; coverage check status; measured UX budgets where applicable;
   next highest-ROI task.
5. Write back to this document only status and evidence links, never
   implementation detail. One dossier per milestone; no meta-process documents
   (§3.4).

Suggested task slugs:

```text
phase0-dual-client-proof-point
lesson-candidate-model
learning-review-cli-dual-source
setup-claude-and-skill-parity
session-store-concurrency-locks
mcp-self-describing-contract
learning-inbox-web-mvp
coverage-agent-claimed-cli-verified
convention-and-docs-destinations
public-retrieval-benchmark
skill-agent-automation-destinations
runtime-feedback-evidence
```

---

## 20. Minimal Executable Summary

One sentence:

```text
codetrap does not remember everything itself, nor judge for the agent; it
compiles the experience agents propose from real work history into reviewable,
traceable, dedupable, durable, and reinjectable guardrails — for Codex and
Claude Code symmetrically.
```

Minimal architecture:

```text
$codetrap-learning-review (Codex) / /codetrap-learning-review (Claude Code)
  -> confirm scope + red lines
  -> agent-native discovery
  -> LessonCandidate shortlist (source_agent tagged)
  -> codetrap learn stage --validate --coverage-check --dry-run
  -> Web Learning Inbox (trust receipt)
  -> user-approved durable destination (diff + rollback)
  -> runtime guardrail in both clients
```

Minimal proof point (Phase 0):

```text
last 30 days of Codex sessions AND last 30 days of Claude Code sessions
  -> up to 10 LessonCandidates each
  -> >= 3 per client the user accepts/edits/stages
  -> 0 unconfirmed durable writes (receipt shown)
  -> >= 1 accepted lesson later referenced in the other client's work
```
