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
  return `"${term.replaceAll('"', '""')}"`;
}
