import { CATEGORY_LABELS, SEVERITY_ICONS, type Category, type Severity } from "./constants";
import type { Trap } from "../domain/trap";
export type { Trap } from "../domain/trap";

export function formatTrapShort(t: Trap, scopeLabel: string): string {
  const sev = SEVERITY_ICONS[t.severity as Severity] ?? t.severity;
  const cat = CATEGORY_LABELS[t.category as Category] ?? t.category;
  return `[${scopeLabel}] [${sev}] [${cat}] #${t.id} ${t.title}`;
}

export function formatTrapDetail(t: Trap, scopeLabel: string): string {
  const sev = SEVERITY_ICONS[t.severity as Severity] ?? t.severity;
  const cat = CATEGORY_LABELS[t.category as Category] ?? t.category;
  const tags = JSON.parse(t.tags || "[]") as string[];
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

function indent(text: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((l) => pad + l)
    .join("\n");
}
