import { authorizationIsCurrent } from "./candidate-envelope";
import { parseExecutor, type Executor } from "../domain/learning";
import type { CandidateTrap } from "../domain/session";
import type { TrapOperations } from "./trap-operations";
import { resolveClientHome } from "./client-setup";
import { LearningStore } from "./learning-store";
import { Phase3Store, skillArtifact } from "./phase3-store";
import { parseSkillPayload } from "./skill-artifact";
import { sanitizeSourceRef } from "./source-ref";
import { SessionOperations } from "./session-operations";
import { SessionStore } from "./session-store";
import skillMd from "../../plugins/codetrap-agent/skill-candidates/review-ui-screenshots/SKILL.md" with { type: "text" };
import openaiYaml from "../../plugins/codetrap-agent/skill-candidates/review-ui-screenshots/agents/openai.yaml" with { type: "text" };

type ExplicitHomes = { codexHome: string; claudeHome: string };

export class Phase3Operations {
  private readonly sessions: SessionOperations;
  private readonly learning: LearningStore;
  private readonly phase3: Phase3Store;

  constructor(private readonly projectRoot: string, traps: TrapOperations) {
    this.sessions = new SessionOperations(new SessionStore(projectRoot), traps);
    this.learning = new LearningStore(projectRoot);
    this.phase3 = new Phase3Store(projectRoot);
  }

  proposePreset(preset: string) {
    if (preset !== "review-ui-screenshots") {
      throw new Error("Unknown Phase 3 preset. Expected review-ui-screenshots.");
    }
    return this.sessions.captureCandidate({
      goal: "Phase 3 skill candidate: screenshot-first UI review",
      trap: {
        title: "Review UI screenshots before implementing approved fixes",
        category: "other",
        scope: "project",
        context: "When screenshots or rendered UI comparisons are the primary review evidence.",
        mistake: "Changing UI code before ranking visible findings and agreeing on the exact fix set creates churn and omitted work.",
        fix: "Rank screenshot findings, bind implementation to approved identifiers, verify the complete set, and commit by subsystem.",
        severity: "warning",
        tags: ["ui", "screenshots", "review", "approval", "skill"],
      },
      candidateKind: "skill_candidate",
      sourceAgent: "codex",
      rationale: "Phase 3 evidence found this workflow repeated across screenshot review, bulk approval, and subsystem commit closes.",
      sourceManifestRefs: [
        "docs/tasks/2026-08-08-phase3-evidence-gate/evidence-audit.md#candidate-12",
        "plugins/codetrap-agent/skill-candidates/review-ui-screenshots/SKILL.md",
      ],
      destinationPayload: {
        name: "review-ui-screenshots",
        files: { "SKILL.md": skillMd, "agents/openai.yaml": openaiYaml },
      },
    });
  }

  improve(input: Record<string, unknown>, homesInput: ExplicitHomes) {
    const homes = explicitHomes(homesInput);
    const name = requiredInputText(input.name, "name", 64);
    const title = requiredInputText(input.title, "title", 200);
    const trigger = requiredInputText(input.trigger, "trigger", 2_000);
    const mistake = requiredInputText(input.mistake, "mistake", 2_000);
    const fix = requiredInputText(input.fix, "fix", 4_000);
    const why = requiredInputText(input.why, "why", 4_000);
    const sourceRefs = [...new Set(requiredStringArray(input.source_refs, "source_refs", 50, 1_000)
      .map((sourceRef) => sanitizeSourceRef(sourceRef).text))];
    const tags = optionalStringArray(input.tags, "tags", 30, 100);
    const prepared = this.phase3.prepareImprovement(name, input.operations, homes);
    const proposal = parseSkillPayload(prepared.payload);
    if (proposal.mode !== "patch") throw new Error("Existing Skill improvement must produce a patch candidate.");
    const relatedFiles = proposal.operations.map((operation) => operation.path);
    const captured = this.sessions.captureCandidate({
      goal: `Improve existing Skill ${name}`,
      trap: {
        title,
        category: optionalInputText(input.category, "category", 100) ?? "other",
        scope: "project",
        context: trigger,
        mistake,
        fix,
        severity: optionalInputText(input.severity, "severity", 100) ?? "warning",
        tags: [...new Set([...tags, "skill", "skill-improvement"])],
      },
      kind: "review",
      relatedFiles,
      sourceRef: sourceRefs[0],
      evidenceNote: `Existing Skill improvement proposed from ${sourceRefs.length} source reference(s).`,
      candidateKind: "skill_candidate",
      sourceAgent: optionalInputText(input.source_agent, "source_agent", 100) ?? "unknown",
      destinationHint: "skill_candidate",
      rationale: `${why} Exact base: ${prepared.base_sha256}.`,
      sourceManifestRefs: sourceRefs,
      destinationPayload: prepared.payload,
    });
    if (captured.suppressed) return { ...captured, improvement_plan: null };
    const plan = this.preview(captured.session.id, captured.candidate.id, homesInput);
    return { ...captured, improvement_plan: plan };
  }

  edit(sessionId: string, candidateId: string, payload: Record<string, unknown>) {
    const before = this.sessions.getCandidate(candidateId, sessionId).candidate;
    skillArtifact({ ...before, destination_payload: payload });
    const edited = this.sessions.editDestinationCandidate(sessionId, candidateId, payload);
    return edited;
  }

  preview(sessionId: string, candidateId: string, homesInput: ExplicitHomes) {
    const { candidate } = this.sessions.getCandidate(candidateId, sessionId);
    const homes = explicitHomes(homesInput);
    const targets = this.phase3.preview(candidate, homes);
    return {
      candidate_id: candidateId,
      session_id: sessionId,
      skill_name: skillArtifact(candidate).name,
      targets,
      required_authorized_scope: installScope(candidateId, targets),
    };
  }

  install(sessionId: string, candidateId: string, homesInput: ExplicitHomes, executorInput?: string) {
    const executor = parseExecutor(executorInput);
    const { candidate } = this.sessions.getCandidate(candidateId, sessionId);
    const homes = explicitHomes(homesInput);
    const targets = this.phase3.preview(candidate, homes);
    const requiredScope = installScope(candidateId, targets);
    assertSkillInstallAuthorized(candidate, requiredScope);

    const commit = this.phase3.apply(sessionId, candidate, homes, targets);
    let committed: CandidateTrap;
    try {
      committed = this.sessions.commitDestinationCandidate(sessionId, candidateId, commit.id, executor);
    } catch (error) {
      this.phase3.revert(commit.id);
      throw error;
    }
    const receipt = this.learning.appendReceipt({
      action: "commit",
      executor,
      authorizedScope: requiredScope,
      destination: "skill_candidate",
      fingerprint: committed.content_hash ?? "",
      title: committed.trap.title,
      sessionId,
      candidateId,
      reason: `Phase 3 skill commit ${commit.id}; targets: ${commit.targets.map((target) => target.path).join(", ")}`,
    });
    return { success: true, candidate: committed, commit, receipt };
  }

  rollback(commitId: string, executorInput?: string) {
    const executor = parseExecutor(executorInput);
    if (executor === "agent") {
      throw new Error("An install approval does not authorize an agent to remove a skill; run Phase 3 rollback as the user.");
    }
    const existing = this.phase3.listCommits().find((commit) => commit.id === commitId);
    if (!existing) throw new Error(`Phase 3 commit ${commitId} not found.`);
    const { candidate } = this.sessions.getCandidate(existing.candidate_id, existing.session_id);
    if (candidate.delivery_state !== "committed" || candidate.destination_commit_id !== commitId) {
      throw new Error(`Candidate ${candidate.id} is not committed by ${commitId}; refusing rollback.`);
    }
    const commit = this.phase3.revert(commitId);
    const rolledBack = this.sessions.rollbackDestinationCandidate(commit.session_id, commit.candidate_id);
    const receipt = this.learning.appendReceipt({
      action: "rollback",
      executor,
      authorizedScope: `Phase 3 skill commit ${commitId} only`,
      destination: "skill_candidate",
      fingerprint: rolledBack.content_hash ?? "",
      title: rolledBack.trap.title,
      sessionId: commit.session_id,
      candidateId: commit.candidate_id,
      reason: `Rolled back ${commitId} from ${commit.targets.map((target) => target.path).join(", ")}`,
    });
    return { success: true, commit, candidate: rolledBack, receipt };
  }

  commits() { return this.phase3.listCommits(); }

  storage() { return this.phase3.storageStatus(); }

  gc(apply: boolean, executorInput?: string) {
    const executor = parseExecutor(executorInput);
    if (apply && executor === "agent") {
      throw new Error("An agent may inspect Phase 3 storage, but snapshot deletion requires an explicit user-run GC apply.");
    }
    return this.phase3.collectGarbage(apply, executor);
  }
}

function explicitHomes(input: ExplicitHomes) {
  if (!input.codexHome?.trim() || !input.claudeHome?.trim()) {
    throw new Error("Both --codex-home and --claude-home are required for a Phase 3 skill operation.");
  }
  return {
    codex: resolveClientHome("codex", input.codexHome),
    claude: resolveClientHome("claude", input.claudeHome),
  };
}

function installScope(
  candidateId: string,
  targets: Array<{ client: string; path: string; before_sha256: string | null; after_sha256: string }>
): string {
  return `candidate ${candidateId} install only: ${targets.map((target) =>
    `${target.client}=${target.path}@${target.before_sha256 ?? "absent"}->${target.after_sha256}`
  ).join("; ")}`;
}

function assertSkillInstallAuthorized(candidate: CandidateTrap, requiredScope: string): void {
  skillArtifact(candidate);
  const authorization = candidate.authorization;
  if (!authorization) {
    throw new Error(`Candidate ${candidate.id} has no recorded authorization. Preview it, then approve the exact required_authorized_scope.`);
  }
  if (!authorizationIsCurrent(candidate)) {
    throw new Error(`Authorization for ${candidate.id} is stale. Preview and approve this revision again.`);
  }
  if (authorization.destination !== "skill_candidate") {
    throw new Error(`Authorization destination ${authorization.destination} does not match skill_candidate.`);
  }
  if (authorization.authorized_scope !== requiredScope) {
    throw new Error(
      `Authorization scope does not match these exact install targets. Required: ${requiredScope}`
    );
  }
}

function requiredInputText(value: unknown, field: string, max: number): string {
  const text = optionalInputText(value, field, max);
  if (text === undefined) throw new Error(`${field} is required.`);
  return text;
}

function optionalInputText(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string.`);
  const text = value.trim();
  if (text.length > max) throw new Error(`${field} must be ${max} characters or fewer.`);
  return text;
}

function requiredStringArray(value: unknown, field: string, maxItems: number, maxLength: number): string[] {
  const values = optionalStringArray(value, field, maxItems, maxLength);
  if (values.length === 0) throw new Error(`${field} must contain at least one item.`);
  return values;
}

function optionalStringArray(value: unknown, field: string, maxItems: number, maxLength: number): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${field} must be an array.`);
  if (value.length > maxItems) throw new Error(`${field} may contain at most ${maxItems} items.`);
  const result: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const text = optionalInputText(value[index], `${field}[${index}]`, maxLength);
    if (text) result.push(text);
  }
  return [...new Set(result)];
}
