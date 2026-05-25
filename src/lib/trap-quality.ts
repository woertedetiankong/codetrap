import type { CandidateQuality, CandidateTrap } from "../domain/session";

type CandidateDraft = Pick<CandidateTrap, "trap" | "evidence">;

export function scoreCandidateTrap(candidate: CandidateDraft): { score: number; quality: CandidateQuality } {
  const trap = candidate.trap;
  const evidenceCount = candidate.evidence.length;
  const hasClearTrigger = hasMeaningfulText(trap.context) && hasTriggerLanguage(trap.context);
  const hasClearMistake = hasMeaningfulText(trap.mistake);
  const hasActionableFix = hasMeaningfulText(trap.fix) && hasActionLanguage(trap.fix);
  const futureReuseLikely = hasFutureReuseSignal(candidate);
  const properScope = trap.scope === "global" || hasSpecificScope(candidate);
  const notTooBroad = !isTooBroad(candidate);

  const warnings: string[] = [];
  if (!hasClearTrigger) warnings.push("context does not clearly describe when the trap applies");
  if (!hasClearMistake) warnings.push("mistake is not specific enough");
  if (!hasActionableFix) warnings.push("fix is not actionable enough");
  if (!futureReuseLikely) warnings.push("future reuse is unclear");
  if (!properScope) warnings.push("scope is too loose for a project trap");
  if (!notTooBroad) warnings.push("candidate reads like a broad reminder rather than a durable trap");
  if (evidenceCount === 0) warnings.push("candidate has no evidence");

  const score =
    (hasClearTrigger ? 0.2 : 0) +
    (hasClearMistake ? 0.2 : 0) +
    (hasActionableFix ? 0.2 : 0) +
    (futureReuseLikely ? 0.15 : 0) +
    (properScope ? 0.1 : 0) +
    (evidenceCount > 0 ? 0.1 : 0) +
    (notTooBroad ? 0.05 : 0);

  return {
    score: roundScore(score),
    quality: {
      has_clear_trigger: hasClearTrigger,
      has_clear_mistake: hasClearMistake,
      has_actionable_fix: hasActionableFix,
      not_too_broad: notTooBroad,
      future_reuse_likely: futureReuseLikely,
      proper_scope: properScope,
      evidence_count: evidenceCount,
      conflict_checked: false,
      conflict_status: "none",
      staleness_risk: "low",
      suggested_action: suggestedAction(score),
      warnings,
    },
  };
}

function hasMeaningfulText(value: string | undefined): boolean {
  return typeof value === "string" && value.replace(/\s+/g, " ").trim().length >= 24;
}

function hasTriggerLanguage(value: string): boolean {
  const normalized = value.toLowerCase();
  return /\bwhen\b|\bwhile\b|\bduring\b|\bif\b/.test(normalized) || /当|如果|处理|实现|修改/.test(value);
}

function hasActionLanguage(value: string): boolean {
  const normalized = value.toLowerCase();
  return /\buse\b|\bavoid\b|\bprefer\b|\bkeep\b|\bcheck\b|\bcall\b|\bwrite\b|\badd\b|\bverify\b/.test(normalized)
    || /使用|避免|优先|检查|验证|改用|保留|调用/.test(value);
}

function hasFutureReuseSignal(candidate: CandidateDraft): boolean {
  const tags = candidate.trap.tags ?? [];
  return tags.length > 0
    || (candidate.trap.path_globs?.length ?? 0) > 0
    || Boolean(candidate.trap.module)
    || Boolean(candidate.trap.owner);
}

function hasSpecificScope(candidate: CandidateDraft): boolean {
  return (candidate.trap.path_globs?.length ?? 0) > 0
    || Boolean(candidate.trap.module)
    || Boolean(candidate.trap.owner)
    || candidate.evidence.some((evidence) => (evidence.related_files?.length ?? 0) > 0);
}

function isTooBroad(candidate: CandidateDraft): boolean {
  const combined = [
    candidate.trap.title,
    candidate.trap.context,
    candidate.trap.mistake,
    candidate.trap.fix,
  ].join(" ").toLowerCase();

  const broadPhrases = [
    "read the docs",
    "write better code",
    "be careful",
    "check everything",
    "always test",
    "先看文档",
    "小心",
    "写好代码",
  ];
  return broadPhrases.some((phrase) => combined.includes(phrase));
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function suggestedAction(score: number): CandidateQuality["suggested_action"] {
  if (score >= 0.8) return "accept";
  if (score >= 0.6) return "edit";
  return "reject";
}
