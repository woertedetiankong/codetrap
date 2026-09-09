# Focused experience workflow

Created: 2026-09-09 (America/Los_Angeles)
Status: Complete
Parent plan: [Focused optimization](../../reviews/2026-09-09-focused-optimization-proposal.zh-CN.md)

## Goal

Deliver correctly ordered Agent results, a first-correction entry from Review/Library, and readable evidence/applicability/usage in experience details.

## Success Criteria

- Global semantic results appear in their actual relevance position, including below-limit searches; CLI/MCP cards and observation ranks agree.
- Cross-corpus FTS and mixed hybrid fallback scores are not compared as if they shared a scale; scope and ID remain distinct.
- Empty Review/Library offer an experience-only AI handoff; filtered-empty results offer filter recovery; Learning drafts and destinations remain independent.
- Experience details expose provenance, applicability, actual usage and unverified states without inventing adoption or benefit.
- Relevant tests, type checks, built browser assets and desktop/mobile browser checks pass.

## Scope

Search merge and consumers, Review/Library handoff and evidence presentation,
packaged Skill reporting, regression coverage and current documentation.

## Constraints

Reuse current modules, APIs and design. No schema migration, runtime framework change, automatic confirmed-memory writes or public release. On 2026-09-09, the user also authorized updating local installations and committing/pushing the completed slice. Preserve user data and unrelated review artifacts. Apply the existing applicability lesson by preserving filters and verifying their regression coverage.

## Expected Knowledge Updates

- Parent proposal status, README/search contract, task index and restart handoff.
- Depends on: [Library state](../2026-09-04-library-state/handoff.md), [AI-assisted UX](../2026-09-08-ai-assisted-ux/handoff.md).
- Shared consumers: CLI/MCP search, observation rank, Library and Review.
