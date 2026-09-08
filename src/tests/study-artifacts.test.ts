import { expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { StudyArtifacts, MAX_STUDY_BYTES } from "../lib/study-artifacts";
import { learningFixture } from "./web-learning-fixture";
import { runCli } from "./helpers";

function sample(root: string, html = '<html><body><button onclick="this.textContent=2">1</button></body></html>') {
  const file = join(root, "lesson.html"); writeFileSync(file, html); return file;
}
test("copies HTML, preserves versions and provenance, restores without erasing history", () => {
  const f = learningFixture(), store = new StudyArtifacts(f.a.root), file = sample(f.a.root);
  const target = { kind: "insight" as const, id: "one" };
  const a = store.import({ file, target, title: "Interactive", source_refs: ["manual:example"], source_revision: "sha256:source" });
  const original = store.content(a.id).html; rmSync(file);
  expect(store.content(a.id).html).toBe(original);
  expect(a.revisions[0]?.source_revision).toBe("sha256:source");
  sample(f.a.root, '<html><body>new content</body></html>');
  const b = store.import({ file, target, title: "Revised", id: a.id, expected_version: 1 });
  expect(b.revisions).toHaveLength(2);
  expect(() => store.import({ file, target, title: "Stale", id: a.id, expected_version: 1 })).toThrow("changed");
  expect(() => store.import({ file, target, title: "No base", id: a.id })).toThrow("expected_version");
  expect(store.content(a.id, 1).html).toBe(original);
  const c = store.restore(a.id, 1, 2); expect(c.revisions).toHaveLength(3);
  expect(c.revisions[2]?.restored_from).toBe(1); expect(store.content(a.id).html).toBe(original);
  expect(store.content(a.id, 2).html).toContain("new content");
  expect(() => store.restore(a.id, 99, 3)).toThrow("not found");
  expect(() => store.restore(a.id, 1, 2)).toThrow("changed");
});
test("collection artifacts follow membership; targets cannot be moved or invented", () => {
  const f = learningFixture(), store = new StudyArtifacts(f.a.root), file = sample(f.a.root);
  const course = store.import({ file, title: "Course", target: { kind: "collection", id: "collection" } });
  const focused = store.import({ file, title: "Detail", target: { kind: "insight", id: "one" } });
  expect(store.forInsight("one").map(a => a.id)).toEqual([course.id, focused.id]);
  expect(store.forInsight("two").map(a => a.id)).toEqual([course.id]);
  expect(new StudyArtifacts(f.b.root).forInsight("one")).toEqual([]);
  expect(() => store.import({ file, title: "Wrong", target: { kind: "insight", id: "absent" } })).toThrow("not found");
  expect(() => store.import({ file, title: "Move", id: course.id, expected_version: 1, target: focused.target })).toThrow("target");
  expect(() => store.content("../../secrets")).toThrow("Invalid");
});
test("refuses malformed files, oversized input, damaged blobs and unsafe storage", () => {
  const f = learningFixture(), store = new StudyArtifacts(f.a.root), target = { kind: "insight" as const, id: "one" };
  const file = sample(f.a.root, "not html");
  expect(() => store.import({ file, target, title: "Bad" })).toThrow("HTML");
  writeFileSync(file, new Uint8Array(MAX_STUDY_BYTES + 1));
  expect(() => store.import({ file, target, title: "Big" })).toThrow("8 MiB");
  writeFileSync(file, new Uint8Array([0xff,0xff]));
  expect(() => store.import({ file, target, title: "Encoding" })).toThrow();
  sample(f.a.root); const a = store.import({ file, target, title: "Good" });
  writeFileSync(join(f.a.root, ".codetrap/learning/artifacts/blobs", a.revisions[0]!.sha256 + ".html"), "corrupt");
  expect(() => store.content(a.id)).toThrow("integrity");
  writeFileSync(join(f.a.root, ".codetrap/learning/artifacts/index.json"), JSON.stringify({ version: 1, artifacts: [{...a,revisions:[{...a.revisions[0],sha256:'../secret'}]}] }));
  expect(() => store.list()).toThrow("revision");
});
test.skipIf(process.platform === "win32")("rejects symlink file and storage escapes", () => {
  const f = learningFixture(), file = sample(f.a.root), store = new StudyArtifacts(f.a.root), target = {kind:"insight" as const,id:"one"};
  const link = join(f.a.root,"link.html"); symlinkSync(file,link);
  expect(()=>store.import({file:link,target,title:"Link"})).toThrow("symbolic");
  mkdirSync(join(f.a.root,".codetrap/learning"),{recursive:true});
  symlinkSync(f.b.root,join(f.a.root,".codetrap/learning/artifacts"));
  expect(()=>store.import({file,target,title:"Escape"})).toThrow("Unsafe");
});
test("CLI supports JSON stdin, exact-version updates and export without overwrite", () => {
  const f = learningFixture(), file = sample(f.a.root), target = {kind:"collection",id:"collection"};
  const run = (args:string[],stdin?:string)=>runCli(["learn","artifact",...args,"--json"],f.a.root,f.home,stdin);
  const first = run(["import","--input-json","-"],JSON.stringify({file,target,title:"Course 中文"}));
  expect(first.exitCode).toBe(0); const id = JSON.parse(first.stdout).artifact.id;
  expect(JSON.parse(run(["list","--collection","collection"]).stdout).artifacts).toHaveLength(1);
  const output=join(f.a.root,"export.html");
  expect(run(["export",id,"--output",output]).exitCode).toBe(0);
  expect(readFileSync(output,"utf8")).toBe(readFileSync(file,"utf8"));
  expect(run(["export",id,"--output",output]).exitCode).toBe(1);
  expect(run(["restore",id,"--version","1bad","--expected-version","1"]).exitCode).toBe(1);
  const update=run(["import","--file",file,"--title","Update","--collection","collection","--id",id,"--expected-version","1"]);
  expect(update.exitCode).toBe(0);
  expect(JSON.parse(run(["versions",id]).stdout).artifact.revisions).toHaveLength(2);
  const stale=run(["restore",id,"--version","1","--expected-version","1"]);
  expect(JSON.parse(stale.stdout).success).toBe(false);
});
test("API protects all content and returns JSON only, scoped to the selected project", async () => {
  const f=learningFixture(),file=sample(f.a.root),store=new StudyArtifacts(f.a.root);
  const a=store.import({file,title:"A",target:{kind:"insight",id:"one"}});
  const query='project='+encodeURIComponent(f.a.root)+'&id='+a.id+'&version=1';
  const url='http://localhost/api/learning/artifact?'+query;
  expect((await f.handler(new Request(url))).status).toBe(401);
  const res=await f.handler(new Request(url,{headers:{'X-Codetrap-Token':'learning-token'}}));
  expect(res.headers.get('content-type')).toContain('application/json');
  expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  expect((await res.json()).html).toContain('<button');
  const wrong=await f.handler(new Request(url.replace(encodeURIComponent(f.a.root),encodeURIComponent(f.b.root)),{headers:{'X-Codetrap-Token':'learning-token'}}));
  expect(wrong.status).toBe(400);
});
