import {
  collectionContextSourceRefs,
  normalizeCollectionContextSections,
  normalizeSourceCoverage,
  sourceCoverageSummary,
  type SourceCoverageManifest,
} from "../domain/source-coverage";
import {
  deriveInsightCollectionId,
  inferSourceType,
  parseInsightSourceType,
} from "./phase2-store";

export type InsightCollectionBatchMember = {
  payload: Record<string, unknown>;
};

export type InsightCollectionBatchIssue = {
  member_indexes: number[];
  message: string;
};

type BatchEntry = {
  memberIndex: number;
  member: InsightCollectionBatchMember;
  collection: Record<string, unknown>;
  id: string | null;
  title: string;
  manifest?: SourceCoverageManifest;
};

/**
 * Validates and stamps one canonical source-covered collection contract onto
 * every member. Callers from proposal, Web edit, and learning-review staging
 * share this function so omitted collection metadata cannot acquire different
 * meanings at different mutation boundaries.
 */
export function normalizeInsightCollectionBatches(
  members: InsightCollectionBatchMember[]
): InsightCollectionBatchIssue[] {
  const issues: InsightCollectionBatchIssue[] = [];
  const entries: BatchEntry[] = [];

  members.forEach((member, memberIndex) => {
    if (member.payload.collection === undefined || member.payload.collection === null) return;
    try {
      const collection = recordValue(member.payload.collection, "payload.collection");
      const id = optionalText(collection.id);
      const title = requiredText(collection.title, "payload.collection.title");
      const manifest = normalizeSourceCoverage(
        collection.source_coverage,
        "payload.collection.source_coverage"
      );
      entries.push({ memberIndex, member, collection, id, title, manifest });
    } catch (error) {
      issues.push({ member_indexes: [memberIndex], message: errorMessage(error) });
    }
  });

  const groups = new Map<string, BatchEntry[]>();
  for (const entry of entries.filter((item) => item.id)) {
    const key = `id:${entry.id!.toLocaleLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  for (const entry of entries.filter((item) => !item.id)) {
    const sourceKey = entry.manifest
      ? `${entry.manifest.source_fingerprint}:${entry.title.toLocaleLowerCase()}`
      : null;
    const matchingExplicitGroups = sourceKey
      ? [...groups.entries()].filter(([, group]) => group.some((candidate) =>
          candidate.manifest
          && `${candidate.manifest.source_fingerprint}:${candidate.title.toLocaleLowerCase()}` === sourceKey))
      : [];
    if (matchingExplicitGroups.length > 1) {
      issues.push({
        member_indexes: [entry.memberIndex],
        message: `Source-covered collection ${entry.title} is ambiguous without collection.id; `
          + "use the same explicit collection.id on every proposal.",
      });
      continue;
    }
    const key = matchingExplicitGroups[0]?.[0]
      ?? (sourceKey ? `audited:${sourceKey}` : `legacy:${entry.title.toLocaleLowerCase()}`);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  for (const group of groups.values()) {
    try {
      normalizeGroup(group);
    } catch (error) {
      issues.push({
        member_indexes: group.map((entry) => entry.memberIndex),
        message: errorMessage(error),
      });
    }
  }
  return issues;
}

function normalizeGroup(group: BatchEntry[]): void {
  const collections = group.map((entry) => entry.collection);
  const optionalManifests = group.map((entry) => entry.manifest);
  if (optionalManifests.every((manifest) => !manifest)) return;
  const initialTitle = requiredText(collections[0].title, "payload.collection.title");
  if (optionalManifests.some((manifest) => !manifest)) {
    throw new Error(`Every proposal in source-covered collection ${initialTitle} must carry source_coverage.`);
  }
  const manifests = optionalManifests as SourceCoverageManifest[];
  const collectionTitle = sharedText(
    collections.map((collection) => requiredText(collection.title, "payload.collection.title")),
    "title"
  ) ?? initialTitle;
  const manifestSignatures = manifests.map((manifest) => JSON.stringify(manifest));
  if (manifestSignatures.some((signature) => signature !== manifestSignatures[0])) {
    throw new Error(`Source-covered collection ${collectionTitle} must use identical source_coverage in one batch.`);
  }

  const positions = collections.map((collection) =>
    positiveInteger(collection.position, "payload.collection.position"));
  const orderedPositions = [...positions].sort((left, right) => left - right);
  if (new Set(orderedPositions).size !== orderedPositions.length
    || orderedPositions.some((position, index) => position !== index + 1)) {
    throw new Error(
      `Source-covered collection ${collectionTitle} positions must be unique and consecutive from 1 in one batch.`
    );
  }
  const orderedIndexes = positions
    .map((position, index) => ({ position, index }))
    .sort((left, right) => left.position - right.position)
    .map((item) => item.index);

  const explicitSourceRefs = sharedStringArray(
    collections.map((collection) => stringArray(collection.source_refs)),
    "source_refs",
    collectionTitle
  );
  const sourceRefs = explicitSourceRefs ?? normalizedStrings(
    orderedIndexes.flatMap((index) => stringArray(group[index].member.payload.source_refs))
  );
  const explicitTopics = sharedStringArray(
    collections.map((collection) => stringArray(collection.topics)),
    "topics",
    collectionTitle
  );
  const topics = explicitTopics ?? normalizedStrings(
    orderedIndexes.flatMap((index) => stringArray(group[index].member.payload.topics))
  );
  const explicitSourceType = sharedText(
    collections.map((collection) => optionalText(collection.source_type)),
    "source_type",
    collectionTitle
  );
  const insightSourceType = sharedText(
    group.map((entry) => optionalText(entry.member.payload.source_type)),
    "Insight source_type",
    collectionTitle
  );
  const sourceType = parseInsightSourceType(
    explicitSourceType ?? insightSourceType,
    inferSourceType(sourceRefs[0])
  );
  const collectionSummary = sharedText(
    collections.map((collection) => optionalText(collection.summary)),
    "summary",
    collectionTitle
  ) ?? "";
  const explicitId = sharedText(
    collections.map((collection) => optionalText(collection.id)),
    "id",
    collectionTitle
  );
  const id = explicitId ?? deriveInsightCollectionId(collectionTitle, sourceRefs);
  const explicitContexts = collections
    .map((collection, index) => collection.context_sections === undefined
      ? null
      : normalizeCollectionContextSections(
          collection.context_sections,
          manifests[index],
          "payload.collection.context_sections"
        ))
    .filter((sections): sections is NonNullable<typeof sections> => sections !== null);
  const contextSignatures = explicitContexts.map((sections) => JSON.stringify(sections));
  if (contextSignatures.some((signature) => signature !== contextSignatures[0])) {
    throw new Error(`Source-covered collection ${collectionTitle} must use identical context_sections in one batch.`);
  }
  const contextSections = explicitContexts[0] ?? [];

  group.forEach((entry, index) => {
    entry.member.payload.collection = {
      ...entry.collection,
      id,
      title: collectionTitle,
      summary: collectionSummary,
      source_type: sourceType,
      source_refs: sourceRefs,
      topics,
      source_coverage: manifests[index],
      context_sections: contextSections,
      position: positions[index],
    };
  });

  const coveredRefs = group
    .flatMap((entry) => stringArray(entry.member.payload.source_unit_refs))
    .concat(collectionContextSourceRefs(contextSections));
  const coverageSummary = sourceCoverageSummary(manifests[0], coveredRefs);
  if (coverageSummary.unresolved_units.length > 0) {
    throw new Error(
      `Source-covered collection ${collectionTitle} has unresolved learn units: `
      + coverageSummary.unresolved_units.map((unit) => unit.id).join(", ")
      + ". Submit the complete collection as one batch."
    );
  }
}

function requiredText(value: unknown, field: string): string {
  const text = optionalText(value);
  if (!text) throw new Error(`${field} is required.`);
  return text;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function recordValue(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function normalizedStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values.map(String).map((item) => item.trim()).filter(Boolean)) {
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function sharedText(
  values: Array<string | null>,
  field: string,
  collectionTitle = "source-covered collection"
): string | null {
  const present = normalizedStrings(values.filter((value): value is string => Boolean(value)));
  if (present.length > 1) {
    throw new Error(`Source-covered collection ${collectionTitle} must use identical ${field} in one batch.`);
  }
  return present[0] ?? null;
}

function sharedStringArray(
  values: string[][],
  field: string,
  collectionTitle: string
): string[] | null {
  const present = values.map(normalizedStrings).filter((value) => value.length > 0);
  if (present.length === 0) return null;
  const signatures = present.map((value) => JSON.stringify(value));
  if (signatures.some((signature) => signature !== signatures[0])) {
    throw new Error(`Source-covered collection ${collectionTitle} must use identical ${field} in one batch.`);
  }
  return present[0];
}

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive integer.`);
  }
  return value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
