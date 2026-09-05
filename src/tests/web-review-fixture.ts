import { SessionStore } from "../lib/session-store";
import { SessionOperations } from "../lib/session-operations";
import { TrapStore } from "../lib/store";
import { TrapOperations } from "../lib/trap-operations";
import { createWebHandler } from "../web/server";
import { addWebProject, webProjectRouteRef } from "../web/project-registry";
import { tempHome, tempProjectDir, trap } from "./helpers";
export function reviewFixture() {
  const home = tempHome("review-home-", { realpath: true, initCodetrap: true });
  function project(name: string) {
    const root = tempProjectDir("review-" + name + "-", { realpath: true }); addWebProject(root, home);
    const traps = new TrapStore(root, undefined, home), store = new SessionStore(root), operations = new SessionOperations(store, new TrapOperations(traps));
    const session = operations.startSession({ goal: "Review " + name });
    const candidates = ["First", "Second"].map(title => store.addCandidate({ sessionId: session.id, draft: { trap: trap({ title: title + " " + name, scope: "project" }), evidence: [{ source_type: "manual", note: "Isolated browser regression" }] } }).candidate);
    return { root, session, candidates, traps, operations, hash: (id = candidates[0]!.id) => `#/review/${session.id}/${id}?project=${webProjectRouteRef(root)}` };
  }
  const a = project("alpha"), b = project("beta");
  return { a, b, home, handler: createWebHandler({ token: "review-token", cwd: a.root, home, currentProjectRoot: a.root }) };
}
