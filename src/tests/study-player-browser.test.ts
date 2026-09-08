import { expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { learningFixture } from "./web-learning-fixture";
import { StudyArtifacts } from "../lib/study-artifacts";
import { chromeExecutablePath, launchBrowser, configureBrowserPage, browserTestTimeout } from "./browser-helper";
const browserTest=chromeExecutablePath()?test:test.skip;
function importLesson(root:string,html:string,title="Lesson"){
  const file=join(root,'browser-lesson.html');writeFileSync(file,html);
  return new StudyArtifacts(root).import({file,title,target:{kind:'insight',id:'one'}});
}
browserTest("player runs interactions but cannot access parent, storage, API or external resources",async()=>{
  const f=learningFixture();let probes=0;
  const artifact=importLesson(f.a.root,`<!doctype html><html><body><button id="advance" onclick="this.textContent='Done'">Next</button><output id="result"></output><script>
    const checks=[];
    try { parent.document.body.dataset.compromised='yes'; checks.push('parent exposed'); } catch {checks.push('parent blocked')}
    try {localStorage.setItem('escape','yes');checks.push('storage exposed')}catch{checks.push('storage blocked')}
    fetch('/api/probe').then(()=>checks.push('fetch exposed')).catch(()=>{checks.push('fetch blocked');document.querySelector('#result').textContent=checks.join(',')});
    const image=new Image();image.src='/probe';document.body.append(image);
    try {top.location.hash='compromised'}catch{}
  </script></body></html>`);
  const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch(req){if(new URL(req.url).pathname.includes('probe'))probes++;return f.handler(req)}});
  const browser=await launchBrowser();
  try{
    const page=await browser.newPage({viewport:{width:1400,height:950}});configureBrowserPage(page);
    await page.goto(`http://127.0.0.1:${server.port}/?token=learning-token`+f.a.hash());
    await page.locator('#study-interactive-tab').click();
    const frame=page.frameLocator('#study-player iframe');
    await frame.locator('#result').filter({hasText:'fetch blocked'}).waitFor();
    // Wait for the hostile fixture to finish initialization before interacting.
    // Keyboard activation tests interaction without depending on cross-frame pointer coordinates.
    await frame.locator('#advance').focus();
    await frame.locator('#advance').press('Enter');
    await frame.locator('#advance').filter({hasText:'Done'}).waitFor();
    expect(await frame.locator('#advance').textContent()).toBe('Done');
    expect(await frame.locator('#result').textContent()).toContain('parent blocked');
    expect(await frame.locator('#result').textContent()).toContain('storage blocked');
    expect(await page.locator('body').getAttribute('data-compromised')).toBeNull();
    expect(page.url()).not.toContain('compromised');expect(probes).toBe(0);
    expect(await page.locator('#study-player iframe').getAttribute('sandbox')).toBe('allow-scripts');
    await page.locator('#study-text-tab').click();expect(await page.locator('#study-written').isVisible()).toBe(true);
    await page.locator('#study-interactive-tab').click();expect(await frame.locator('#advance').textContent()).toBe('Done');
    const store=new StudyArtifacts(f.a.root),file=join(f.a.root,'browser-lesson.html');writeFileSync(file,'<html><body><h1>New revision</h1></body></html>');
    store.import({file,title:'Version two',target:artifact.target,id:artifact.id,expected_version:1});
    await page.getByRole('button',{name:'Reload lessons',exact:true}).click();await frame.locator('h1').waitFor();
    expect(await frame.locator('h1').textContent()).toBe('New revision');
    await page.locator('#study-version').selectOption(artifact.id+':1');await frame.locator('#advance').waitFor();
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }finally{await browser.close();server.stop(true)}
},browserTestTimeout(20000));
browserTest("late content cannot replace another insight and failed loads allow retry",async()=>{
  const f=learningFixture();importLesson(f.a.root,'<html><body><h1>First insight</h1></body></html>');
  let release=()=>{},arrived=()=>{};const pending=new Promise<void>(r=>{release=r}),started=new Promise<void>(r=>{arrived=r});let hold=true,fail=false;
  const server=Bun.serve({hostname:'127.0.0.1',port:0,async fetch(req){
    if(new URL(req.url).pathname==='/api/learning/artifact'){
      if(hold){hold=false;arrived();await pending}
      if(fail)return new Response('{}',{status:500});
    }
    return f.handler(req);
  }}),browser=await launchBrowser();
  try{
    const page=await browser.newPage();configureBrowserPage(page);
    await page.goto(`http://127.0.0.1:${server.port}/?token=learning-token`+f.a.hash());await page.locator('#study-interactive-tab').click();await started;
    await page.locator('#next-learning').click();release();await page.locator('#study-interactive-tab').click();
    await page.getByText('No interactive lesson attached yet.',{exact:false}).waitFor();expect(await page.locator('#study-player iframe').count()).toBe(0);
    fail=true;await page.locator('#previous-learning').click();await page.locator('#study-interactive-tab').click();
    await page.getByText('Could not load this lesson.',{exact:false}).waitFor();
    fail=false;await page.getByRole('button',{name:'Reload lessons',exact:true}).click();
    await page.frameLocator('#study-player iframe').locator('h1').waitFor();
    expect(await page.frameLocator('#study-player iframe').locator('h1').textContent()).toBe('First insight');
  }finally{release();await browser.close();server.stop(true)}
},browserTestTimeout(20000));
