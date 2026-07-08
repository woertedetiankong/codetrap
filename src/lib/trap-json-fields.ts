export type TrapStringArrayInput = string[] | string | null | undefined;

export function parseTrapTags(value: TrapStringArrayInput): string[] {
  return parseStringArrayField(value);
}

export function parseOptionalTrapTags(value: TrapStringArrayInput): string[] | undefined {
  return emptyToUndefined(parseTrapTags(value));
}

export function encodeTrapTags(value: TrapStringArrayInput): string {
  return JSON.stringify(parseTrapTags(value));
}

export function parseTrapPathGlobs(value: TrapStringArrayInput): string[] {
  return parseStringArrayField(value);
}

export function parseOptionalTrapPathGlobs(value: TrapStringArrayInput): string[] | undefined {
  return emptyToUndefined(parseTrapPathGlobs(value));
}

export function encodeTrapPathGlobs(value: TrapStringArrayInput): string {
  return JSON.stringify(parseTrapPathGlobs(value));
}

export function parseEvidenceRelatedFiles(value: TrapStringArrayInput): string[] {
  return parseStringArrayField(value);
}

export function parseOptionalEvidenceRelatedFiles(value: TrapStringArrayInput): string[] | undefined {
  return emptyToUndefined(parseEvidenceRelatedFiles(value));
}

export function encodeEvidenceRelatedFiles(value: TrapStringArrayInput): string {
  return JSON.stringify(parseEvidenceRelatedFiles(value));
}

function parseStringArrayField(value: TrapStringArrayInput): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value === null || value === undefined || value === "") return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
    // L1: a JSON scalar (e.g. "123" → 123, "true" → true) is still data. Keep
    // it as a single element instead of silently dropping it; only null/objects
    // (which cannot be a string-list member) collapse to [].
    if (typeof parsed === "string") return parsed === "" ? [] : [parsed];
    if (typeof parsed === "number" || typeof parsed === "boolean") return [String(parsed)];
    return [];
  } catch {
    return [value];
  }
}

function emptyToUndefined(values: string[]): string[] | undefined {
  return values.length > 0 ? values : undefined;
}
