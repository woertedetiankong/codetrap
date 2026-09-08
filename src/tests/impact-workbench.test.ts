import { GovernedEvalOperations } from "../lib/governed-eval-operations";
import { TrapOperations } from "../lib/trap-operations";
import { test, expect } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { revisionFixture } from './experience-revision-fixture';
import { impactWorkbenchWebPayload } from '../web/impact-workbench-view';
import { observationRunWebPayload } from '../web/observation-view';
import { parseWorkbench } from '../web/client-impact-data';
import { parseWorkspaceRoute, workspaceRouteHash } from '../web/client-route';

test('workbench follows corrected feedback, explicit misses, and pending exposures without leaking private queries', () => {
  const f=revisionFixture();
  let payload=impactWorkbenchWebPayload(f.project,f.home);
  expect(payload.pending?.run_id).toBe(f.call.run_id);
  expect(payload.pending_run_ids).toEqual([f.call.run_id]);
  const negative=f.feedback();
  payload=impactWorkbenchWebPayload(f.project,f.home);
  expect(payload.pending).toBeNull();
  expect(payload.issues).toHaveLength(1);
  expect(payload.issues[0]?.title).toBe(f.before.title);
  f.ops.feedback(negative,'helpful','correction-12345678');
  f.recorder.missed({...f.call,query:'PRIVATE missing query',expected_trap_id:1});
  payload=impactWorkbenchWebPayload(f.project,f.home);
  expect(payload.issues).toHaveLength(1);
  expect(payload.issues[0]?.kind).toBe('miss');
  expect(payload.issues[0]?.scope).toBeNull();
  expect(JSON.stringify(payload)).not.toContain('PRIVATE');
  expect(parseWorkbench(payload,f.project)).toEqual(payload);
  expect(()=>parseWorkbench(payload,'/unrelated')).toThrow();
});

test('saved revisions replace their source issue and corrupt dossiers do not hide healthy evidence',async()=>{
  const f=revisionFixture(),draft=await f.draft();
  let p=impactWorkbenchWebPayload(f.project,f.home);
  expect(p.issues).toHaveLength(0);
  expect(p.revisions.items[0]).toMatchObject({id:draft.draft.id,status:'draft',evaluation:'untested'});
  const tested=await f.ops.evaluate(draft.draft.id,draft.draft.digest);
  await f.ops.accept(tested.draft.id,tested.draft.digest);
  p=impactWorkbenchWebPayload(f.project,f.home);
  expect(p.revisions.items[0]).toMatchObject({status:'accepted',evaluation:'passed',positive:1,negative:1,passed:2,later_runs:0});
  const dir=join(f.project,'.codetrap/experience-revisions');mkdirSync(dir,{recursive:true});writeFileSync(join(dir,'rev-broken123.json'),'{broken');
  p=impactWorkbenchWebPayload(f.project,f.home);
  expect(p.revisions.unavailable).toBe(true);
  expect(p.revisions.items).toHaveLength(1);
  expect(JSON.stringify(p)).not.toContain('PRIVATE_REASON');
  // Old exposure content must never be relabeled with the newly applied lesson.
  const run=observationRunWebPayload(f.project,f.call.run_id,f.home);
  expect(run.lesson_previews?.[f.exposure.id]).toBeUndefined();
});

test('revision deep links preserve exact project-bound identities across reload',()=>{
  const route={mainView:'impact' as const,impactView:'improve' as const,improvementId:'event:中文/id',projectRef:'p-'+ 'a'.repeat(24)};
  expect(parseWorkspaceRoute(workspaceRouteHash(route))).toMatchObject(route);
  expect(parseWorkspaceRoute('#/impact/improve/revision%3Arev-123')).toMatchObject({impactView:'improve',improvementId:'revision:rev-123'});
});

test('reviewed miss signals leave the pending workbench while their governed record remains readable',()=>{
  const f=revisionFixture(),governed=new GovernedEvalOperations(f.project,new TrapOperations(f.store));
  f.recorder.missed({...f.call,query:'PRIVATE missing query',expected_trap_id:1});
  const issue=impactWorkbenchWebPayload(f.project,f.home,governed).issues.find(i=>i.kind==='miss')!;
  expect(issue.candidate_id).toBeString();
  governed.reject(issue.candidate_id!,'Not a reproducible retrieval issue');
  expect(impactWorkbenchWebPayload(f.project,f.home,governed).issues).toHaveLength(0);
  expect(governed.reviewState(issue.candidate_id!).review_status).toBe('rejected');
});
