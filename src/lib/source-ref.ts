import { redact, type RedactionResult } from "./learning-redaction";

const SECRET_QUERY_KEY = /token|key|secret|auth|password/i;

/**
 * Redact a provenance reference before it reaches evidence or candidate state.
 * Generic secret patterns run first; URL credentials and secret-like query
 * parameters are then handled structurally so percent-encoding cannot hide
 * them from the caller.
 */
export function sanitizeSourceRef(value: string, limit = 500): RedactionResult {
  const redacted = redact(value.trim());
  const counts = { ...redacted.counts };
  let total = redacted.total;
  let text = redacted.text;

  try {
    const url = new URL(text);
    if (url.protocol === "http:" || url.protocol === "https:") {
      if (url.username || url.password) {
        counts["url-credentials"] = (counts["url-credentials"] ?? 0) + 1;
        total += 1;
        url.username = "";
        url.password = "";
      }
      for (const key of [...url.searchParams.keys()]) {
        if (!SECRET_QUERY_KEY.test(key)) continue;
        counts["url-query-secret"] = (counts["url-query-secret"] ?? 0) + 1;
        total += 1;
        url.searchParams.set(key, "[REDACTED]");
      }
      text = url.toString();
    }
  } catch {
    // Paths, issue ids and other non-URL refs retain their redacted text.
  }

  if (text.length > limit) text = `${text.slice(0, Math.max(0, limit - 3))}...`;
  return { text, counts, total };
}
