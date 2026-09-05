import { expect, test } from "bun:test";
import { revisionFixture, revisionInput } from "./experience-revision-fixture";
import { trap, tempProjectDir } from "./helpers";

test("revision API scopes dossiers and returns only the reviewed content, requiring explicit decisions", async () => {
  const f = revisionFixture();
  f.store.add(trap({ scope: "global", title: "SECRET_OTHER_LESSON" }));
  const context = await (await f.api("/context?eventId=" + f.exposure.id)).json();
  expect(context).toMatchObject({ source: { scope: "project", trap_id: 1 }, editable: true });
  const decision = { eventId: f.exposure.id, feedback: "irrelevant", requestId: "request-web-1111" };
  expect((await f.api("/feedback", decision)).status).toBe(403);
  expect((await f.api("/feedback", { ...decision, executor: "agent" })).status).toBe(403);
  const feedback = await (await f.api("/feedback", { ...decision, executor: "user" })).json();
  const save = { id: "rev-web-12345678", eventId: feedback.event_id, draft: revisionInput };
  const response = await f.api("/draft", save);
  expect(response.status).toBe(200);
  const d = await response.json();
  expect(d.corpus_count).toBe(2);
  for (const secret of ["SECRET_OTHER_LESSON", "PRIVATE_QUERY", '"corpus":', '"owner":']) expect(JSON.stringify(d)).not.toContain(secret);
  // An ambiguous first response may be retried with the same ID and same content.
  expect((await f.api("/draft", save)).status).toBe(200);
  const tested = await (await f.api("/evaluate", { id: d.id, digest: d.digest })).json();
  expect(tested.evaluation.passed).toBe(true);
  for (const executor of [undefined, "agent"]) expect((await f.api("/accept", { id: d.id, digest: d.digest, executor })).status).toBe(403);
  expect((await f.api("/accept", { id: d.id, digest: d.digest, executor: "user" })).status).toBe(200);
  expect(await (await f.api("?scope=project&trapId=1")).json()).toMatchObject([{ id: d.id, status: "accepted" }]);
  expect(await (await f.api("?scope=global&trapId=1")).json()).toEqual([]);
  expect((await f.api("/rollback", { id: d.id, digest: d.digest, executor: "user" })).status).toBe(200);
  expect((await f.api("/draft", { ...save, projectRoot: tempProjectDir("outside-revision-") })).status).toBe(403);
  expect((await f.api("?scope=all&trapId=1")).status).toBe(400);
  expect((await f.api("/item?id=..%2Fbad")).status).toBe(400);
});
