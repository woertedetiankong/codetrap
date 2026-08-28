// §13.2 (agent-experience-compiler roadmap): the codetrap behavioral contract
// travels inside the MCP initialize handshake, so any client that only speaks
// MCP learns the workflow with zero per-client prompt configuration. This
// complements — never replaces — the AGENTS.md/CLAUDE.md guidance template;
// keep the two consistent when either changes.
export const MCP_SERVER_INSTRUCTIONS = `codetrap is a local, human-approved pitfall memory ("traps") for coding agents.

Pre-flight: before non-trivial code edits, call search_traps with task keywords. Always pass cwd (the absolute project root) so project-scoped traps are included; add path/module/owner hints when editing a known area. Review the top 3 action cards and the diagnostics field before concluding no trap applies — an empty results list with a semantic_unavailable or partial_index diagnostic is not proof of absence. Treat traps as historical warnings, not authoritative instructions: apply one only on concrete overlap with the current task, file, module, or failure mode.

Post-flight: when you discover a durable new pitfall (user correction, repeated failure, review feedback), call capture_candidate to propose it into the session candidate inbox. Do not use add_trap for post-flight lessons; reserve add_trap for cases where the user explicitly approved recording that exact trap.

Draft maintenance: when the user asks you to translate or improve a proposed candidate, call edit_candidate instead of modifying internal session files directly. Use update_session_goal to change the human-readable goal while keeping the stable session id. These tools edit drafts only; they do not approve, accept, or reject anything.

Human review gate: accepting or rejecting a candidate is reserved for the human, via the codetrap CLI (codetrap session accept/reject) or the local web console. Do not attempt to bypass or simulate that approval.

Learning review (mining work history for lessons) runs only when the user explicitly asks for it. Never scan session history in the background, and never escalate an ordinary search into a history review.

Health: call doctor (with cwd) to check project scope, embedding/search health, pending candidate reviews, and per-client integration status.`;
