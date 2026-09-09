type SearchHit = {
  library_key: string;
  snippet: string;
  sources: string[];
  project_root: string;
};
type Context = {
  project: string;
  scope: string;
  query: string;
  revision: string;
  active: boolean;
};
type Deps = {
  context: () => Context;
  api: (url: string, init?: RequestInit) => Promise<any>;
  changed: () => void;
};
export function createLearningSearch(deps: Deps) {
  let key = "",
    generation = 0,
    timer: ReturnType<typeof setTimeout> | undefined;
  let phase: "idle" | "loading" | "ready" | "error" = "idle";
  let hits = new Map<string, SearchHit>(),
    diagnostics: string[] = [],
    error = "",
    indexingProject = "",
    indexError = "",
    indexNotice = "",
    indexNoticeProject = "";
  const identity = (c: Context) =>
    JSON.stringify([c.project, c.scope, c.query.trim(), c.revision]);
  function ensure() {
    const c = deps.context(),
      next = identity(c);
    if (!c.active) {
      if (key) {
        generation++;
        key = "";
        clearTimeout(timer);
        phase = "idle";
        hits.clear();
      }
      return;
    }
    if (key === next) return;
    key = next;
    const seq = ++generation;
    clearTimeout(timer);
    hits.clear();
    diagnostics = [];
    error = "";
    if (!c.query.trim()) {
      phase = "idle";
      return;
    }
    phase = "loading";
    timer = setTimeout(async () => {
      try {
        const result = await deps.api(
          "/api/learning/search?project=" +
            encodeURIComponent(c.project) +
            "&scope=" +
            encodeURIComponent(c.scope) +
            "&q=" +
            encodeURIComponent(c.query.trim()),
        );
        if (
          seq !== generation ||
          !deps.context().active ||
          identity(deps.context()) !== next
        )
          return;
        if (
          result.project_root !== c.project ||
          result.scope !== c.scope ||
          result.query !== c.query.trim() ||
          !Array.isArray(result.results) ||
          !Array.isArray(result.diagnostics)
        )
          throw new Error("Unexpected Learning search response.");
        const nextHits = new Map<string, SearchHit>();
        for (const hit of result.results) {
          if (
            typeof hit.library_key !== "string" ||
            typeof hit.snippet !== "string" ||
            !Array.isArray(hit.sources) ||
            typeof hit.project_root !== "string" ||
            !hit.library_key.startsWith(hit.project_root + "::") ||
            (c.scope === "project" && hit.project_root !== c.project)
          )
            throw new Error("Invalid Learning search result.");
          nextHits.set(hit.library_key, hit);
        }
        hits = nextHits;
        diagnostics = result.diagnostics.map(
          (item: { code: string }) => item.code,
        );
        phase = "ready";
      } catch (e) {
        if (
          seq !== generation ||
          !deps.context().active ||
          identity(deps.context()) !== next
        )
          return;
        phase = "error";
        error = e instanceof Error ? e.message : String(e);
      }
      deps.changed();
    }, 200);
  }
  function controls(zh: boolean) {
    const t = (en: string, cn: string) => (zh ? cn : en);
    const host = document.createElement("div");
    host.className = "learning-search-tools";
    const status = document.createElement("span");
    status.setAttribute("role", "status");
    status.textContent =
      phase === "loading"
        ? t(
            "Showing text matches; searching meanings…",
            "先显示文字匹配，正在搜索相关含义…",
          )
        : phase === "error"
          ? t(
              "Semantic search unavailable; showing text matches. ",
              "搜索请求失败，显示文字匹配。",
            ) + error
          : diagnostics.length
            ? t(
                "Some semantic results are unavailable. Rebuild this project’s index if needed.",
                "部分语义结果不可用，可为当前项目重建索引。",
              )
            : phase === "ready"
              ? t("Text + semantic matches", "文字＋语义匹配")
              : t(
                  "Search titles, summaries and full learning text.",
                  "搜索标题、摘要和学习正文。",
                );
    host.append(status);
    if (phase === "error") {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = t("Retry search", "重试搜索");
      retry.onclick = () => {
        key = "";
        ensure();
        deps.changed();
      };
      host.append(retry);
    }
    const build = document.createElement("button");
    build.type = "button";
    build.dataset.learningReindex = "";
    build.disabled = Boolean(indexingProject);
    build.textContent = indexingProject
      ? t("Building index…", "正在建立索引…")
      : t("Index current project", "建立当前项目学习索引");
    build.onclick = async () => {
      const project = deps.context().project;
      indexingProject = project;
      indexError = "";
      indexNotice = "";
      indexNoticeProject = project;
      deps.changed();
      try {
        const result = await deps.api("/api/learning/reindex", {
          method: "POST",
          body: JSON.stringify({ projectRoot: project }),
        });
        if (result.project_root !== project || result.success !== true)
          throw new Error("Unexpected index response.");
        indexNotice =
          t("Learning index updated: ", "学习索引已更新：") +
          result.fresh +
          t(" passages", " 个段落");
        key = "";
      } catch (e) {
        indexError = e instanceof Error ? e.message : String(e);
      } finally {
        indexingProject = "";
        ensure();
        deps.changed();
      }
    };
    host.append(build);
    if (indexNotice && indexNoticeProject === deps.context().project) {
      const notice = document.createElement("span");
      notice.setAttribute("role", "status");
      notice.textContent = indexNotice;
      host.append(notice);
    }
    if (indexError && indexNoticeProject === deps.context().project) {
      const warning = document.createElement("span");
      warning.setAttribute("role", "alert");
      warning.textContent = indexError;
      host.append(warning);
    }
    return host;
  }
  return {
    ensure,
    controls,
    hit: (id: string) => hits.get(id),
    matches: (id: string) => (phase === "ready" ? hits.has(id) : null),
  };
}
