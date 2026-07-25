# codetrap Mature Product Roadmap v2.3: Agent Experience Compiler

Date: 2026-06-22 (v1)
Updated: 2026-07-25 (v2.3)
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
- MVP subset defined: `pitfall_trap` end-to-end plus a user-visible `skip`
  action recorded as a suppression decision, not a candidate type (§8, §11).

What changed in v2.1 after execution review:

- Clarified authority vs execution: the user authorizes durable writes; an
  agent may execute the approved write on the user's behalf. codetrap is an
  auditable local workflow, not an adversarial security boundary.
- Split candidate kind, review decision, and delivery state; removed `skip`
  from the candidate-type ontology and resolved the existing `accepted`
  migration collision.
- Reconciled dedup: exact duplicate revisions may consolidate mechanically;
  semantic similarity only groups candidates for human judgment.
- Strengthened Phase 0 with conclusive-run rules, separate decision metrics,
  privacy/yield measurements, repeat sampling, and downstream-use evidence.
- Split Phase 1 into five sequential vertical slices and delayed speculative
  destination schemas until real evidence supports them.
- Moved the public benchmark after longitudinal flywheel validation.

What changed in v2.2 after a retrieve-vs-curate review:

- Added **user-curated context packs** as a first-class runtime delivery mode
  (§12), alongside agent-initiated pre-flight recall. Retrieval catches
  unknown-unknowns (the pitfall the user already forgot); curation serves
  known-knowns (context the user deliberately loads while writing a PRD or
  requirement). Neither replaces the other.
- Reframed "outdated recall" as a **currency/staleness** problem fixed in the
  lifecycle layer (§12.3), not a reason to remove retrieval.
- Added a Phase 0 measurement (§16) comparing curated feeding against pre-flight
  recall, so the retrieve-vs-curate question is settled by evidence per the §17
  falsifier discipline rather than by assumption.

What changed in v2.3 after a two-consumers review:

- Added §1.7 **Two consumers, two read-paths**: the compiled store serves the
  next agent run AND the user's own expertise. Same substrate; opposite
  attention economics — triage stays fast (§4.2), study is deliberate (§10).
  Product name and positioning unchanged; repositioning is an evidence decision
  after Phase 0–2 usage, not an assumption.
- Added `rationale` (the causal why) to the candidate envelope (§8.2) before
  Phase 1B freezes it: agents need the action; the user's expertise loop needs
  the model.
- Added the `insight` kind and **insight shelf** (§8.1, §10, §11): lessons with
  real understanding but no agent-actionable trigger/action route to a study
  shelf (Phase 2) instead of suppression. Never runtime-eligible; evidence
  still required. Until Phase 2 they ride as `unclassified` with an insight
  `destination_hint`.
- Made the destination-matching ladder explicit (§11): guidance files are the
  carrier of last resort for the genuinely unconditional; situational lessons
  are traps, workflows are skills, mechanizable lessons graduate to
  deterministic checks (§12.3).
- Scheduled v2.2's unscheduled promises: curated context-pack export lands in
  Phase 1E; §12.3 currency mechanics (`last_validated`, stale down-ranking,
  graduation) land in Phase 2.
- Corrected v2.2's overstatement that Phase 0 "settles" retrieve-vs-curate:
  Phase 0 yields an early signal; the decision rule runs on Phase 1–2 usage
  data (§16 Phase 2).
- Deferred spaced-repetition/digest machinery until the study surface exists
  and sees real use; the inbox is never slowed to force learning (§15).

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
4. Trust     — it is true, current, evidenced, and human-authorized, so both the
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
- User-visible `skip` is a first-class product outcome, not a failure. In the
  domain model it is a `suppressed` review decision with a reason and
  fingerprint; this is how the system buys back attention on future reviews.
- An overflowing review inbox is a product failure equal to a missed lesson.
- Triage attention is a cost to minimize; study attention (§1.7) is an
  investment the user chooses to make. The budgets govern the former and never
  force the latter.

### 1.4 Division of labor (compiler, not brain)

Judging "what was learned" from messy history is probabilistic — that is LLM
work, and it belongs to the agent (Codex, Claude Code). Validating structure,
evidence, duplication, and gating durable writes is deterministic — that is
compiler work, and it belongs to the codetrap CLI.

```text
Agent / Skill:   understands real work history, drafts candidates.
codetrap CLI:    evidence, schema, validation, dedup, staging, write gates.
Web Inbox:       human review and approval.
Destinations:    make committed experience influence the next agent action.
```

Trust requires the deterministic layer to gate the probabilistic one, never the
reverse. The CLI must not hardcode learning judgment (no keyword rules like
"session contains 'test failed' → auto-create trap"). Every supported durable
write path must pass schema validation and carry explicit user authorization.
The executor may be the user, Web UI, CLI, or an agent acting on the user's
instruction; execution authority is not learning authority.

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
codetrap compiles real coding-agent work history into human-authorized,
agent-executable guardrails.
```

Fuller form:

```text
codetrap mines real coding-agent work history, lets agents draft reusable
lessons, validates those lessons with evidence and coverage checks, lets humans
authorize what becomes durable, and injects committed lessons back into future
agent work as traps, project guidance, skills, custom agents, automations,
evals, docs updates, or reviewed suppressions.
```

### 1.7 Two consumers, two read-paths

The compiled store serves two consumers with opposite attention economics:

```text
1. The next agent run   — delivery must be precise, conditional, and cheap in
                          context (§1.3). Review is triage; the §4.2 budgets
                          keep it fast.
2. The user's expertise — in the AI era the durable human skills are judgment,
                          system knowledge, and problem framing. Each committed
                          lesson is a compressed unit of judgment about where
                          this system bites; studying the store is how the user
                          builds depth instead of supervising everything and
                          internalizing nothing.
```

Same substrate, two read-paths, two speeds. The inbox is never slowed down to
force learning; the study surface (§10) is never optimized down to one-click
emptiness. Review asks "is this true and worth keeping?"; study asks "do I
understand why?". The review moment stays substantive — the user as arbiter of
what is true is itself the judgment practice that builds expertise — but the
tool only supplies the material and the moment; the practice belongs to the
user.

Positioning follows the evidence discipline (§1.5): the product remains the
Agent Experience Compiler. Whether the human-growth loop deserves the marquee
is decided by real Phase 0–2 usage, not by renaming first.

---

## 2. Product Positioning and Boundaries

codetrap should not stop at being a "failure log repository," nor bloat into a
general-purpose agent memory platform. Its mature form is a local-first,
agent-assisted, human-authorized **Agent Experience Compiler**.

The mature flywheel:

```text
real work history
  -> agent-native discovery
  -> LessonCandidate drafting
  -> codetrap compiler validation, dedup, staging
  -> Web Learning Inbox review
  -> user authorization for the right destination
  -> user or agent executes the authorized write
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
  staging; final durability is always authorized by the user and may be
  executed by the user or an instructed agent.

---

## 3. Hard Requirements

### 3.1 Dual-client symmetry: Codex + Claude Code

codetrap serves Codex and Claude Code as **co-equal first-class clients**. Any
feature, doc, or example that assumes Codex-only is a defect. Concretely:

| Concern | Codex | Claude Code |
|---|---|---|
| Setup command | `codetrap setup codex` | `codetrap setup claude` (shipped 2026-07-10) |
| Skills / entry points | `~/.codex/skills` bundle | `~/.claude/skills` bundle (shipped 2026-07-10; `/codetrap-learning-review` command comes with Phase 1) |
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

> **Status (2026-07-10):** the setup/skills symmetry rows above are shipped —
> one setup core (`src/lib/client-setup.ts`), one skill bundle, one guidance
> template; §13.2 and §13.3 are also shipped. Evidence:
> `docs/tasks/2026-07-10-setup-claude-and-skill-parity/`. The learning-review
> entry points and history-source rows remain Phase 0/1 work.

### 3.2 Trust and authorization red lines (apply to every phase)

Explicit trigger only:

- Learning review runs only when the user explicitly triggers it (skill
  invocation, CLI command, Web button, explicit MCP call).
- No agent auto-scanning of history during ordinary coding tasks. No background
  scanning by the CLI. No silent reads on Web open. No implicit MCP escalation
  from ordinary search into learning review.

Dry-run by default; no durable write before user authorization:

- Generating candidates and reports: allowed.
- Writing confirmed traps, editing AGENTS/CLAUDE guidance, installing skills,
  creating custom agents, enabling automations, merging eval fixtures: allowed
  only after explicit user authorization for one candidate or an explicitly
  enumerated batch. The executor may be an agent acting on that instruction.
- Authorization binds to a candidate revision and destination proposal. If the
  material content or destination changes, authorization is invalidated and
  must be renewed.
- Every durable action shows the proposed result or diff, records an audit
  receipt (`authorized_scope`, candidate revision/hash, destination, executor,
  timestamp), and has a rollback path.
- `approved` does not equal runtime injection. Only lessons committed into a
  durable destination in a runtime-eligible state may influence agent behavior.

Security boundary statement:

- codetrap is a local workflow, validation, and audit boundary. It does not
  claim to distinguish a human from an agent that has the same OS account and
  unrestricted CLI/database access.
- The product prevents accidental and unsupported writes in its recommended
  CLI/Web/MCP flows; it does not claim to contain a malicious same-user agent.
- Direct maintenance escape hatches, if retained, must be documented as such
  and leave an explicit audit record rather than being described as impossible.

Privacy and evidence:

- Do not copy full session transcripts into codetrap. Store source manifest,
  evidence pointers, short excerpts, hashes, dates, and necessary metadata.
- Sensitive or external sources require redaction and explicit authorization.
- Source readers default to explicit allowed roots, do not follow symlinks out
  of those roots, ignore binary/generated/ignored files, and report every root
  and file count in the source manifest.
- Secret detection and redaction are best-effort safeguards, never a proof that
  content is safe. Evidence previews remain visible before staging.
- Review artifacts have an explicit retention/delete workflow; deleting a
  review removes stored excerpts while preserving only non-sensitive audit
  metadata required for durable destinations.

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
                          search hit or first approved lesson.
Review batch:             10 candidates reviewable in < 5 minutes by a user
                          familiar with the project.
Triage actions:           approve / edit / skip (records `suppressed`) / reject
                          reachable in one keystroke or one click from the card.
Inbox cap:                soft cap ~30 pending candidates; beyond it, new
                          reviews warn and suggest triage first.
Staleness:                pending candidates untouched for 60 days are
                          auto-marked stale (needs_more_evidence), never
                          silently deleted.
Learning review runtime:  a 30-day pull-mode review completes in minutes, not
                          hours; long steps stream progress.
Evidence card budget:     <= 3 excerpts by default, each <= 500 characters;
                          additional evidence is progressive disclosure.
Evidence pack budget:     target <= 80 KB UTF-8 per 10-candidate batch
                          (roughly 20k tokens); overflow is chunked and reported.
```

These budgets are acceptance criteria for the Web inbox and skill UX phases,
not aspirations. Every run reports source files/bytes, packed bytes, candidate
yield, elapsed time, and any external model/API cost initiated by codetrap.
They govern triage surfaces only; the study surface (§10) is exempt by design —
deliberate attention there is the point, not a cost (§1.7).

### 4.3 Trust receipts

After every learning review and every review session, show a receipt. A dry-run
example:

```text
staged: N candidates    suppressed: M (user-facing action: skip)
durable writes: 0 (nothing was written to traps.db, guidance, skills,
agents, automations, or evals)
```

An authorized write receipt additionally records the candidate revision/hash,
authorized item or batch, destination, executor (`user` or `agent`), and
rollback command/path. The receipt asserts recorded workflow facts, not the
identity of a same-OS-account actor.

The §16 Phase 0 red-line verification generalizes into this permanent UI
element. Users should never have to wonder whether something was silently
written; the product tells them, every time.

### 4.4 Inbox hygiene is a feature

- User-visible `skip` records a `suppressed` decision with a reason and stable
  fingerprint, suppressing re-proposal of the same lesson.
- Exact duplicate revisions may consolidate mechanically while preserving all
  provenance. Semantically similar candidates are grouped at staging time and
  shown as one review cluster; only the user decides merge or supersede.
- The inbox is empty-able: a user who processes all cards reaches a genuine
  "inbox zero" state, with stale items parked out of view.
- Silence beats noise: when mining finds nothing above the quality bar, the
  correct output is "nothing worth your review" plus suppression counts —
  never filler candidates to look productive.

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
  candidates"), do not re-ask; state the red-line authorization rules and proceed:

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
likely to improve future agent behavior. Also surface lessons whose value is
the user's understanding — rationale, tradeoffs, mental models — even when no
agent action exists; mark these with an insight destination hint.

Choose the smallest appropriate destination hypothesis (see §8). During Phase
0, do not force uncertain lessons into a future schema; mark them unclassified.
First produce a compact shortlist with: title, candidate kind or unclassified,
trigger, lesson,
recommended action, rationale (why), supporting evidence and dates,
frequency/confidence,
existing coverage, risk, recommended destination, and why it is or is not
worth staging.

Stage only high-confidence missing proposals. Do not write traps.db, edit
guidance, install skills, create agents, enable automations, or merge eval
fixtures. Do not create speculative, overlapping, or overly broad assets.

Finish with: what was staged, what was deliberately suppressed (user-facing
action: skipped), what needs more evidence, and confirmation that no durable
destination was modified.
```

---

## 8. Lesson Candidate Layer

`LessonCandidate` is the concept one layer above the trap. A trap is one kind
of lesson, not the whole of it.

### 8.1 Candidate kinds and destination hypotheses

These are the mature destination hypotheses, not a Phase 1 schema commitment:

| Candidate kind | Applicable scenario | Recommended destination | Red line |
|---|---|---|---|
| `pitfall_trap` | repeated failure or misuse pattern | confirmed trap + evidence + lifecycle | no unauthorized write to `traps.db` |
| `project_convention` | stable project/team preference or boundary | AGENTS/CLAUDE guidance patch proposal | no silent guidance edits |
| `skill_candidate` | repeated workflow, SOP, reusable playbook | staged skill draft | no auto-install, no auto-trigger |
| `custom_agent_candidate` | bounded specialist role suitable for delegation | custom subagent proposal | no auto-create or enable |
| `automation_idea` | periodic check, report, reminder, monitor | automation proposal | no auto-enable, no external side effects |
| `search_eval_case` | query/recall behavior worth protecting | eval fixture proposal | no fixture pollution |
| `docs_guidance` | README/roadmap/docs/agent guidance update | docs patch proposal | no writing temporary ideas as long-term facts |
| `insight` | durable understanding (rationale, tradeoff, mental model) with no agent-actionable trigger | insight shelf on the study surface (§10) | never runtime-eligible; evidence still required |
| `unclassified` | useful lesson whose durable form is not yet proven | no destination until reviewed | do not force-fit speculative ontology |

`skip` is a user-facing review action, not a candidate kind. It records
`review_decision: suppressed` with a reason and fingerprint.

Phase 1 stabilizes only `pitfall_trap` and `unclassified`. Future kinds may be
captured as a non-binding `destination_hint`, but they do not enter the stable
enum or create dead-end proposal stubs until their destination phase begins.
`insight` stabilizes with its shelf in Phase 2; until then such lessons ride as
`unclassified` with an insight `destination_hint`.

### 8.2 Minimum fields

```text
id
schema_version
revision
content_hash
title
candidate_kind
destination_hint
review_decision
delivery_state
trigger
lesson
recommended_action
rationale
evidence
source_manifest_refs
source_agent            # NEW in v2: codex | claude-code | <other>
frequency
confidence
coverage
risk
destination_proposal
runtime_eligibility
authorization           # optional; bound to revision/hash + destination
created_at
updated_at
```

`source_agent` records which client's history produced the candidate. It is
required for provenance, for cross-client duplicate grouping, and for
per-client noise analysis. `trigger` = when it should be
recalled; `lesson` = what was learned; `recommended_action` = what the agent
should do differently; `rationale` = why that action is right and what breaks
otherwise — the causal model, captured for the second consumer (§1.7) when
known and never padded with filler; `evidence` = sources, dates, snippets,
refs, hashes;
`coverage` = overlap with existing traps/candidates/guidance/skills/agents/
automations/docs/evals/suppressions; `risk` = misuse, over-breadth, staleness,
privacy, sensitivity, external side effects; `runtime_eligibility` = whether
and when it may enter runtime recall. `authorization` records workflow facts;
it is not cryptographic proof of a human actor. `destination_hint` is free-form
and non-binding for `unclassified`; `destination_proposal` is the validated,
revision-bound target and proposed result/diff that the user authorizes.
`runtime_eligibility` is compiler-derived from the committed destination policy;
an agent may recommend it but cannot grant itself runtime eligibility.

### 8.3 Three orthogonal state axes

```text
candidate_kind:   pitfall_trap | unclassified | future destination kinds
review_decision:  pending | approved | rejected | suppressed
delivery_state:   draft | staged | committed | rolled_back | superseded
```

- Editing creates a new `revision` and `content_hash`; it is an event, not a
  lifecycle state. Material edits invalidate prior authorization.
- `approved` means the user authorized the current revision and destination;
  an agent may then execute it on the user's behalf.
- `committed` means the authorized revision was written into a long-term
  carrier with a rollback path.
- `rejected` means the proposal was judged wrong or unsuitable.
- `suppressed` means the lesson is one-off, ambiguous, sensitive, broad, or
  under-evidenced and should not be proposed again without new evidence.
- `superseded` means a committed or staged candidate was replaced by a better
  durable lesson or proposal.

Key principle: `approved` ≠ runtime injection. Only committed/installed/enabled
lessons may become runtime guardrails.

Existing `CandidateTrap` migration is explicit and regression-tested:

```text
old proposed                         -> pending  + draft
old rejected                         -> rejected + draft
old accepted with accepted_trap_id   -> approved + committed
old accepted with missing trap/link  -> approved + staged + migration_warning
```

Existing session files, CLI commands, and Web review remain readable during
the migration window. No record changes meaning merely because it was loaded
by the new version.

### 8.4 Quality bar

- No trigger condition → cannot become a guardrail.
- No recommended action → cannot enter runtime.
- The trigger/action bar gates runtime guardrails only. A lesson that fails it
  but carries real understanding routes to the insight shelf (§8.1), not to
  suppression; suppression is for noise, not for depth.
- Insufficient evidence → suppress or watch, never forced durability.
- Recurrence is not required: high-cost lessons that will clearly recur qualify.
- Exact duplicates consolidate provenance; semantic duplicates group for human
  merge, supersede, or suppression decisions — never silently disappear.
- Misuse risk exceeding benefit → must not enter runtime.
- Sensitive-source candidates require redaction and explicit authorization.

---

## 9. codetrap Compiler Layer

### 9.1 What the CLI owns

- Source discovery for locally readable files (both clients' session dirs).
- Source manifest generation; evidence pack generation; excerpt length limits.
- Best-effort redaction / privacy checks plus allowed-root and retention policy
  enforcement; the CLI never labels evidence "guaranteed safe".
- LessonCandidate schema validation.
- Coverage verification (§9.3) and duplicate detection, including
  exact-revision consolidation and cross-client semantic grouping.
- Risk flagging; suppression archive; staging review directory.
- User-authorization validation and durable write audit receipts.
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
                  attaches ranked similarity groups; consolidates only exact
                  duplicate revisions while preserving all provenance; flags
                  candidates whose claims failed verification.
Web (review):     shows the coverage report; the human makes the final
                  merge / supersede / convert / reject / suppress call.
```

The CLI never silently drops or semantically merges a candidate on similarity
grounds alone. Similar candidates appear as one review cluster with each
revision and provenance visible. Deterministic verification gates; semantic
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
codetrap learn decide <candidate-id> --decision <approve|reject|suppress> [--reason ...]
codetrap learn commit <candidate-id> --revision <n> --destination <...>
codetrap web
```

`decide --decision approve` records the user's authorization scope; it does not
write the destination. `commit` may be executed by the user or by an agent on
the user's instruction and fails if the approved revision/destination changed.

---

## 10. Learning Review Web Workbench (Learning Inbox)

Web Review upgrades from trap-only review into a Learning Inbox, honoring the
UX budgets in §4.2.

List view — enough to triage without opening the card:

```text
[candidate_kind] [title] [confidence] [frequency] [evidence dates]
[recommended destination] [coverage] [risk] [review_decision]
[delivery_state] [source_agent]
```

Detail card — progressive disclosure order:

1. Trigger, lesson, recommended action (the "what changes next time" block).
2. Recommended destination and rationale; coverage report; risk notes.
3. Evidence drill-down (excerpts, dates, source manifest) on demand.

User actions: approve / edit / commit / supersede / convert kind / reject /
skip-as-one-off (`suppressed`) / stage proposal. Authorization strength scales
with destination side effects:

```text
pitfall_trap:           approve -> authorized trap proposal -> commit -> traps.db
project_convention:     approve -> guidance patch -> review diff -> commit
skill_candidate:        approve -> staged skill draft -> explicit install
custom_agent_candidate: approve -> agent proposal -> explicit create/enable
automation_idea:        approve -> automation proposal -> explicit enable
search_eval_case:       approve -> eval fixture proposal -> explicit commit
docs_guidance:          approve -> docs patch -> review diff -> commit
user-visible skip:      suppress -> archive reason/fingerprint -> suppress noise
```

UX principles: one unified entry, different destinations; review in one place,
never ingest into one place; the bigger the side effect, the more explicit the
authorization; every durable write has a proposed result/diff, an authorization
receipt, and a rollback path; end every session with the trust receipt (§4.3).

Browse, study, curate: the same workbench is also the study surface for
committed lessons and shelved insights — the second consumer's surface (§1.7).
The §4.2 triage budgets do not apply here; deliberate attention is the point.
From it the user can select a few lessons and export a curated context pack
(§12) to hand the agent at PRD/planning time. This is a human-facing
convenience over already-committed data — it never auto-injects and never
substitutes for agent-initiated pre-flight recall, which is the only path that
catches the pitfall the user has already forgotten. Spaced-repetition and
digest machinery are deliberately deferred until the study surface exists and
sees real use.

---

## 11. Durable Destinations

| Candidate | Durable destination | User authorization | Rollback path | Phase |
|---|---|---|---|---|
| `pitfall_trap` | `traps.db` confirmed trap + evidence + lifecycle | required | delete / supersede / lifecycle status | **1 (MVP)** |
| `insight` | insight shelf on the study surface (§10) | approve to shelf | unshelve / supersede | 2 |
| `project_convention` | AGENTS/CLAUDE guidance patch | review diff | revert patch | 2 |
| `docs_guidance` | docs patch proposal | review diff | revert patch | 2 |
| `search_eval_case` | eval fixture proposal | merge fixture | remove fixture / mark obsolete | 2 |
| `skill_candidate` | staged skill draft | explicit install | remove / disable skill | 3 |
| `custom_agent_candidate` | custom subagent config draft | explicit create/enable | disable / remove agent | 3 |
| `automation_idea` | automation proposal | explicit enable | disable automation | 3 |

Suppression is a review outcome, not a durable destination. A suppression
record contains candidate fingerprint, reason, evidence boundary, and reopen
path; it never enters runtime recall but prevents repeated review noise.

Destination-matching discipline: guidance files are unconditional context —
always loaded, always spending tokens — and therefore the carrier of last
resort, reserved for the small set of lessons that are always true
project-wide. Situational lessons belong in traps (trigger-matched conditional
recall); workflow-shaped lessons in skills; mechanizable lessons graduate to
deterministic checks (§12.3). This ladder is the product's answer to "rigid
guidance files vs. feeding the agent everything."

Until a destination workflow begins, the lesson remains `unclassified` with a
non-binding `destination_hint`. Phase 1 does not freeze speculative kinds or
create typed proposal stubs that cannot complete.

---

## 12. Runtime Guardrail Injection

Confirmed experience must influence the next agent job; otherwise it is notes.
Delivery happens in two complementary modes, and the product needs both:

```text
Agent-initiated recall  — the agent runs a pre-flight search at the right
                          moment and applies matching lessons. This is the only
                          path that catches unknown-unknowns: the pitfall the
                          user has already forgotten. If recall required the
                          user to remember the lesson first, the trap would be
                          pointless.
User-curated context    — the user browses committed lessons and hands a small,
                          deliberately chosen set to the agent (e.g. while
                          writing a PRD or requirement). This serves
                          known-knowns: context the user knows they want.
```

Curation does not replace recall; it covers a different moment and a different
kind of need. Removing recall to raise precision would trade away the
pitfall-catching core; precision and staleness are addressed in §12.3 instead.

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
- Suppression records → suppress repeated review noise.
- Confirmed `pitfall_trap` (and other committed lessons) → **user-curated
  context pack**: the user selects a few relevant committed lessons from the
  browse surface (§10) and feeds them to the agent at planning/PRD time. Same
  store and `codetrap search` data, user-chosen instead of agent-chosen; always
  user-invoked, never auto-injected.

Note: hook-based injection (e.g., auto-prepending trap search results on prompt
submit) is deliberately NOT on the roadmap. The competitor's experience shows
hook integrations are operationally brittle (multi-artifact installs, client
feature flags, restart requirements). Skills + guidance + MCP cover the need
with far less fragility. Revisit only with strong user demand, as opt-in.

### 12.2 Runtime eligibility

```text
runtime_eligibility: never | after_commit | manual_only
```

Defaults:

```text
pitfall_trap: after_commit                project_convention: after_commit
skill_candidate: manual_only until installed
custom_agent_candidate: manual_only until enabled
automation_idea: manual_only until enabled
search_eval_case: never (runtime) / yes (eval protection)
docs_guidance: after_commit               suppression: never (runtime)
insight: never (runtime) / yes (study surface; may be user-curated into packs)
```

User-curated context packs are always user-invoked and so are not gated by
`runtime_eligibility`; only committed lessons are eligible to appear in the
browse surface a user curates from.

### 12.3 Currency and staleness

Outdated recall is a currency problem, not a reason to stop retrieving. A stored
lesson can be true when committed and wrong later; the fix is to make age and
validity visible and let stale lessons fall out of recall, never to disable
recall wholesale.

- Every committed lesson carries a last-validated date and lifecycle status
  (existing trap lifecycle); recall and the browse surface show both so the user
  and agent can weigh freshness.
- Superseded and retired lessons are excluded from agent-initiated recall by
  default and are visibly marked in the browse surface.
- Stale-but-not-retired lessons are down-ranked in recall, not hidden, so a
  still-relevant old lesson is not silently lost.
- When a recalled lesson conflicts with the current source of truth (user
  request, code, tests, project docs), the agent follows the source of truth and
  surfaces the conflict — already the skill/MCP contract, and the first line of
  defense against stale guidance.
- A recalled or curated lesson the user marks wrong or obsolete routes into the
  supersede/retire lifecycle, closing the loop instead of leaving noise.
- A committed lesson that gets mechanized into a deterministic check (lint
  rule, CI gate, type, test) graduates: the check becomes the durable form and
  the lesson is superseded out of recall with a pointer to its successor. The
  strongest carrier wins; the trap database is the residue that cannot be
  automated.

This keeps the two scarce resources (§1.3) honest: stale, low-precision recall
spends agent context for no behavior change, so currency is a precision feature,
not a nicety.

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
when to run pre-flight search, how to capture candidates, that authorization
stays with the human while an agent may execute an authorized write, and that
learning review is explicit-trigger-only. Any
MCP client then learns the workflow with zero per-client prompt configuration.
This is the single cheapest mechanism for keeping two (later N) clients
behaviorally consistent, and it complements — never replaces — the guidance
templates.

> **Status (2026-07-10): shipped.** `src/mcp/instructions.ts`, wired into the
> initialize handshake and asserted end-to-end in `src/tests/mcp-tools.test.ts`.
> Evidence: `docs/tasks/2026-07-10-setup-claude-and-skill-parity/`.

### 13.3 Per-client doctor

`codetrap doctor` extends to per-client integration checks (§4.5): skill
presence and version, guidance file presence and template currency, MCP
registration, and CLI-binary vs running-MCP-server version match with a
"restart your client" hint on mismatch.

> **Status (2026-07-10): shipped.** `src/lib/client-health.ts` (doctor
> `clients` section + refresh next-actions), `restart_hint` on the MCP doctor
> tool. Guidance currency is the template-marker check; a versioned template
> marker is a noted follow-up. Evidence:
> `docs/tasks/2026-07-10-setup-claude-and-skill-parity/`.

### 13.4 Provenance and cross-client dedup

`source_agent` on every candidate (§8.2). Staging consolidates only identical
revision hashes and preserves combined evidence. Semantic similarity creates a
single review cluster without destroying either candidate; the user decides
merge, supersede, or separate (§9.3). Committed-trap evidence records every
client history that contributed provenance.

---

## 14. External Validation

An internal eval harness (Recall@5 / MRR on `search-eval.json`) already
protects retrieval quality. What is missing is a **publicly legible benchmark**
— the competitor's published LongMemEval numbers are its most credible asset,
and codetrap currently has no equivalent artifact.

Roadmap item (Phase 4, after longitudinal flywheel evidence exists):

- Publish a reproducible retrieval benchmark: methodology, dataset (public or
  released), scripts, and honest numbers including weak configurations.
- Additionally publish flywheel metrics from real usage: candidate yield,
  direct approval, edited approval, rejection, suppression, review time,
  useful downstream recall, and precision of the trap database over time.
  Useful approval and later behavior change are more honest product metrics
  than retrieval scores alone.

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
- No background scanning; no unauthorized writes of any durable destination.
  An agent may execute a write after explicit user authorization (§3.2).
- No hook-based runtime injection (rationale in §12.1).
- No saving generic knowledge, motivational summaries, or marketing copy as
  guardrails; no low-confidence candidates in runtime recall.
- No forcing the growth loop into triage: the inbox stays inside its §4.2
  budgets; study is a separate opt-in surface (§1.7). No spaced-repetition or
  digest machinery before the study surface exists and sees real use.
- No client-specific capability hardcoded as the sole entry of the core.
- No process artifacts that do not change what gets built (§3.4).

---

## 16. Evolution Path (v2.1 — evidence before architecture, vertical slices)

Each phase has acceptance criteria; a phase is done when they are recorded in
its dossier, not when its code merges.

### Phase 0 — Proof point (FIRST; before any schema stabilization)

Run the riskiest-assumption test (§1.5) with minimal machinery: a hand-rolled
discovery prompt per client, candidates as plain JSON/Markdown, review as a
checklist or the existing Web console. No general LessonCandidate schema, new
`learn` subcommands, or new Inbox UI.

```text
Minimum sampling:
  - one conclusive Codex run
  - one conclusive Claude Code run
  - one repeat run from a different project or non-overlapping time window

Conclusive run:
  - source corpus contains >= 10 substantive sessions
  - shortlist target is 10; if < 5 candidates surface, acceptance is marked
    inconclusive and candidate yield is still recorded

Measure:
  - source sessions/files/bytes and candidate yield before the shortlist
  - direct approval, edited approval, rejection, and suppression separately
  - actionability: every approved candidate names the behavior change it causes
  - evidence traceability and edit burden for approved candidates
  - cross-client overlap rate (how many lessons appear from both histories —
    calibrates the dedup requirement)
  - review time per 10 candidates and packed evidence size (§4.2)
  - retrieve-vs-curate signal: when a committed lesson is later needed, whether
    agent-initiated pre-flight recall surfaced it or the user had to curate it
    by hand — early evidence on whether auto-recall earns its context budget
  - sensitive excerpts caught before staging; any leak is a trust failure

Red-line verification (trust receipt):
  0 writes to traps.db before user authorization; 0 unauthorized guidance
  edits, skill installs, agent creations, automation enables, or fixture changes.

Go gate before stabilizing the Phase 1B schema:
  - >= 20 candidates reviewed across conclusive runs
  - direct + edited approval >= 30% overall; report direct approval separately
  - neither client with a conclusive corpus falls below 20% useful approval
  - median review time meets the 5-minutes-per-10 budget
  - 100% of approved candidates have trigger, action, and traceable evidence
  - 0 unredacted sensitive excerpts and 0 unauthorized durable writes
  - after authorization, >= 1 lesson is committed through the existing path,
    later surfaces in the other client, and the user marks the recall useful
```

If the gate fails → §17 falsifier response: strengthen discovery prompts,
evidence packs, coverage, and quality scoring; repeat the smallest failed test.
Do not proceed to Phase 1B schema stabilization merely because infrastructure
would be easier to build than candidate quality.

> **Status (2026-07-25): CLOSED by user decision; candidate-quality gate WAIVED,
> not met.** Single-client run: Claude Code, 30-day window, 79 substantive
> sessions / 228.6 MB → 34 candidates in 16 review clusters, all approved by a
> blanket user decision rather than per-item adjudication. The resulting 100%
> approval rate is 100% by construction and **must not be cited as evidence
> that mined candidates survive human scrutiny**; the §17 falsifier was
> bypassed rather than fired or cleared.
> Measurements that do hold independently of that decision: 100/100 evidence
> pointers verified against source; 11 of 16 clusters found by ≥2 blind mining
> runs; miners self-rejected 39 of 73 leads; the independent repeat run did not
> collapse in yield; 0 unauthorized durable writes; 0 unredacted sensitive
> excerpts; evidence budgets within §4.2.
> **Dual-client sampling FAILED** — the authorized window held 2 Codex sessions
> against a bar of 10, so cross-client overlap is uncomputed and §3.1 symmetry
> remains unproven in use.
> Open questions carried into Phase 1 as risk, not resolved: only 1 of 34
> candidates is a lesson about the user's own source code; the extractor
> discarded assistant reasoning and diffs, where codebase lessons plausibly
> live; `evidence[].excerpt` verbatim-ness is requested but unenforced; and
> review artifacts need a publication-surface guard when a review runs inside a
> public repo.
> Evidence: `docs/tasks/2026-07-25-phase0-claude-code-proof-point/`.

### Phase 1 — MVP compiler loop (five sequential vertical slices)

Work 1A through 1E in order. Each subphase is a milestone with its own dossier
and acceptance evidence; Phase 1 is complete only when all five exit gates pass.

#### Phase 1A — Existing-surface vertical proof

- Use agent-submitted `pitfall_trap` candidates through the existing session
  candidate and Web review surfaces; no pull adapters or general ontology.
- User-facing skip records suppression reason/fingerprint instead of becoming a
  candidate type.
- The user authorizes; the user or agent executes; the receipt records both
  authorization scope and executor.

Acceptance: one real candidate is approved, committed by an agent on explicit
user instruction, searchable afterward, and reversible; one suppressed lesson
does not reappear from the same evidence.

> **Status: PASSED, 2026-07-25.** All six acceptance criteria met against the
> real CLI and Web routes, not fixtures. Cluster C01 was reviewed per item,
> approved as written, and committed by an agent on that instruction; rollback
> was exercised, not claimed; cluster C16 was declined and did not return from
> identical evidence. Four authorization receipts recorded scope and executor.
> Criterion 3 required no code — search already found committed traps.
> Carried forward as risk, not resolved: candidate quality is now evidenced at
> n=1 rather than 100%-by-construction, so the §17 falsifier stays live;
> suppression is exact-match and project-scoped; and the receipt records a
> content hash but does **not yet enforce** authorization against it, which is
> Phase 1B's "material edits invalidate authorization" criterion.
> Coverage check (§9.3) went a second consecutive phase unexercised.
> Evidence: `docs/tasks/2026-07-25-phase1a-existing-surface-vertical-proof/`.

#### Phase 1B — Stable envelope and compatibility

- Stabilize only `pitfall_trap` and `unclassified`, informed by Phase 0 data.
- Add revision/hash, three-axis state, `rationale`, evidence refs, source
  manifest, authorization receipt, staging dirs, and trust receipt.
- Migrate existing `CandidateTrap` records using §8.3; old CLI/Web/session data
  remains readable, with regression fixtures for every old state.
- Future destination kinds remain non-binding hints, not schema enums.

Acceptance: migration is lossless and reversible; old accepted records still
point to their durable traps; material edits invalidate authorization.

#### Phase 1C — Dual-source adapters

- Add `codetrap learn sources | evidence-pack | review | stage` pull mode for
  Codex sessions, then Claude Code sessions, reusing one adapter contract.
- Internal delivery may be sequential; Phase 1C exit requires behavioral and
  artifact parity for both clients. Symmetry is a release gate, not a rule that
  every intermediate commit must implement both simultaneously.
- Add the shared Codex and Claude Code learning-review entry points.

Acceptance: equivalent fixture histories produce the same normalized envelope
and source manifest shape from both adapters; per-client doctor passes.

#### Phase 1D — Compiler hardening

- Add `.codetrap/learning/` locks and concurrent-write regression tests (§13.1).
- Add agent-claimed, CLI-verified coverage and exact-vs-semantic duplicate rules
  from §9.3 and §13.4.
- Enforce allowed source roots, evidence budgets, retention/delete, and
  best-effort secret/redaction warnings.

Acceptance: concurrent stages lose no candidates; exact duplicates consolidate
provenance; semantic matches remain distinct inside one review cluster.

#### Phase 1E — Learning Inbox and runtime proof

- Inbox list/card supports approve, edit, reject, user-visible skip/suppress,
  authorization, commit, rollback, trust receipts, and measured UX budgets.
- Minimal browse surface with curated context-pack export (§10, §12.1): select
  committed lessons, export a pack for planning-time feeding.
- Only `pitfall_trap` commits end-to-end; `unclassified` can be reviewed and
  suppressed but not forced into a speculative destination.

Acceptance: a user on a real project runs learning review from either client,
reviews within budget, authorizes an agent-executed commit, and the trap later
surfaces in a pre-flight search from the other client and is marked useful. At
least one curated context pack is exported and handed to an agent at planning
time.

### Phase 2 — Low-risk destinations + longitudinal validation

- `project_convention` and `docs_guidance` patch-proposal workflows (diff,
  authorize, agent-or-user commit, revert); `search_eval_case` fixture proposals.
- Insight shelf and study surface (§10, §11): stabilize the `insight` kind,
  commit shelved insights, and migrate insight-hinted `unclassified` records.
- Currency mechanics from §12.3: `last_validated` on committed lessons, stale
  down-ranking in recall, superseded/retired exclusion, and graduation of
  mechanizable lessons to deterministic checks.
- Cross-client dedup hardened with Phase 1 real data.
- Measure repeated proposal suppression, downstream useful recall, authorization
  edit invalidation, and Inbox growth over real repeated use.
- Retrieve-vs-curate decision rule on Phase 1–2 usage data: if pre-flight
  recall contributes no useful applications that curation did not also catch,
  its default prominence (never its existence — §12) is reduced; if it catches
  forgotten pitfalls, its context budget is defended.

Acceptance: a convention authorized in the Inbox lands through equivalent
approved patches in AGENTS.md and CLAUDE.md; over repeated reviews, suppression
prevents known noise from returning and at least two committed lessons are
marked useful in later work. At least one insight is shelved and later
consulted on the study surface, and at least one stale or graduated lesson
visibly leaves default recall.

### Phase 3 — High-side-effect destinations + runtime loop closure

- `skill_candidate`, `custom_agent_candidate`, `automation_idea` workflows
  only where Phase 0-2 evidence shows real demand, with explicit authorization,
  install/enable, audit receipt, and rollback.
- Runtime feedback evidence: committed lessons observed changing subsequent
  agent behavior in both clients; "the more I use it, the better it
  understands me" is demonstrable, not aspirational.

Acceptance: at least one evidence-backed high-side-effect workflow completes
end-to-end and later changes real work. Do not manufacture one candidate per
type merely to satisfy the roadmap; unsupported types remain unshipped.

### Phase 4 — External validation and legibility

- Publish the reproducible retrieval benchmark and honest weak configurations.
- Publish aggregated flywheel methodology and metrics only when privacy-safe
  longitudinal data exists (§14).

Acceptance: benchmark data/scripts reproduce published numbers; product claims
distinguish retrieval quality from candidate quality and behavior change.

---

## 17. Falsifier

If most candidates mined from real history are: vague triggers, unclear
actions, insufficient evidence, generic summaries, duplicates, unwanted by the
user, unable to change next-agent behavior, riskier than beneficial, sensitive
without redaction, or unauditable — then automatic experience mining is not yet
mature. Response: strengthen semi-automatic capture, evidence packs, coverage
checks, quality scoring, suppression archive, and Inbox UX. Do not push broader
automatic mining or unauthorized durable writes. Do not build more architecture to
compensate for weak candidate quality.

---

## 18. Mature Product Success Criteria

- After real use of Codex and Claude Code, codetrap proposes evidence-backed
  candidates from either client's history, and at least some clearly change
  future agent behavior.
- The trap database stays high-precision; the Learning Inbox is the user's
  main entry for managing agent experience and respects the §4.2 budgets.
- Human-authorized experience can be committed by the user or an instructed
  agent, then flows into the next job in both clients from one approval.
- High-side-effect destinations have revision-bound authorization, audit
  receipt, and rollback.
- The suppression archive measurably reduces repeated review noise.
- The user can point to expertise the store gave them — insights studied,
  judgment gained, pitfalls they no longer trip — without triage ever being
  slowed to force it (§1.7).
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
phase1a-existing-surface-vertical-proof
phase1b-candidate-envelope-and-migration
phase1c-learning-review-cli-dual-source
phase1d-locking-coverage-and-dedup
phase1e-learning-inbox-runtime-proof
setup-claude-and-skill-parity
mcp-self-describing-contract
convention-and-docs-destinations
insight-shelf-and-study-surface
currency-staleness-and-graduation
skill-agent-automation-destinations
runtime-feedback-evidence
public-retrieval-benchmark
```

---

## 20. Minimal Executable Summary

One sentence:

```text
codetrap does not remember everything itself, nor judge for the agent; it
compiles the experience agents propose from real work history into reviewable,
traceable, groupable, human-authorized, agent-executable, durable, and
reinjectable guardrails — for Codex and Claude Code symmetrically. The store
has two consumers: the next agent run, and the user's own expertise (§1.7).
```

Minimal architecture:

```text
$codetrap-learning-review (Codex) / /codetrap-learning-review (Claude Code)
  -> confirm scope + red lines
  -> agent-native discovery
  -> LessonCandidate shortlist (source_agent tagged)
  -> codetrap learn stage --validate --coverage-check --dry-run
  -> Web Learning Inbox (trust receipt)
  -> user approves a candidate revision + destination
  -> user or instructed agent commits it (receipt + rollback)
  -> runtime guardrail in both clients
```

Minimal proof point (Phase 0):

```text
conclusive Codex run + conclusive Claude Code run + one independent repeat
  -> >= 20 candidates reviewed across conclusive runs
  -> direct approval and edited approval measured separately
  -> useful approval >= 30% overall; no conclusive client below 20%
  -> 0 unauthorized durable writes and 0 unredacted sensitive excerpts
  -> >= 1 authorized lesson committed by user or agent, later surfaced in the
     other client, and marked useful by the user
```
