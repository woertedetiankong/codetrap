import type { TrapDetails } from "../domain/trap";
import { parseTrapPathGlobs, parseTrapTags } from "./trap-json-fields";

export type ContextPackEntry = {
  trap_id: number;
  scope: string;
  title: string;
  severity: string;
  category: string;
  tags: string[];
  path_globs: string[];
  trigger: string;
  avoid: string;
  do_instead: string;
  useful_count: number;
  last_useful_at: string | null;
};

export type ContextPack = {
  version: 1;
  generated_at: string;
  project: string | null;
  note: string;
  entries: ContextPackEntry[];
};

/**
 * §12.1's user-curated context pack: the user picks a few *committed* lessons
 * from the browse surface and hands them to an agent at planning time.
 *
 * Deliberately not an injection path. §12.1: "always user-invoked, never
 * auto-injected", and it "never substitutes for agent-initiated pre-flight
 * recall, which is the only path that catches the pitfall the user has already
 * forgotten."
 */
export function buildContextPack(args: {
  details: TrapDetails[];
  projectPath: string | null;
  now: Date;
}): ContextPack {
  return {
    version: 1,
    generated_at: args.now.toISOString(),
    project: args.projectPath,
    note: "User-curated lessons for planning time. Not auto-injected; this does not replace a pre-flight codetrap search.",
    entries: args.details.map(({ trap, scope }) => ({
      trap_id: trap.id,
      scope,
      title: trap.title,
      severity: trap.severity,
      category: trap.category,
      tags: parseTrapTags(trap.tags),
      path_globs: parseTrapPathGlobs(trap.path_globs),
      trigger: trap.context,
      avoid: trap.mistake,
      do_instead: trap.fix,
      useful_count: trap.useful_count,
      last_useful_at: trap.last_useful_at,
    })),
  };
}

/** The form a user actually pastes into a planning conversation. */
export function formatContextPackMarkdown(pack: ContextPack): string {
  const lines: string[] = [
    "# codetrap context pack",
    "",
    pack.note,
    "",
    `Generated ${pack.generated_at}${pack.project ? ` for ${pack.project}` : ""}.`,
    `${pack.entries.length} lesson(s), chosen by the user.`,
    "",
  ];

  for (const entry of pack.entries) {
    lines.push(`## ${entry.title}`, "");
    lines.push(`- **When this applies** — ${entry.trigger}`);
    lines.push(`- **Avoid** — ${entry.avoid}`);
    lines.push(`- **Do instead** — ${entry.do_instead}`);
    const facts = [
      `trap #${entry.trap_id} (${entry.scope})`,
      entry.severity,
      entry.category,
      ...(entry.tags.length > 0 ? [entry.tags.join(", ")] : []),
      ...(entry.path_globs.length > 0 ? [entry.path_globs.join(", ")] : []),
      ...(entry.useful_count > 0 ? [`marked useful ${entry.useful_count}×`] : []),
    ];
    lines.push(`- ${facts.join(" · ")}`, "");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}
