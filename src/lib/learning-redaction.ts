/**
 * Best-effort secret redaction for anything read out of a client's history.
 *
 * §3.2 is explicit that this is a safeguard, never a proof: "Secret detection
 * and redaction are best-effort safeguards, never a proof that content is
 * safe." Evidence previews stay visible before staging so a human can catch
 * what these patterns miss.
 *
 * Ported from the Phase 0 throwaway extractor, which redacted 4 email addresses
 * across a 228 MB corpus before any agent saw it.
 */
export const REDACTION_RULES: { pattern: RegExp; replacement: string; label: string }[] = [
  { label: "anthropic-key", pattern: /sk-ant-[A-Za-z0-9_-]{20,}/g, replacement: "[REDACTED:anthropic-key]" },
  { label: "api-key", pattern: /sk-[A-Za-z0-9_-]{20,}/g, replacement: "[REDACTED:api-key]" },
  { label: "github-token", pattern: /gh[pousr]_[A-Za-z0-9]{20,}/g, replacement: "[REDACTED:github-token]" },
  { label: "aws-key", pattern: /AKIA[0-9A-Z]{16}/g, replacement: "[REDACTED:aws-key]" },
  { label: "jwt", pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, replacement: "[REDACTED:jwt]" },
  {
    label: "private-key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: "[REDACTED:private-key]",
  },
  // `bearer` MUST precede `credential-assignment`. Otherwise, on input like
  // `auth_token: Bearer <token>`, the assignment rule matches the literal word
  // "Bearer" as its 6+ character value, consumes it, and leaves the actual
  // token in cleartext with the run still reporting a redaction.
  { label: "bearer", pattern: /bearer\s+[A-Za-z0-9._-]{20,}/gi, replacement: "Bearer [REDACTED]" },
  {
    label: "credential-assignment",
    // The value must not already be a redaction marker, or a secret caught by an
    // earlier rule is counted twice and `totals.redactions` overstates the count.
    pattern: /\b(password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\s*[=:]\s*["']?(?!\[REDACTED)([^\s"',;]{6,})/gi,
    replacement: "$1=[REDACTED]",
  },
  { label: "email", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: "[REDACTED:email]" },
];

export type RedactionResult = {
  text: string;
  counts: Record<string, number>;
  total: number;
};

export function redact(text: string): RedactionResult {
  const counts: Record<string, number> = {};
  let total = 0;
  let output = text;

  for (const rule of REDACTION_RULES) {
    // A fresh regex per call: the shared /g literals carry lastIndex state.
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    const matches = output.match(pattern);
    if (!matches || matches.length === 0) continue;
    counts[rule.label] = (counts[rule.label] ?? 0) + matches.length;
    total += matches.length;
    output = output.replace(pattern, rule.replacement);
  }

  return { text: output, counts, total };
}

/** §4.2 evidence budget: no single excerpt exceeds this. */
export const MAX_EXCERPT_CHARS = 500;

export function excerpt(text: string, limit = MAX_EXCERPT_CHARS): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= limit) return collapsed;
  return `${collapsed.slice(0, limit - 1)}…`;
}

/**
 * Harness-injected text that arrives on a user-role line but is not the human
 * speaking. Keeping it would make every session look like it contained the same
 * "lesson", which is exactly the extractor artifact Phase 0 flagged as risk 4.
 */
const NOISE_PREFIXES = [
  "<local-command-",
  "<command-name>",
  "<command-message>",
  "<command-args>",
  "<system-reminder>",
  "<bash-input>",
  "<bash-stdout>",
  "<bash-stderr>",
  "<user-prompt-submit-hook>",
  "<task-notification>",
  "<environment_context>",
  "Caveat:",
  "[Request interrupted",
  "Shell cwd was reset to",
];

const NOISE_CONTAINS = [
  "DO NOT respond to these messages or otherwise consider them",
  "This is the git status at the start of the conversation",
];

export function isHarnessNoise(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (NOISE_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) return true;
  return NOISE_CONTAINS.some((needle) => trimmed.includes(needle));
}
