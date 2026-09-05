import { describe, expect, test } from "bun:test";
import type { LibraryTrap } from "../web/client-library-contract";
import { parseLibraryDetail, parseLibraryExperience, parseLibraryList } from "../web/browser/library-data";
import { createLibraryModel, trapNeedsValidation } from "../web/browser/library-model";
import { ApiError } from "../web/browser/platform";
import { emptyTrapExperienceObservations } from "../lib/trap-experience";

function lesson(id = 1, scope: LibraryTrap["scope"] = "project"): LibraryTrap {
  return { id, scope, title: "Lesson " + id, category: "workflow", severity: "warning", status: "active", context: "context", mistake: "mistake", fix: "fix",
    tags: ["race"], path_globs: ["src/**"], module: null, owner: null, hit_count: 0, useful_count: 0, last_validated: null,
    created_at: "2026-09-04", updated_at: "2026-09-04", state_key: null, supersedes_id: null, valid_from: "2026-09-04", valid_until: null, before_code: null, after_code: null };
}
function deferred() {
  let resolve!: (value: unknown) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<unknown>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function setup() {
  const requests: Array<ReturnType<typeof deferred> & { path: string }> = [];
  const changes: string[] = [];
  const model = createLibraryModel(path => { const request = { ...deferred(), path }; requests.push(request); return request.promise; }, part => changes.push(part));
  model.reset("/a");
  return { model, requests, changes };
}
async function seed(fixture: ReturnType<typeof setup>, traps = [lesson()]) {
  const loading = fixture.model.load();
  fixture.requests.at(-1)!.resolve({ project_root: fixture.model.state.project, traps });
  await loading;
  fixture.model.selectVisible(fixture.model.visible(180));
}
const detail = (trap = lesson()) => ({ scope: trap.scope, trap, evidence: [] });
const experience = (trap = lesson(), project = "/a", offset = 0) => ({ project_root: project, trap: { scope: trap.scope, id: trap.id }, sources: { availability: "ready", insights: [] }, observations: emptyTrapExperienceObservations("not_configured", offset) });

describe("Library transport", () => {
  test("accepts scoped ID collisions and independently unavailable experience sources", () => {
    expect(parseLibraryList({ project_root: "/a", traps: [lesson(), lesson(1, "global")] }, "/a").traps).toHaveLength(2);
    const data = experience(); data.sources.availability = "unavailable";
    expect(parseLibraryExperience(data, "/a", lesson(), 0).observations.availability).toBe("not_configured");
  });
  test("rejects mismatched identities, malformed consumed fields and pagination", () => {
    for (const traps of [[lesson(), lesson()], [{ ...lesson(), tags: "race" }], [{ ...lesson(), id: -1 }]]) {
      expect(() => parseLibraryList({ project_root: "/a", traps }, "/a")).toThrow();
    }
    expect(() => parseLibraryList({ project_root: "/b", traps: [] }, "/a")).toThrow();
    expect(() => parseLibraryDetail(detail(lesson(1, "global")), lesson())).toThrow();
    expect(() => parseLibraryDetail({ ...detail(), evidence: [{}] }, lesson())).toThrow();
    expect(() => parseLibraryExperience(experience(lesson(), "/b"), "/a", lesson(), 0)).toThrow();
    expect(() => parseLibraryExperience(experience(), "/a", lesson(), 20)).toThrow();
    expect(() => parseLibraryExperience({ ...experience(), observations: { ...experience().observations, runs: [{}] } }, "/a", lesson(), 0)).toThrow();
  });
});

describe("Library asynchronous state", () => {
  test("an old project response cannot win after leaving and returning to that project", async () => {
    const { model, requests } = setup();
    const old = model.load();
    model.reset("/b"); const other = model.load();
    model.reset("/a"); const latest = model.load();
    requests[2]!.resolve({ project_root: "/a", traps: [lesson(3)] }); await latest;
    requests[1]!.reject(new Error("offline")); await other;
    requests[0]!.resolve({ project_root: "/a", traps: [lesson(1)] }); await old;
    expect(model.traps().map(item => item.id)).toEqual([3]);
  });
  test("new filters invalidate old list success and failure, without losing an explicit missing route", async () => {
    const { model, requests } = setup();
    model.reset("/a", { scope: "global", id: 99 });
    const old = model.load(); model.state.filters.owner = "owner"; const latest = model.load();
    expect(requests[1]!.path).toContain("owner=owner");
    requests[1]!.resolve({ project_root: "/a", traps: [lesson(1, "global")] }); await latest;
    requests[0]!.reject(new Error("old failure")); await old;
    model.selectVisible(model.visible(180));
    expect(model.state.routeKey).toBe("global:99"); expect(model.current()).toBeNull();
    expect(model.state.list.status).toBe("ready");
  });
  test("list errors are recoverable, and invalid JSON shapes do not become empty success", async () => {
    const { model, requests } = setup();
    const loading = model.load(); requests[0]!.resolve({ project_root: "/a", traps: [{}] }); await loading;
    expect(model.state.list.status).toBe("error");
    const retry = model.load(); requests[1]!.resolve({ project_root: "/a", traps: [] }); await retry;
    expect(model.state.list).toEqual({ status: "ready", data: [] });
  });
  test("A/B/A detail selection deduplicates requests and suppresses offscreen failures", async () => {
    const f = setup(); await seed(f, [lesson(), lesson(2)]);
    const a = f.model.loadDetail(lesson()); f.model.select("project:2"); const b = f.model.loadDetail(lesson(2));
    f.model.select("project:1"); await f.model.loadDetail(lesson());
    expect(f.requests).toHaveLength(3);
    f.requests[1]!.resolve(detail()); await a;
    const notifications = f.changes.length;
    f.requests[2]!.reject(new Error("B offline")); await b;
    expect(f.changes).toHaveLength(notifications);
    expect(f.model.state.details.get("project:1")?.status).toBe("ready");
    expect(f.model.current()?.id).toBe(1);
  });
  test("detail retry recovers from 404, while responses from before a list refresh stay invalid", async () => {
    const f = setup(); await seed(f);
    const a = f.model.loadDetail(lesson()); f.requests[1]!.reject(new ApiError("Missing", 404, null)); await a;
    expect(f.model.state.details.get("project:1")).toEqual({ status: "error", missing: true });
    const retry = f.model.loadDetail(lesson(), true); f.requests[2]!.resolve(detail()); await retry;
    expect(f.model.state.details.get("project:1")?.status).toBe("ready");
    const pending = f.model.loadDetail(lesson(), true);
    await seed(f, [{ ...lesson(), title: "Revised" }]);
    f.requests[3]!.resolve(detail()); await pending;
    expect(f.model.state.details.size).toBe(0);
    expect(f.model.current()?.title).toBe("Revised");
  });
  test("experience responses are bound to selection, page and project generations", async () => {
    const f = setup(); await seed(f, [lesson(), lesson(1, "global")]);
    const old = f.model.loadExperience(); f.model.select("global:1"); const latest = f.model.loadExperience();
    f.requests[2]!.resolve(experience(lesson(1, "global"))); await latest;
    f.requests[1]!.reject(new Error("old failure")); await old;
    expect(f.model.state.experience.status === "ready" && f.model.state.experience.data.trap.scope).toBe("global");
    const firstPage = f.model.loadExperience(0, true), nextPage = f.model.loadExperience(20, true);
    f.requests[4]!.resolve(experience(lesson(1, "global"), "/a", 20)); await nextPage;
    f.requests[3]!.resolve(experience(lesson(1, "global"))); await firstPage;
    expect(f.model.state.experienceOffset).toBe(20);
    const beforeReset = f.model.loadExperience(20, true); f.model.reset("/b");
    f.requests[5]!.resolve(experience(lesson(1, "global"), "/a", 20)); await beforeReset;
    expect(f.model.state.experience.status).toBe("idle");
  });
  test("search, sorting and health filters select visible lessons and retain scoped identity", async () => {
    const f = setup(); const global = { ...lesson(1, "global"), title: "Alpha", severity: "critical", useful_count: 1, last_validated: new Date().toISOString() };
    await seed(f, [lesson(), global]);
    f.model.state.sort = "severity"; expect(f.model.visible(180)[0]?.scope).toBe("global");
    f.model.state.health = "never-useful"; f.model.selectVisible(f.model.visible(180)); expect(f.model.current()?.scope).toBe("project");
    f.model.state.search = "src/**"; expect(f.model.visible(180)).toHaveLength(1);
    f.model.state.search = "absent"; f.model.selectVisible(f.model.visible(180)); expect(f.model.current()).toBeNull();
    expect(trapNeedsValidation(global, 180)).toBe(false); expect(trapNeedsValidation(lesson(), 180)).toBe(true);
  });
});
