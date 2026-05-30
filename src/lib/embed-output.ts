export type EmbedCommandResult = {
  generated: number;
  skipped: number;
  batches: number;
  scopes: { scope: string; generated: number; skipped: number; batches: number }[];
};

export function formatEmbedText(result: EmbedCommandResult): string {
  return [
    ...result.scopes.map((scoped) =>
      `[${scoped.scope}] embeddings generated: ${scoped.generated}, skipped: ${scoped.skipped}, batches: ${scoped.batches}`
    ),
    `Total generated: ${result.generated}, skipped: ${result.skipped}, batches: ${result.batches}`,
    `Next: ${embedNextAction(result)}`,
  ].join("\n");
}

function embedNextAction(result: EmbedCommandResult): string {
  if (result.generated > 0) {
    return 'codetrap search "<query>" --mode hybrid';
  }
  if (result.skipped > 0) {
    return "embeddings are already fresh; run codetrap doctor to verify hybrid search.";
  }
  return "add traps first, then rerun codetrap embed --scope project or --scope global.";
}
