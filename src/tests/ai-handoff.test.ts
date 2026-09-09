import { expect, test } from "bun:test";
import { handoffPrompt } from "../web/browser/ai-handoff";
import { cmdStudyArtifact } from "../commands/study-commands";
import { errorFrom } from "../commands/command-args";
import { learningFixture } from "./web-learning-fixture";
import { StudyArtifacts } from "../lib/study-artifacts";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

test("AI requests preserve project, destination, source and human review", () => {
  for (const destination of ["learning", "memory", "both"] as const) {
    const prompt = handoffPrompt(
      {
        task: "article",
        destination,
        source: "https://example.com/source",
        interactive: true,
      },
      "/project",
      true,
    );
    expect(prompt).toContain("/project");
    expect(prompt).toContain("https://example.com/source");
    expect(prompt).toContain("不替我批准");
    expect(prompt).toContain(
      destination === "learning"
        ? "只保存到学习库"
        : destination === "memory"
          ? "只提炼并保存"
          : "同时另外提炼",
    );
    if (destination === "memory") expect(prompt).not.toContain("制作可交互的");
  }
  expect(
    handoffPrompt(
      {
        task: "html",
        destination: "learning",
        source: "/lesson.html",
        interactive: true,
      },
      "/project",
      false,
    ),
  ).toContain("preserving versions");
});
test("missing import inputs have a discoverable machine-readable recovery", () => {
  const f = learningFixture();
  try {
    cmdStudyArtifact(["import", "--json"], f.a.root);
    throw new Error("expected failure");
  } catch (error) {
    const result = errorFrom(error, ["--json"]),
      body = JSON.parse(result.stdout!);
    expect(result.exitCode).toBe(1);
    expect(body.code).toBe("MISSING_INPUT");
    expect(body.missing_fields).toEqual(["file", "title", "target"]);
    expect(body.next_actions[0].command).toBe(
      "codetrap learn artifact schema --json",
    );
  }
  const schema = JSON.parse(
    cmdStudyArtifact(["schema", "--json"], f.a.root).stdout!,
  );
  expect(schema.success).toBe(true);
  expect(schema.import.update_requires).toContain("expected_version");
});
test("stale revisions guide reread without overwriting saved content", () => {
  const f = learningFixture(),
    store = new StudyArtifacts(f.a.root),
    file = join(f.a.root, "lesson.html");
  writeFileSync(file, "<html><body>one</body></html>");
  const artifact = store.import({
    file,
    title: "Lesson",
    target: { kind: "insight", id: "one" },
  });
  store.restore(artifact.id, 1, 1);
  try {
    store.restore(artifact.id, 1, 1);
    throw new Error("expected conflict");
  } catch (error) {
    const body = JSON.parse(errorFrom(error, ["--json"]).stdout!);
    expect(body.code).toBe("VERSION_CONFLICT");
    expect(body.next_actions[0].command).toContain(artifact.id);
  }
  expect(store.get(artifact.id).revisions).toHaveLength(2);
});
