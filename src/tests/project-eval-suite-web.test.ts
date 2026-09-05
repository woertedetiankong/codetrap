import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { webSuiteFixture } from "./project-eval-suite-fixture";
import { tempProjectDir } from "./helpers";

test("ordinary project suite APIs preview and accept explicitly, without creating source fixtures or observation evidence", async () => {
  const f = webSuiteFixture();
  expect((await (await f.api("")).json()).state).toBe("missing");
  const preview = await (await f.api("/preview?origin=library")).json();
  expect(existsSync(join(f.project, ".codetrap/evals"))).toBe(false);
  for (const executor of [undefined, "agent"]) expect((await f.api("/create", { origin: "library", digest: preview.digest, executor })).status).toBe(403);
  expect((await f.api("/create", { origin: "library", digest: preview.digest, executor: "user" })).status).toBe(200);
  const input = { query: "transaction rollback", judgment: "useful_hit", goldTrapIds: [1] };
  const p = await (await f.api("/case-preview", { input })).json();
  expect(p.case).toMatchObject({ mode: "fts", minRecallAt3: 0, minRecallAt5: 1 });
  expect((await f.api("/case-accept", { input, digest: p.digest, requestId: "request-api-123", executor: "agent" })).status).toBe(403);
  const args = { input, digest: p.digest, requestId: "request-api-123", executor: "user" };
  expect((await f.api("/case-accept", args)).status).toBe(200);
  expect((await (await f.api("/case-accept", args)).json()).already_committed).toBe(true);
  const status = await (await f.api("")).json();
  const download = await (await f.api("/export?digest=" + status.sha256)).json();
  expect(JSON.parse(download.content).queries).toHaveLength(1);
  expect(download.filename).toBe("codetrap-eval-suite.json");
  expect((await f.api("/export?digest=stale")).status).toBe(400);
  expect((await f.api("/create", { origin: "library", digest: preview.digest, executor: "user", projectRoot: tempProjectDir("unregistered-suite-") })).status).toBe(403);
  expect(existsSync(join(f.project, "src"))).toBe(false);
  expect(existsSync(join(f.project, ".codetrap/observations"))).toBe(false);
});
