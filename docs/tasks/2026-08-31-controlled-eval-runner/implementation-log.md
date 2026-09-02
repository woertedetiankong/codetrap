# Implementation Log

> Created: 2026-08-31

## Task

Implement the first controlled baseline/candidate Eval runner and comparison UX.

## Assumptions

- A deterministic retrieval experiment is the safe first controlled runner because the user has not authorized model cost or external Agent execution.

## Initial Approach

- Reuse confirmed Search Eval fixture cases, evaluate immutable in-memory variants, persist versioned reports locally, and add a regression-first Web surface.

## Log

### 2026-08-31

- Chose two named, fixed profiles instead of accepting arbitrary commands or ranking JSON: `retrieval_policy_v1` compares FTS-only baseline with each case's confirmed retrieval mode, while `memory_contribution_v1` compares expected traps absent versus present. This gives users an immediately understandable controlled question, keeps the variable explicit, and permits zero-cost deterministic execution.
- Treat `.codetrap/evals/` as result evidence, not source mutation. Each experiment snapshots fixture bytes by SHA-256 and writes immutable reports atomically under an advisory lock; the runner itself only uses in-memory repositories.
- Real Agent/worktree trials and model judges remain a later permissioned extension. The initial runner records `model_calls=0` and must not imply it measured end-to-end Agent behavior.
- The first focused test showed that synthetic baseline rows must still satisfy the production trap category constraint. Baseline placeholders now use the valid `other` category plus a dedicated tag; inventing a test-only category would bypass the real repository contract.
- A later assertion exposed that pass/fail parity is not the same as an unchanged result. The comparison classifies a case as `changed` when rankings or metrics differ even if both sides pass, preserving evidence that a configuration changed retrieval behavior.
- Persistence round-trip testing exposed JavaScript negative zero in a duration delta: memory held `-0`, while JSON restored `0`. Millisecond normalization now canonicalizes negative zero so a completed result has the same identity before and after restart.
- OpenCLI exposed that the normal center pane is substantially narrower than the browser viewport because the console keeps project and Run sidebars visible. The run form now uses a three-column center-pane layout with full-row copy and action areas, then collapses further at narrow widths; the primary action remains fully visible in the actual three-pane shell.
- Browser verification treats a reported click as provisional. The final check asserted the experiment-history count changed, the controlled POST returned 200, 24 case rows rendered, the route and token hygiene remained intact, and console/network errors stayed at zero.
- Post-delivery user testing exposed a five-second polling regression shared by Impact Overview, Runs, and Evals: background freshness called the foreground loader, rendered a loading state, and replaced the nested `.impact-shell` scroll node even when payloads were unchanged. Background refresh now compares content signatures and skips unchanged renders; when evidence really changes, it restores both detail and queue scroll positions. OpenCLI held Overview at about 238 px, Runs at 488 px, and Evals at 900 px across two polling intervals with the same DOM nodes.
