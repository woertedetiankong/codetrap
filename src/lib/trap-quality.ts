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
      staleness_risk: assessStalenessRisk(trap),
      suggested_action: suggestedAction(score, warnings),
      warnings,
    },
  };
}

function hasMeaningfulText(value: string | undefined): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.replace(/\s+/g, " ").trim();
  const cjkCharacters = normalized.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu)?.length ?? 0;
  // CJK text carries substantially more information per character than
  // whitespace-delimited Latin prose. A single 24-character threshold made a
  // faithful Chinese translation score lower than the English source.
  return cjkCharacters >= 10 || normalized.length >= 24;
}

function hasTriggerLanguage(value: string): boolean {
  const normalized = value.toLowerCase();
  return /\bwhen\b|\bwhile\b|\bduring\b|\bif\b|\bwhenever\b/.test(normalized)
    || /当|如果|(?:在|于).{0,24}时|期间|场景|情况下|遇到|处理|实现|修改|运行|使用/.test(value);
}

function hasActionLanguage(value: string): boolean {
  const normalized = value.toLowerCase();
  return /\buse\b|\bavoid\b|\bprefer\b|\bkeep\b|\bcheck\b|\bcall\b|\bwrite\b|\badd\b|\bverify\b|\bensure\b|\bmust\b|\bshould\b|\bupdate\b/.test(normalized)
    || /使用|避免|优先|检查|验证|改用|改为|保留|保持|调用|确保|必须|应该|需要|增加|更新|同步|先.+再/.test(value);
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
    "注意",
    "保持谨慎",
    "多测试",
    "写好代码",
  ];
  return broadPhrases.some((phrase) => combined.includes(phrase));
}

// L15: staleness_risk was hardcoded "low". Derive it from volatility markers in
// the trap text — pinned version numbers, explicit dates/years, line-number
// references, and "currently/temporary/deprecated" language all age quickly and
// make a trap likely to go stale. (Keyword heuristics only; not gameproof.)
function assessStalenessRisk(trap: CandidateDraft["trap"]): CandidateQuality["staleness_risk"] {
  const text = [trap.title, trap.context, trap.mistake, trap.fix, trap.before_code ?? "", trap.after_code ?? ""]
    .join(" ")
    .toLowerCase();

  let signals = 0;
  if (/\bv?\d+\.\d+(\.\d+)?\b/.test(text)) signals++; // version-like: v1.2, 3.4.5
  if (/\b20\d{2}\b/.test(text)) signals++; // a specific year
  if (/\bline\s+\d+\b|:\d+\b/.test(text)) signals++; // line-number references
  if (/currently|for now|temporar|as of|deprecat|until further|pending|目前|暂时|临时/.test(text)) signals++;

  if (signals >= 2) return "high";
  if (signals === 1) return "medium";
  return "low";
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function suggestedAction(score: number, warnings: string[]): CandidateQuality["suggested_action"] {
  if (score >= 0.8 && warnings.length === 0) return "accept";
  if (score >= 0.6) return "edit";
  return "reject";
}
