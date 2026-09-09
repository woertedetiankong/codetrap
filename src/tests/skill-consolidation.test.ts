import { expect, test } from 'bun:test';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { runClientSetup, BUNDLED_SKILLS, skillFiles } from '../lib/client-setup';
import { buildClientHealth } from '../lib/client-health';
import { tempDir, tempHome, runCli } from './helpers';

for (const client of ['codex','claude'] as const) {
 test(`${client}: three defaults, legacy backups, optional review lifecycle and resource repair`, () => {
  const root=tempDir('skill-migrate-'), home=tempHome(), clientHome=join(home,client);
  const legacy=join(clientHome,'skills','codetrap-search');mkdirSync(legacy,{recursive:true});writeFileSync(join(legacy,'SKILL.md'),'user customization');writeFileSync(join(legacy,'extra.txt'),'keep me');
  const other=join(clientHome,'skills','unrelated');mkdirSync(other,{recursive:true});writeFileSync(join(other,'SKILL.md'),'mine');
  const options={cwd:root,clientHome,skipAgents:true};
  const preview=runClientSetup(client,{...options,dryRun:true});expect(preview.skills.filter(s=>s.status==='would_install')).toHaveLength(3);expect(existsSync(legacy)).toBe(true);
  const result=runClientSetup(client,options);const old=result.skills.find(s=>s.name==='codetrap-search')!;
  expect(old.status).toBe('archived');expect(readFileSync(join(old.backup!,'extra.txt'),'utf8')).toBe('keep me');expect(existsSync(legacy)).toBe(false);expect(existsSync(other)).toBe(true);
  for(const entry of BUNDLED_SKILLS)for(const [path,content]of Object.entries(skillFiles(entry)))expect(readFileSync(join(clientHome,'skills',entry.name,path),'utf8')).toBe(content);
  expect(runClientSetup(client,options).skills).toHaveLength(3);
  expect(buildClientHealth(client,root,clientHome).skills.missing).toEqual([]);
  expect(runClientSetup(client,{...options,withReview:true}).skills).toHaveLength(4);
  expect(runClientSetup(client,options).skills).toHaveLength(4);
  expect(runClientSetup(client,{...options,withoutReview:true}).skills.find(s=>s.name==='codetrap-review')?.status).toBe('archived');
  expect(runClientSetup(client,options).skills).toHaveLength(3);
  const resource=join(clientHome,'skills/codetrap-study/references/external-source.md');writeFileSync(resource,'custom resource');
  expect(buildClientHealth(client,root,clientHome).skills.outdated).toContain('codetrap-study');
  const repair=runClientSetup(client,options).skills.find(s=>s.name==='codetrap-study')!;
  expect(readFileSync(join(repair.backup!,'references/external-source.md'),'utf8')).toBe('custom resource');
  expect(buildClientHealth(client,root,clientHome).skills.outdated).toEqual([]);
  const bad=runCli(['setup',client,'--with-review','--without-review','--no-agents','--json'],root,home);expect(bad.exitCode).not.toBe(0);
 });
}
