export function prepareFTSQuery(query: string): string {
  const terms = tokenizeLiteralQuery(query);
  if (terms.length === 0) return "";
  return terms.map(quoteFTSTerm).join(" OR ");
}

function tokenizeLiteralQuery(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function quoteFTSTerm(term: string): string {
  // A trailing `*` (added by the query normalizer for single-char CJK tokens)
  // becomes an FTS5 prefix query: `"缓"*` matches any token starting with 缓.
  // Normalized tokens otherwise never contain `*`, so this is unambiguous.
  if (term.length > 1 && term.endsWith("*")) {
    return `"${term.slice(0, -1).replaceAll('"', '""')}"*`;
  }
  return `"${term.replaceAll('"', '""')}"`;
}
