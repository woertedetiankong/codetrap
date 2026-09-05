import { createWebHandler } from "../web/server";
import { addWebProject } from "../web/project-registry";
import { TrapStore } from "../lib/store";
import { tempHome, tempProjectDir, trap } from "./helpers";

export function webSuiteFixture() {
  const project = tempProjectDir("suite-api-", { realpath: true });
  const home = tempHome("suite-api-home-", { realpath: true, initCodetrap: true });
  addWebProject(project, home);
  new TrapStore(project, undefined, home).add(trap({ scope: "project", title: "Transaction rollback", context: "Handle transaction rollback", mistake: "No transaction rollback", fix: "Always handle transaction rollback" }));
  const handler = createWebHandler({ token: "suite-token", cwd: project, currentProjectRoot: project, home });
  const api = (path: string, body?: Record<string, unknown>) => handler(new Request("http://localhost/api/eval-suite" + path + (body ? "" : (path.includes("?") ? "&" : "?") + "project=" + encodeURIComponent(project)), { method: body ? "POST" : "GET", headers: { "X-Codetrap-Token": "suite-token", "Content-Type": "application/json" }, body: body ? JSON.stringify({ projectRoot: project, ...body }) : undefined }));
  return { project, home, handler, api };
}
