import { createLibraryModel, emptyLibraryFilters, trapKey, trapNeedsValidation, type LibraryFilters, type LibraryHealth, type LibrarySort } from "./library-model";
import type { LibraryEvidence, LibraryScope, LibraryTrap } from "../client-library-contract";
import { experiencePathContent } from "../client-experience";
import type { Translate } from "./platform";

interface LibraryContext { project: string | null; active: boolean; options: { scopes: string[]; categories: string[]; stale_after_days: number } }
interface Dependencies {
  context(): LibraryContext;
  api(path: string, options?: RequestInit): Promise<unknown>;
  t: Translate;
  escapeHtml(value: unknown): string;
  escapeAttr(value: unknown): string;
  valueLabel(value: unknown): string;
  formatDisplayDate(value: unknown): string;
  optionPairs(options: string[]): string[][];
  kv(label: string, value: unknown): string;
  textBlock(label: string, value: unknown): string;
  renderEvidence(evidence: LibraryEvidence): string;
  isCompactShell(): boolean;
  syncWorkspaceRoute(replace?: boolean): void;
  activate(detail: boolean): void;
  restoreWorkspacePosition(): void;
  showStatus(message: string, error?: boolean): void;
  revisionHistory(panel: HTMLElement, project: string, scope: LibraryScope, id: number): Promise<void>;
  openRun(project: string, id: string): Promise<void>;
  openInsight(project: string, id: string): Promise<void>;
}
export function createLibraryUI(deps: Dependencies) {
  const { context, api, t, escapeHtml, escapeAttr, valueLabel, formatDisplayDate, optionPairs, kv, textBlock, renderEvidence,
    isCompactShell, syncWorkspaceRoute, activate, restoreWorkspacePosition, showStatus, revisionHistory, openRun, openInsight } = deps;
  function el<T extends HTMLElement = HTMLElement>(id: string): T { return document.getElementById(id) as T; }
  const model = createLibraryModel(api, part => {
    if (!context().active || context().project !== state.project) return;
    if (part === "list") { renderLibrary(); renderTrapDetail(); }
    else if (part === "detail") renderTrapDetail();
    else renderExperiencePanel();
  });
  const state = model.state;
  function failure(key: string, id: string): string {
    return `<div class="empty" role="status"><p>${escapeHtml(t(key))}</p><button type="button" class="ghost" id="${id}">${escapeHtml(t("library.retry"))}</button></div>`;
  }
  async function load(): Promise<boolean> {
    if (state.project !== context().project) model.reset(context().project);
    return model.load();
  }
  async function open(scope: LibraryScope, id: number): Promise<void> {
    if (!["project", "global"].includes(scope) || !Number.isSafeInteger(id) || id < 1) return;
    model.reset(context().project, { scope, id });
    activate(true); syncWorkspaceRoute();
    const project = state.project, key = state.routeKey;
    const ready = await load();
    if (!ready || state.project !== project || state.routeKey !== key || !context().active) return;
    showStatus(t(model.current() ? "status.openedTrap" : "status.trapNotInLibrary", { id }), !model.current());
  }
  function renderExperiencePanel(): void {
    const panel = document.getElementById("trap-experience-panel");
    if (!panel || !context().active || !model.current()) return;
    const data = state.experience.status === "ready" ? state.experience.data : null;
    panel.innerHTML = data ? experiencePathContent(data, { text: t, escape: escapeHtml, date: formatDisplayDate, valueLabel })
      : `<div class="experience-heading"><h3>${escapeHtml(t("experience.title"))}</h3></div><p role="status" class="experience-empty">${escapeHtml(t(state.experience.status === "error" ? "experience.loadFailed" : "experience.loading"))}</p>${state.experience.status === "error" ? `<button type="button" class="ghost" data-experience-retry>${escapeHtml(t("experience.refresh"))}</button>` : ""}`;
    panel.querySelector("[data-experience-retry]")?.addEventListener("click", () => { void model.loadExperience(state.experienceOffset, true); });
    panel.querySelectorAll<HTMLButtonElement>("[data-experience-offset]").forEach(button => button.addEventListener("click", () => { void model.loadExperience(Number(button.dataset.experienceOffset), true); }));
    if (data) {
      panel.querySelectorAll<HTMLButtonElement>("[data-experience-run]").forEach(button => button.addEventListener("click", () => { void openRun(data.project_root, button.dataset.experienceRun!).catch(error => showStatus(String(error), true)); }));
      panel.querySelectorAll<HTMLButtonElement>("[data-experience-insight]").forEach(button => button.addEventListener("click", () => { void openInsight(data.project_root, button.dataset.experienceInsight!).catch(error => showStatus(String(error), true)); }));
    }
  }
    function renderLibrary() {
      if (!context().active) return;
      el("queue-title").textContent = t("title.trapLibrary");
      el("candidate-tabs").classList.add("hidden");
      el("candidates").innerHTML = `
        <div class="library-tools">
          <input id="trap-search" placeholder="${escapeAttr(t("placeholder.searchTraps"))}" value="${escapeAttr(state.search)}">
          <details class="library-filters" id="library-filters" ${!isCompactShell() || state.filtersOpen ? "open" : ""}><summary>${escapeHtml(t("route.filters"))}</summary><div class="filter-grid">
            ${filterSelect("trap-filter-scope", t("label.scope"), state.filters.scope, [["", t("option.projectGlobal")], ...optionPairs(context().options.scopes)])}
            ${filterSelect("trap-filter-status", t("label.status"), state.filters.status, [["", valueLabel("active")], ["all", valueLabel("all")], ["archived", valueLabel("archived")], ["superseded", valueLabel("superseded")]])}
            ${filterSelect("trap-filter-category", t("label.category"), state.filters.category, [["", t("option.allCategories")], ...optionPairs(context().options.categories)])}
            ${filterSelect("trap-sort", t("label.sort"), state.sort, [["updated", t("sort.updated")], ["severity", t("sort.severity")], ["hits", t("sort.hits")], ["category", t("sort.category")], ["title", t("sort.title")]])}
            <div class="field"><label for="trap-filter-module">${escapeHtml(t("label.module"))}</label><input id="trap-filter-module" value="${escapeAttr(state.filters.module)}" placeholder="${escapeAttr(t("placeholder.anyModule"))}"></div>
            <div class="field"><label for="trap-filter-owner">${escapeHtml(t("label.owner"))}</label><input id="trap-filter-owner" value="${escapeAttr(state.filters.owner)}" placeholder="${escapeAttr(t("placeholder.anyOwner"))}"></div>
            <button type="button" id="trap-filter-clear" class="ghost">${escapeHtml(t("action.clearFilters"))}</button>
          </div></details>
        </div>
        <div id="library-insights"></div>
        <div id="trap-rows" class="trap-rows"></div>
      `;
      bindLibraryControls();
      renderTrapResults();
    }

    function filterSelect(id: string, label: string, value: string, options: string[][]) {
      return `<div class="field"><label for="${id}">${label}</label><select id="${id}">${options.map(([optionValue, optionLabel]) => `<option value="${escapeAttr(optionValue)}" ${optionValue === value ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`).join("")}</select></div>`;
    }

    function bindLibraryControls() {
      el("library-filters")?.querySelector("summary")?.addEventListener("click", () => {
        if (isCompactShell()) state.filtersOpen = !el<HTMLDetailsElement>("library-filters").open;
      });
      const search = el<HTMLInputElement>("trap-search");
      if (search) {
        search.addEventListener("input", () => {
          state.search = search.value;
          model.clearSelection();
          renderTrapResults();
          renderTrapDetail();
          syncWorkspaceRoute(true);
        });
      }
      bindTrapFilter("trap-filter-scope", "scope");
      bindTrapFilter("trap-filter-status", "status");
      bindTrapFilter("trap-filter-category", "category");
      bindTrapFilter("trap-filter-module", "module");
      bindTrapFilter("trap-filter-owner", "owner");
      const sort = el<HTMLSelectElement>("trap-sort");
      if (sort) {
        sort.addEventListener("change", () => {
          state.sort = sort.value as LibrarySort;
          model.clearSelection();
          renderTrapResults();
          renderTrapDetail();
          syncWorkspaceRoute(true);
        });
      }
      const clear = el("trap-filter-clear");
      if (clear) {
        clear.addEventListener("click", async () => {
          state.filters = { scope: "", status: "", category: "", module: "", owner: "" };
          state.search = "";
          state.health = "all";
          model.clearSelection();
          syncWorkspaceRoute(true);
          await load();
        });
      }
    }

    function bindTrapFilter(id: string, key: keyof LibraryFilters) {
      const control = el<HTMLInputElement | HTMLSelectElement>(id);
      if (!control) return;
      const apply = async () => {
        state.filters[key] = control.value.trim();
        model.clearSelection();
        syncWorkspaceRoute(true);
        await load();
      };
      control.addEventListener("change", apply);
      control.addEventListener("keydown", (event) => {
        if (event instanceof KeyboardEvent && event.key === "Enter") {
          event.preventDefault();
          apply();
        }
      });
    }

    function renderTrapResults() {
      const rows = el("trap-rows");
      const insights = el("library-insights");
      if (!rows || !insights) return;
      const visible = model.visible(context().options.stale_after_days);
      model.selectVisible(visible);
      el("queue-meta").textContent = state.project
        ? t("meta.libraryCounts", { shown: visible.length, loaded: model.traps().length, sort: t("sortLabel." + state.sort) })
        : t("meta.noProject");
      if (state.list.status !== "ready") {
        insights.innerHTML = "";
        rows.innerHTML = state.list.status === "error" ? failure("library.listFailed", "library-list-retry")
          : '<div class="empty" role="status">' + escapeHtml(t(state.project ? "library.loading" : "meta.selectProject")) + '</div>';
        document.getElementById("library-list-retry")?.addEventListener("click", () => { void load(); });
        return;
      }
      insights.innerHTML = renderLibraryHealth(model.traps());
      rows.innerHTML = visible.length ? visible.map((trap) => `
        <button class="row ${trapKey(trap) === state.selectedKey ? "active" : ""}" data-trap-key="${escapeAttr(trapKey(trap))}">
          <span class="row-title">${escapeHtml(trap.title)}</span>
          <span class="meta">
            <span class="pill ${escapeAttr(trap.severity)}">${escapeHtml(valueLabel(trap.severity))}</span>
            <span class="pill">${escapeHtml(valueLabel(trap.category))}</span>
            <span class="pill scope">${escapeHtml(valueLabel(trap.scope))}</span>
            <span class="pill ${escapeAttr(trap.status)}">${escapeHtml(valueLabel(trap.status))}</span>
            <span class="pill">${escapeHtml(t("pill.hits", { count: Number(trap.hit_count || 0) }))}</span>
          </span>
          <span class="subtle">${escapeHtml(trap.updated_at || trap.created_at || "")}</span>
        </button>
      `).join("") : '<div class="empty">' + escapeHtml(t("empty.noTrapMatches")) + '</div>';
      document.querySelectorAll<HTMLButtonElement>("[data-trap-key]").forEach((button) => {
        button.addEventListener("click", () => {
          model.select(button.dataset.trapKey || null, true);
          activate(true);
          syncWorkspaceRoute();
          renderTrapResults();
          renderTrapDetail();
        });
      });
      document.querySelectorAll<HTMLButtonElement>("[data-trap-health]").forEach((button) => {
        button.addEventListener("click", () => {
          state.health = button.dataset.trapHealth as LibraryHealth;
          model.clearSelection();
          renderTrapResults();
          renderTrapDetail();
          syncWorkspaceRoute(true);
        });
      });
    }

    function renderLibraryHealth(traps: LibraryTrap[]) {
      const needsValidation = traps.filter(trap => trapNeedsValidation(trap, context().options.stale_after_days)).length;
      const neverUseful = traps.filter((trap) => Number(trap.useful_count || 0) === 0).length;
      return `<div class="summary-grid health-grid">
        ${healthMetric("all", t("metric.visibleTraps"), traps.length, t("metric.healthAll"))}
        ${healthMetric("needs-validation", t("metric.needsValidation"), needsValidation, t("metric.validationWindow", { days: context().options.stale_after_days }))}
        ${healthMetric("never-useful", t("metric.neverUseful"), neverUseful, t("metric.neverUsefulDetail"))}
      </div>`;
    }

    function healthMetric(filter: LibraryHealth, label: string, value: number, detail: string) {
      return `<button type="button" class="metric health-metric ${state.health === filter ? "active" : ""}" data-trap-health="${escapeAttr(filter)}">
        <span class="metric-label">${escapeHtml(label)}</span>
        <span class="metric-value">${escapeHtml(value)}</span>
        <span class="subtle">${escapeHtml(detail)}</span>
      </button>`;
    }

    function renderTrapDetail() {
      if (!context().active) return;
      const trap = model.current();
      el("detail-title").textContent = t("title.trapDetail");
      el("detail-meta").textContent = trap ? "#" + trap.id + " / " + valueLabel(trap.scope) : t("meta.selectTrap");
      if (state.list.status === "loading" || state.list.status === "idle" && state.project) {
        el("detail").innerHTML = '<div class="empty" role="status">' + escapeHtml(t("library.loading")) + '</div>';
        return;
      }
      if (state.list.status === "error") {
        el("detail").innerHTML = failure("library.listFailed", "library-reader-retry");
        el("library-reader-retry").addEventListener("click", () => { void load(); });
        return;
      }
      if (!trap && state.routeKey) {
        el("detail").innerHTML = '<div class="empty route-unavailable" role="status">' + escapeHtml(t("route.itemMissing")) + '</div>';
        return;
      }
      if (!trap) {
        el("detail").innerHTML = '<div class="empty">' + escapeHtml(t("empty.noTrapSelected")) + '</div>';
        return;
      }

      const key = trapKey(trap);
      const detailState = state.details.get(key);
      if (detailState?.status === "error") {
        el("detail").innerHTML = failure(detailState.missing ? "route.itemMissing" : "library.detailFailed", "library-detail-retry");
        el("library-detail-retry").addEventListener("click", () => { void model.loadDetail(trap, true); });
        return;
      }
      if (detailState?.status !== "ready") {
        el("detail").innerHTML = '<div class="empty">' + escapeHtml(t("empty.loadingTrapDetails")) + '</div>';
        void model.loadDetail(trap);
        return;
      }

      const details = detailState.data;
      const detailTrap = details.trap;
      el("detail").innerHTML = `
        <div class="scroll">
          <div class="section">
            <div class="meta">
              <span class="pill scope">${escapeHtml(valueLabel(details.scope))}</span>
              <span class="pill ${escapeAttr(detailTrap.severity)}">${escapeHtml(valueLabel(detailTrap.severity))}</span>
              <span class="pill">${escapeHtml(valueLabel(detailTrap.category))}</span>
              <span class="pill ${escapeAttr(detailTrap.status)}">${escapeHtml(valueLabel(detailTrap.status))}</span>
              <span class="pill">${escapeHtml(t("pill.hits", { count: Number(detailTrap.hit_count || 0) }))}</span>
            </div>
            <div class="title" style="font-size:16px">${escapeHtml(detailTrap.title)}</div>
          </div>
          <div class="section">
            ${textBlock(t("label.context"), detailTrap.context)}
            ${textBlock(t("label.mistake"), detailTrap.mistake)}
            ${textBlock(t("label.fix"), detailTrap.fix)}
          </div>
          <section class="section experience-panel" id="trap-experience-panel"></section>
          <section class="section" id="trap-revisions-panel"></section>
          <details class="section library-metadata"><summary>${escapeHtml(t("experience.metadata"))}</summary>
            <div class="detail-kv">
              ${kv(t("label.tags"), (detailTrap.tags || []).join(", ") || "-")}
              ${kv(t("label.pathGlobs"), (detailTrap.path_globs || []).join(", ") || "-")}
              ${kv(t("label.module"), detailTrap.module || "-")}
              ${kv(t("label.owner"), detailTrap.owner || "-")}
              ${kv(t("label.created"), detailTrap.created_at || "-")}
              ${kv(t("label.updated"), detailTrap.updated_at || "-")}
              ${kv(t("label.stateKey"), detailTrap.state_key || "-")}
              ${kv(t("label.supersedes"), detailTrap.supersedes_id ?? "-")}
              ${kv(t("label.validFrom"), detailTrap.valid_from || "-")}
              ${kv(t("label.validUntil"), detailTrap.valid_until || "-")}
            </div>
          </details>
          ${renderTrapCode(t("title.before"), detailTrap.before_code)}
          ${renderTrapCode(t("title.after"), detailTrap.after_code)}
          <div class="section">
            <div class="title">${escapeHtml(t("title.evidence"))}</div>
            ${details.evidence.length ? details.evidence.map(renderEvidence).join("") : '<div class="empty">' + escapeHtml(t("empty.noEvidence")) + '</div>'}
          </div>
        </div>
      `;
      restoreWorkspacePosition();
      renderExperiencePanel();
      void model.loadExperience();
      void revisionHistory(el("trap-revisions-panel"), state.project!, trap.scope, trap.id);
    }

    function renderTrapCode(label: string, value: string | null) {
      if (!value) return "";
      return `<div class="section"><div class="title">${escapeHtml(label)}</div><pre class="code-block"><code>${escapeHtml(value)}</code></pre></div>`;
    }


  return {
    load, open, renderList: renderLibrary, renderDetail: renderTrapDetail,
    reset(project: string | null) {
      model.reset(project);
      if (context().active) { renderLibrary(); renderTrapDetail(); }
    },
    clearSelection: model.clearSelection,
    routeKey: () => state.routeKey,
    installRoute(project: string | null, target?: { scope: LibraryScope; id: number }) {
      state.filters = emptyLibraryFilters(); state.search = ""; state.health = "all";
      model.reset(project, target);
    },
  };
}
