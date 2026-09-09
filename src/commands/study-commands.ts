import { ActionableError } from "../lib/actionable-error";
import { writeFileSync } from "node:fs";
import { StudyArtifacts, studyTarget, type StudyImport, type StudyTarget } from "../lib/study-artifacts";
import { jsonObjectInput, parseArgs } from "./command-args";
import { jsonResult, textResult, type CommandResult } from "./command-result";

export function cmdStudyArtifact(args: string[], projectRoot: string): CommandResult {
  const action = args[0], { opts, positionals } = parseArgs(args.slice(1));
  const store = new StudyArtifacts(projectRoot);
  const target = (): StudyTarget | undefined => {
    if (opts.insight && opts.collection) throw new Error("Choose either --insight or --collection.");
    if (opts.insight) return studyTarget({ kind: "insight", id: opts.insight });
    if (opts.collection) return studyTarget({ kind: "collection", id: opts.collection });
    return undefined;
  };
  const number = (key: string): number | undefined => {
    if (opts[key] === undefined) return undefined;
    if (!/^[1-9]\d*$/.test(opts[key]) || !Number.isSafeInteger(Number(opts[key]))) throw new Error(`--${key} requires a positive integer.`);
    return Number(opts[key]);
  };
  const id = positionals[0];
  let value: unknown;
  switch (action) {
    case "schema":
      value = { import: { required: ["file", "title", "target"], target: { kind: "insight | collection", id: "existing Learning record ID" }, update_requires: ["id", "expected_version"], file: "Local self-contained HTML file" },
        next_actions: [{ command: "codetrap phase2 insights --json", description: "Find an existing Learning insight ID." }, { command: "codetrap learn artifact list --json", description: "Find existing artifacts before importing an update." }],
        example: "codetrap learn artifact import --file <lesson.html> --title <title> --insight <existing-id> --json" }; break;
    case "import": {
      const input = opts["input-json"] !== undefined ? jsonObjectInput(opts) as unknown as StudyImport : {
        file: opts.file, title: opts.title, target: target(), id: opts.id,
        expected_version: number("expected-version"), source_refs: opts["source-ref"] ? [opts["source-ref"]] : [],
        source_revision: opts["source-revision"] ?? null,
      } as StudyImport;
      const missing = ["file", "title", "target"].filter(key => !input[key as keyof StudyImport]);
      if (missing.length) throw new ActionableError("Import is missing required inputs: " + missing.join(", ") + ".", "MISSING_INPUT", {
        missing_fields: missing,
        next_actions: [{ command: "codetrap learn artifact schema --json", description: "Inspect import fields and an example. Supply real paths and IDs, then retry." }, { command: "codetrap phase2 insights --json", description: "Look up a Learning target. If none exists, prepare a Learning candidate for user review first." }],
      });
      value = { artifact: store.import(input) }; break;
    }
    case "list": value = { artifacts: store.list(target()) }; break;
    case "show": case "versions":
      if (!id) throw new Error("Provide the study artifact id.");
      value = { artifact: store.get(id) }; break;
    case "restore":
      if (!id || !number("version") || !number("expected-version")) throw new Error("restore requires an id, --version and --expected-version.");
      value = { artifact: store.restore(id, number("version")!, number("expected-version")!) }; break;
    case "export": {
      if (!id || !opts.output || opts.output === "true") throw new Error("export requires an id and --output <new.html>.");
      const content = store.content(id, number("version"));
      // Explicit new destination only: never silently overwrite an unrelated file.
      writeFileSync(opts.output, content.html, { flag: "wx" });
      value = { id, version: content.revision.version, output: opts.output }; break;
    }
    default: throw new Error("Usage: codetrap learn artifact <schema|import|list|show|versions|restore|export>. Import: --file <self-contained.html> --title <title> --insight <id> (or --collection <id>), or --input-json -. Update: --id <artifact-id> --expected-version <latest>.");
  }
  return opts.json !== undefined ? jsonResult({ success: true, ...value as Record<string, unknown> }) : textResult(JSON.stringify(value, null, 2));
}
