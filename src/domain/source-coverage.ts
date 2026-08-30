export const SOURCE_COVERAGE_MODES = ["full_source", "sampled"] as const;
export type SourceCoverageMode = (typeof SOURCE_COVERAGE_MODES)[number];

export const SOURCE_UNIT_DISPOSITIONS = ["learn", "skip"] as const;
export type SourceUnitDisposition = (typeof SOURCE_UNIT_DISPOSITIONS)[number];

export const SOURCE_COVERAGE_STATUSES = [
  "unknown",
  "incomplete",
  "complete",
  "curated_subset",
  "sampled",
] as const;
export type SourceCoverageStatus = (typeof SOURCE_COVERAGE_STATUSES)[number];

export type SourceCoverageUnit = {
  id: string;
  title: string;
  disposition: SourceUnitDisposition;
  reason?: string;
};

export type SourceCoverageManifest = {
  version: 1;
  mode: SourceCoverageMode;
  /** Hash of the exact rendered source or evidence pack used for extraction. */
  source_fingerprint: string;
  units: SourceCoverageUnit[];
};

export type CollectionContextSection = {
  id: string;
  title: string;
  body: string;
  /** Stable source units preserved by this collection-level context. */
  source_unit_refs: string[];
};

export type SourceCoverageSummary = {
  status: SourceCoverageStatus;
  mode: SourceCoverageMode | null;
  total_units: number;
  learn_units: number;
  covered_units: number;
  skipped_units: number;
  unresolved_units: { id: string; title: string }[];
};

const SHA256_FINGERPRINT = /^sha256:[a-f0-9]{64}$/i;

/**
 * Normalize and validate the agent-authored source accounting contract.
 *
 * The manifest deliberately describes source units and their intended
 * disposition, not a writable "complete" flag. Completeness is derived from
 * the Insights that actually reached the shelf, so partial apply/reject flows
 * cannot leave behind a false success marker.
 */
export function normalizeSourceCoverage(
  value: unknown,
  field = "source_coverage"
): SourceCoverageManifest | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) throw new Error(`${field} must be an object.`);

  const version = value.version ?? 1;
  if (version !== 1) throw new Error(`${field}.version must be 1.`);
  const mode = requiredEnum(value.mode, SOURCE_COVERAGE_MODES, `${field}.mode`);
  const sourceFingerprint = requiredText(value.source_fingerprint, `${field}.source_fingerprint`);
  if (!SHA256_FINGERPRINT.test(sourceFingerprint)) {
    throw new Error(`${field}.source_fingerprint must be sha256:<64 hex characters>.`);
  }
  if (!Array.isArray(value.units) || value.units.length === 0) {
    throw new Error(`${field}.units must be a non-empty array.`);
  }

  const seen = new Set<string>();
  const units = value.units.map((raw, index) => {
    const unitField = `${field}.units[${index}]`;
    if (!isRecord(raw)) throw new Error(`${unitField} must be an object.`);
    const id = requiredText(raw.id, `${unitField}.id`);
    const key = id.toLocaleLowerCase();
    if (seen.has(key)) throw new Error(`${field}.units contains duplicate id ${id}.`);
    seen.add(key);
    const title = requiredText(raw.title, `${unitField}.title`);
    const disposition = requiredEnum(raw.disposition, SOURCE_UNIT_DISPOSITIONS, `${unitField}.disposition`);
    const reason = optionalText(raw.reason);
    if (disposition === "skip" && !reason) {
      throw new Error(`${unitField}.reason is required when disposition is skip.`);
    }
    return {
      id,
      title,
      disposition,
      ...(reason ? { reason } : {}),
    };
  });

  return {
    version: 1,
    mode,
    source_fingerprint: sourceFingerprint.toLocaleLowerCase(),
    units,
  };
}

export function normalizeSourceUnitRefs(
  value: unknown,
  manifest?: SourceCoverageManifest,
  field = "source_unit_refs"
): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${field} must be an array.`);
  const refs = uniqueStrings(value);
  if (refs.length === 0) return [];
  if (!manifest) throw new Error(`${field} requires collection.source_coverage.`);

  const byId = new Map(manifest.units.map((unit) => [unit.id.toLocaleLowerCase(), unit]));
  for (const ref of refs) {
    const unit = byId.get(ref.toLocaleLowerCase());
    if (!unit) throw new Error(`${field} contains unknown source unit ${ref}.`);
    if (unit.disposition !== "learn") {
      throw new Error(`${field} cannot reference skipped source unit ${ref}.`);
    }
  }
  return refs;
}

/**
 * Normalize source-backed background that belongs to the collection rather
 * than to one study chapter. Source refs make this a real coverage destination,
 * not decorative metadata that can silently drift away from the audit ledger.
 */
export function normalizeCollectionContextSections(
  value: unknown,
  manifest?: SourceCoverageManifest,
  field = "context_sections"
): CollectionContextSection[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${field} must be an array.`);

  const seen = new Set<string>();
  return value.map((raw, index) => {
    const sectionField = `${field}[${index}]`;
    if (!isRecord(raw)) throw new Error(`${sectionField} must be an object.`);
    const id = requiredText(raw.id, `${sectionField}.id`);
    const key = id.toLocaleLowerCase();
    if (seen.has(key)) throw new Error(`${field} contains duplicate id ${id}.`);
    seen.add(key);
    const refs = normalizeSourceUnitRefs(raw.source_unit_refs, manifest, `${sectionField}.source_unit_refs`);
    if (manifest && refs.length === 0) {
      throw new Error(`${sectionField}.source_unit_refs must identify at least one learned source unit.`);
    }
    return {
      id,
      title: requiredText(raw.title, `${sectionField}.title`),
      body: requiredText(raw.body, `${sectionField}.body`),
      source_unit_refs: refs,
    };
  });
}

export function collectionContextSourceRefs(sections: CollectionContextSection[] | undefined): string[] {
  return uniqueStrings((sections ?? []).flatMap((section) => section.source_unit_refs));
}

export function sourceCoverageSummary(
  manifest: SourceCoverageManifest | undefined,
  coveredRefs: Iterable<string>
): SourceCoverageSummary {
  if (!manifest) {
    return {
      status: "unknown",
      mode: null,
      total_units: 0,
      learn_units: 0,
      covered_units: 0,
      skipped_units: 0,
      unresolved_units: [],
    };
  }

  const covered = new Set([...coveredRefs].map((ref) => ref.toLocaleLowerCase()));
  const learnUnits = manifest.units.filter((unit) => unit.disposition === "learn");
  const skippedUnits = manifest.units.filter((unit) => unit.disposition === "skip");
  const unresolved = learnUnits
    .filter((unit) => !covered.has(unit.id.toLocaleLowerCase()))
    .map((unit) => ({ id: unit.id, title: unit.title }));
  const status: SourceCoverageStatus = unresolved.length > 0
    ? "incomplete"
    : manifest.mode === "sampled"
      ? "sampled"
      : skippedUnits.length > 0
        ? "curated_subset"
        : "complete";

  return {
    status,
    mode: manifest.mode,
    total_units: manifest.units.length,
    learn_units: learnUnits.length,
    covered_units: learnUnits.length - unresolved.length,
    skipped_units: skippedUnits.length,
    unresolved_units: unresolved,
  };
}

function requiredText(value: unknown, field: string): string {
  const text = optionalText(value);
  if (!text) throw new Error(`${field} is required.`);
  return text;
}

function optionalText(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
}

function requiredEnum<const T extends readonly string[]>(
  value: unknown,
  values: T,
  field: string
): T[number] {
  const text = optionalText(value);
  if (!text || !(values as readonly string[]).includes(text)) {
    throw new Error(`${field} must be one of: ${values.join(", ")}.`);
  }
  return text as T[number];
}

function uniqueStrings(value: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of value) {
    const text = String(raw).trim();
    if (!text) continue;
    const key = text.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
