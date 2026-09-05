import type { LibraryDetail, LibraryScope, LibraryTrap, TrapExperienceWebPayload } from "../client-library-contract";
import { parseLibraryDetail, parseLibraryExperience, parseLibraryList } from "./library-data";

export type LoadState<T> = { status: "idle" | "loading" } | { status: "ready"; data: T } | { status: "error"; missing: boolean };
export type LibrarySort = "updated" | "severity" | "hits" | "category" | "title";
export type LibraryHealth = "all" | "needs-validation" | "never-useful";
export interface LibraryFilters { scope: string; status: string; category: string; module: string; owner: string }
export const emptyLibraryFilters = (): LibraryFilters => ({ scope: "", status: "", category: "", module: "", owner: "" });
export const trapKey = (trap: Pick<LibraryTrap, "id" | "scope">): string => `${trap.scope}:${trap.id}`;
export function trapNeedsValidation(trap: LibraryTrap, staleDays: number, now = Date.now()): boolean {
  const validated = trap.last_validated && Date.parse(trap.last_validated);
  return !validated || !Number.isFinite(validated) || now - validated > staleDays * 86400000;
}
function failed(error: unknown): { status: "error"; missing: boolean } {
  return { status: "error", missing: error instanceof Error && "status" in error && error.status === 404 };
}
export interface LibraryState {
  project: string | null;
  list: LoadState<LibraryTrap[]>;
  selectedKey: string | null;
  routeKey: string | null;
  filters: LibraryFilters;
  search: string;
  sort: LibrarySort;
  health: LibraryHealth;
  filtersOpen: boolean;
  details: Map<string, LoadState<LibraryDetail>>;
  experience: LoadState<TrapExperienceWebPayload>;
  experienceOffset: number;
}
export function createLibraryModel(api: (path: string, options?: RequestInit) => Promise<unknown>, changed: (part: "list" | "detail" | "experience") => void) {
  const state: LibraryState = { project: null, list: { status: "idle" }, selectedKey: null, routeKey: null,
    filters: emptyLibraryFilters(), search: "", sort: "updated", health: "all", filtersOpen: false,
    details: new Map(), experience: { status: "idle" }, experienceOffset: 0 };
  let generation = 0, experienceRequest = 0;
  const traps = () => state.list.status === "ready" ? state.list.data : [];
  const current = () => traps().find(trap => trapKey(trap) === state.selectedKey) ?? null;
  function invalidateExperience() { experienceRequest++; state.experience = { status: "idle" }; state.experienceOffset = 0; }
  function clearSelection() { state.selectedKey = null; state.routeKey = null; invalidateExperience(); }
  function reset(project: string | null, target?: { scope: LibraryScope; id: number }) {
    generation++; state.project = project; state.list = { status: "idle" }; state.details.clear(); clearSelection();
    if (target) {
      state.routeKey = state.selectedKey = trapKey(target);
      state.filters = { ...emptyLibraryFilters(), scope: target.scope, status: "all" };
      state.search = ""; state.health = "all";
    }
  }
  function select(key: string | null, routed = false) {
    if (key !== state.selectedKey) invalidateExperience();
    state.selectedKey = key; state.routeKey = routed ? key : null;
  }
  function visible(staleDays: number): LibraryTrap[] {
    const query = state.search.trim().toLowerCase();
    const items = traps().filter(trap => (!query || [trap.title, trap.category, trap.severity, trap.status, trap.scope,
      trap.context, trap.mistake, trap.fix, trap.module, trap.owner, ...trap.tags, ...trap.path_globs].filter(Boolean).join(" ").toLowerCase().includes(query))
      && (state.health !== "needs-validation" || trapNeedsValidation(trap, staleDays))
      && (state.health !== "never-useful" || trap.useful_count === 0));
    const title = (a: LibraryTrap, b: LibraryTrap) => a.title.localeCompare(b.title);
    const updated = (a: LibraryTrap, b: LibraryTrap) => b.updated_at.localeCompare(a.updated_at) || title(a, b);
    const severity = (value: string) => ["info", "warning", "error", "critical"].indexOf(value);
    return items.sort((a, b) => state.sort === "severity" ? severity(b.severity) - severity(a.severity) || updated(a, b)
      : state.sort === "hits" ? b.hit_count - a.hit_count || updated(a, b)
      : state.sort === "category" ? a.category.localeCompare(b.category) || title(a, b)
      : state.sort === "title" ? title(a, b) : updated(a, b));
  }
  function selectVisible(items: LibraryTrap[]) {
    if (!state.routeKey && !items.some(trap => trapKey(trap) === state.selectedKey)) select(items[0] ? trapKey(items[0]) : null);
  }
  async function load(): Promise<boolean> {
    const project = state.project, request = ++generation;
    state.list = { status: project ? "loading" : "idle" }; state.details.clear(); invalidateExperience();
    changed("list");
    if (!project) return false;
    const params = new URLSearchParams({ project });
    for (const [key, value] of Object.entries(state.filters)) if (value) params.set(key, value);
    try {
      // Avoid cache-mediated serialization of identical in-flight reads during Back/Forward.
      const data = parseLibraryList(await api("/api/traps?" + params, { cache: "no-store" }), project);
      if (generation !== request) return false;
      state.list = { status: "ready", data: data.traps };
    } catch (error) {
      if (generation !== request) return false;
      state.list = failed(error);
    }
    changed("list");
    return state.list.status === "ready";
  }
  async function loadDetail(trap: LibraryTrap, retry = false): Promise<void> {
    const project = state.project, request = generation, key = trapKey(trap);
    if (!project || (!retry && state.details.has(key))) return;
    const pending: LoadState<LibraryDetail> = { status: "loading" };
    state.details.set(key, pending); changed("detail");
    const currentRequest = () => generation === request && state.details.get(key) === pending;
    try {
      const data = parseLibraryDetail(await api("/api/trap?" + new URLSearchParams({ project, scope: trap.scope, id: String(trap.id) }), { cache: "no-store" }), trap);
      if (!currentRequest()) return;
      state.details.set(key, { status: "ready", data });
    } catch (error) {
      if (!currentRequest()) return;
      state.details.set(key, failed(error));
    }
    if (state.selectedKey === key) changed("detail");
  }
  async function loadExperience(offset = 0, retry = false): Promise<void> {
    const project = state.project, trap = current();
    if (!project || !trap || (!retry && state.experience.status !== "idle")) return;
    const request = ++experienceRequest;
    state.experienceOffset = offset; state.experience = { status: "loading" }; changed("experience");
    try {
      const data = parseLibraryExperience(await api("/api/trap/experience?" + new URLSearchParams({ project, scope: trap.scope, id: String(trap.id), offset: String(offset) }), { cache: "no-store" }), project, trap, offset);
      if (experienceRequest !== request) return;
      state.experience = { status: "ready", data };
    } catch (error) {
      if (experienceRequest !== request) return;
      state.experience = failed(error);
    }
    changed("experience");
  }
  return { state, traps, current, reset, clearSelection, select, visible, selectVisible, load, loadDetail, loadExperience };
}
