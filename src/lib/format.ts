import { CATEGORY_LABELS, SEVERITY_ICONS, type Category, type Severity } from "./constants";
import type { Trap, TrapActionCard, TrapDetails, TrapEvidence } from "../domain/trap";
import { parseEvidenceRelatedFiles, parseTrapTags } from "./trap-json-fields";
export type { Trap } from "../domain/trap";

export function formatTrapShort(t: Trap, scopeLabel: string): string {
  const sev = SEVERITY_ICONS[t.severity as Severity] ?? t.severity;
  const cat = CATEGORY_LABELS[t.category as Category] ?? t.category;
  return `[${scopeLabel}] [${sev}] [${cat}] #${t.id} ${t.title}`;
}

export function formatTrapActionCard(card: TrapActionCard): string {
  const sev = SEVERITY_ICONS[card.severity as Severity] ?? card.severity;
  const sourceLabel = card.sources.length > 0 ? card.sources.join("+") : "unknown";
  return `\
[${card.scope}] [${sev}] #${card.trap_id} ${card.title}
Why relevant: ${card.why_relevant}
Avoid: ${card.avoid}
Do instead: ${card.do_instead}
Score: ${formatScore(card.score)} (${sourceLabel})
Next: get_trap id=${card.next_action.details_args.id} scope=${card.next_action.details_args.scope}`;
}

export function formatTrapDetail(t: Trap, scopeLabel: string): string {
  const sev = SEVERITY_ICONS[t.severity as Severity] ?? t.severity;
  const cat = CATEGORY_LABELS[t.category as Category] ?? t.category;
  const tags = parseTrapTags(t.tags);
  let out = `\
══════════════════════════════════════════
#${t.id}  ${t.title}
══════════════════════════════════════════
Scope:     ${scopeLabel} (${t.scope})
Severity:  ${sev}
Category:  ${cat}
Tags:      ${tags.join(", ") || "-"}
Hit count: ${t.hit_count}
Created:   ${t.created_at}
Updated:   ${t.updated_at}
──────────────────────────────────────────
Context:
  ${t.context}

Mistake (what AI tends to do wrong):
  ${t.mistake}

Fix (what should be done instead):
  ${t.fix}`;

  if (t.before_code) {
    out += `\n\nBefore (wrong):\n${indent(t.before_code, 2)}`;
  }
  if (t.after_code) {
    out += `\n\nAfter (correct):\n${indent(t.after_code, 2)}`;
  }
  return out;
}

export function formatTrapDetails(details: TrapDetails): string {
  const base = formatTrapDetail(details.trap, details.scope);
  const lifecycle = `\

Lifecycle:
  Status: ${details.trap.status}
  State key: ${details.trap.state_key ?? "-"}
  Supersedes: ${details.trap.supersedes_id ?? "-"}
  Valid from: ${details.trap.valid_from}
  Valid until: ${details.trap.valid_until ?? "-"}`;

  if (details.evidence.length === 0) return `${base}${lifecycle}`;

  return `${base}${lifecycle}

Evidence:
${details.evidence.map(formatEvidence).join("\n\n")}`;
}

function formatEvidence(evidence: TrapEvidence): string {
  const relatedFiles = parseEvidenceRelatedFiles(evidence.related_files);
  return `\
  - #${evidence.id} ${evidence.source_type}
    Observed: ${evidence.observed_at}
    Source: ${evidence.source_ref ?? "-"}
    Files: ${relatedFiles.join(", ") || "-"}
    Note: ${evidence.note ?? "-"}`;
}

function formatScore(score: number | null): string {
  return score === null ? "-" : score.toFixed(4);
}

function indent(text: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((l) => pad + l)
    .join("\n");
}
