import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempHome, tempProjectDir } from "./helpers";
import { addWebProject, webProjectRouteRef } from "../web/project-registry";
import { createWebHandler } from "../web/server";
import { LearningImpactOperations } from "../lib/learning-impact";
import { SessionStore } from "../lib/session-store";
import { SessionOperations } from "../lib/session-operations";
import { TrapOperations } from "../lib/trap-operations";
import { TrapStore } from "../lib/store";
export function learningFixture() {
  const home = tempHome("learning-workflow-home-", { realpath: true, initCodetrap: true });
  function project(name: string) {
    const root = tempProjectDir("learning-workflow-" + name + "-", { realpath: true }); addWebProject(root, home);
    const date = "2026-09-05T12:00:00Z";
    const insights = ["one", "two"].map(id => ({ id, title: name + " " + id, summary: "A useful reading note", body: "Read the source, try it in a task, then describe when the lesson applies.", tags: ["learning"], source_refs: ["manual:workflow-test"], source_type: "manual", topics: [], shelved_at: date, consulted_count: 0, last_consulted_at: null }));
    mkdirSync(join(root, ".codetrap/phase2"), { recursive: true });
    writeFileSync(join(root, ".codetrap/phase2/insights.json"), JSON.stringify({ version: 2, insights,
      collections: [{ id: "collection", title: name + " collection", summary: "Reading order", source_type: "manual", source_refs: [], topics: [], created_at: date, updated_at: date }],
      collection_items: insights.map((insight, i) => ({ collection_id: "collection", insight_id: insight.id, position: i + 1 })),
    }));
    const sessions = new SessionStore(root), traps = new TrapStore(root, undefined, home);
    const operations = new LearningImpactOperations(root, new SessionOperations(sessions, new TrapOperations(traps)));
    const ref = webProjectRouteRef(root);
    return { root, ref, sessions, traps, operations, hash: (id = "one") => `#/learning/${ref}/${id}?project=${ref}` };
  }
  const a = project("Alpha"), b = project("Beta");
  return { home, a, b, handler: createWebHandler({ token: "learning-token", cwd: a.root, home, currentProjectRoot: a.root }) };
}
