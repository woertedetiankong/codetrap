type Revision = { version: number; title: string; sha256: string; bytes: number; created_at: string };
type Artifact = { id: string; target: { kind: string; id: string }; revisions: Revision[] };
type Deps = { api: (path: string) => Promise<unknown>; t: (key: string) => string };
const MAX_BYTES = 8 * 1024 * 1024;
/** This CSP must precede all untrusted markup. sandbox is also applied on the iframe element. */
export const STUDY_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'";
export function studyDocument(html: string): string {
  return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + STUDY_CSP + '"><meta name="referrer" content="no-referrer"></head><body>' + html + '</body></html>';
}
function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Invalid study response.");
  return v as Record<string, unknown>;
}
function parseArtifact(value: unknown): Artifact {
  const a = obj(value), target = obj(a.target);
  if (typeof a.id !== "string" || !/^study-[a-f0-9-]{36}$/.test(a.id) || !["insight", "collection"].includes(String(target.kind)) || typeof target.id !== "string" || !Array.isArray(a.revisions) || !a.revisions.length) throw new Error("Invalid study artifact.");
  const revisions = a.revisions.map((v, i): Revision => {
    const r = obj(v);
    if (r.version !== i + 1 || typeof r.title !== "string" || typeof r.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(r.sha256) || !Number.isSafeInteger(r.bytes) || Number(r.bytes) < 1 || Number(r.bytes) > MAX_BYTES || typeof r.created_at !== "string") throw new Error("Invalid study revision.");
    return r as unknown as Revision;
  });
  return { id: a.id, target: target as Artifact["target"], revisions };
}
export function mountStudyPlayer(host: HTMLElement, project: string, insight: string, deps: Deps) {
  let revision = 0, loaded = "", artifacts: Artifact[] = [];
  const controls = document.createElement("div"); controls.className = "study-controls";
  const label = document.createElement("label"); label.textContent = deps.t("study.choose");
  const select = document.createElement("select"); select.id = "study-version"; label.htmlFor = select.id; select.disabled = true;
  const status = document.createElement("p"); status.setAttribute("role", "status");
  const frameHost = document.createElement("div"); frameHost.className = "study-frame-host";
  const restore = document.createElement("pre"); restore.hidden = true;
  function button(key: string, onClick: () => void) { const b = document.createElement("button"); b.type = "button"; b.className = "ghost"; b.textContent = deps.t(key); b.onclick = onClick; controls.append(b); return b; }
  controls.append(label, select);
  const reload = button("study.retry", () => { void list(); });
  const restart = button("study.restart", () => renderFrame());
  const download = button("study.export", () => {
    if (!loaded) return;
    const url = URL.createObjectURL(new Blob([loaded], { type: "text/html;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "codetrap-lesson.html"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  button("study.restore", () => {
    const selected = selection(); if (!selected) return;
    restore.textContent = deps.t("study.restoreHint") + "\n" + `codetrap learn artifact restore ${selected.artifact.id} --version ${selected.version.version} --expected-version ${selected.artifact.revisions.length} --json`;
    restore.hidden = false;
  });
  const hint = document.createElement("p"); hint.className = "subtle"; hint.textContent = deps.t("study.note");
  host.replaceChildren(controls, status, frameHost, restore, hint);
  const active = (seq: number) => host.isConnected && seq === revision;
  function selection() {
    const [id, v] = select.value.split(":"); const artifact = artifacts.find(a => a.id === id);
    const version = artifact?.revisions.find(r => r.version === Number(v));
    return artifact && version ? { artifact, version } : null;
  }
  function renderFrame() {
    frameHost.replaceChildren();
    if (!loaded) return;
    const frame = document.createElement("iframe"); frame.title = deps.t("study.label");
    frame.setAttribute("sandbox", "allow-scripts"); frame.referrerPolicy = "no-referrer";
    frame.setAttribute("allow", "camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'");
    frame.srcdoc = studyDocument(loaded); frameHost.append(frame);
  }
  function clear() { loaded = ""; frameHost.replaceChildren(); restore.hidden = true; restart.disabled = download.disabled = true; }
  async function list() {
    const seq = ++revision; clear(); select.disabled = true; status.textContent = deps.t("study.loading");
    try {
      const raw = obj(await deps.api('/api/learning/artifacts?project=' + encodeURIComponent(project) + '&insight=' + encodeURIComponent(insight)));
      if (!active(seq)) return;
      if (raw.project_root !== project || raw.insight_id !== insight || !Array.isArray(raw.artifacts)) throw new Error("Study identity mismatch.");
      artifacts = raw.artifacts.map(parseArtifact);
      select.replaceChildren();
      for (const artifact of artifacts) for (const version of [...artifact.revisions].reverse()) {
        const option = document.createElement("option"); option.value = artifact.id + ":" + version.version;
        option.textContent = `${version.title} · v${version.version} · ${deps.t(artifact.target.kind === "collection" ? "study.collection" : "study.insight")}`;
        select.append(option);
      }
      select.disabled = !artifacts.length;
      if (artifacts.length) await load();
      else status.textContent = deps.t("study.empty") + " " + deps.t("study.emptyHint");
    } catch { if (active(seq)) status.textContent = deps.t("study.failed"); }
  }
  async function load() {
    const seq = ++revision; clear(); const selected = selection(); if (!selected) return;
    status.textContent = deps.t("study.loading");
    try {
      const raw = obj(await deps.api('/api/learning/artifact?project=' + encodeURIComponent(project) + '&id=' + selected.artifact.id + '&version=' + selected.version.version));
      if (!active(seq)) return;
      const artifact = parseArtifact(raw.artifact), v = obj(raw.revision);
      if (raw.project_root !== project || artifact.id !== selected.artifact.id || v.version !== selected.version.version || v.sha256 !== selected.version.sha256 || typeof raw.html !== "string" || new TextEncoder().encode(raw.html).length !== selected.version.bytes) throw new Error("Study identity mismatch.");
      loaded = raw.html; renderFrame(); restart.disabled = download.disabled = false; status.textContent = selected.version.title;
    } catch { if (active(seq)) { clear(); status.textContent = deps.t("study.failed"); } }
  }
  select.onchange = () => { void load(); };
  void reload; void list();
}
