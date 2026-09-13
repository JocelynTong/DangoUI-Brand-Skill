import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright-core';

const root = process.cwd();
const out = path.join(root, 'migrations/czn-v3/quality-attempts/4');
const shotRoot = path.join(out, 'screenshots');
fs.mkdirSync(shotRoot, { recursive: true });
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const browser = await chromium.launch({ headless: true });
const entries = []; const checks = []; const errors = [];
for (const spec of [
  { id:'czn-home', trigger:'.czn-current-download button', state:()=>document.querySelector('.czn-current-download button')?.textContent },
  { id:'czn-gameplay', trigger:'button[aria-label="Next"]', restore:'button[aria-label="Previous"]', state:()=>document.querySelector('.czn-current-gameplay header h2')?.textContent },
  { id:'czn-character', trigger:'button[aria-label="Next"]', restore:'button[aria-label="Previous"]', state:()=>document.querySelector('.czn-current-character__identity h2')?.textContent },
  { id:'czn-held-out', trigger:'button[aria-label="Next"]', restore:'button[aria-label="Previous"]', state:()=>document.querySelector('.czn-current-heldout__brief h2')?.textContent },
]) {
  const page = await browser.newPage({ viewport:{ width:1440, height:900 }, deviceScaleFactor:1 });
  page.on('pageerror', e => errors.push(`${spec.id}: ${e.message}`));
  await page.goto(`http://127.0.0.1:5175/?proof=desktop#/brand/czn/pages/${spec.id}`, { waitUntil:'networkidle' });
  await page.locator('.czn-current').waitFor();
  const dir = path.join(shotRoot, spec.id); fs.mkdirSync(dir, { recursive:true });
  const capture = async (state) => { const file=path.join(dir,`${state}.png`); await page.screenshot({path:file}); entries.push({pageId:spec.id,state,path:path.relative(root,file),sha256:sha(file),viewport:{width:1440,height:900}}); };
  const before = await page.evaluate(spec.state); await capture('00-default');
  await page.locator(spec.trigger).click(); const triggered = await page.evaluate(spec.state); await capture('01-triggered');
  await page.waitForTimeout(350); await capture('02-settled');
  if (spec.restore) await page.locator(spec.restore).click(); else await page.locator(spec.trigger).click();
  const restored = await page.evaluate(spec.state); await capture('03-restored');
  const geometry = await page.locator('.czn-current').evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}});
  const assets = await page.locator('.czn-current img').evaluateAll(imgs=>imgs.map(i=>({src:i.src,ready:i.complete&&i.naturalWidth>0,naturalWidth:i.naturalWidth})));
  const orange = await page.locator('.czn-current-nav .is-current').evaluate(el=>getComputedStyle(el).color);
  checks.push({pageId:spec.id,route:`/#/brand/czn/pages/${spec.id}`,geometry,before,triggered,restored,changed:before!==triggered,restoredOk:before===restored,orangeCurrentNav:orange,assetReadiness:assets,explicitEdgeControls:await page.locator('.czn-current-controls button').count(),portraitRail:await page.locator('.czn-current-portraits button').count(),skillCards:await page.locator('.czn-current-skills article').count(),fictionalDisclosure:await page.locator('.czn-current-heldout__disclosure').count()});
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(out,'demo-screenshot-manifest.json'),JSON.stringify({schema:'brand-demo-screenshot-manifest/v1',brand:'czn-v3',attempt:4,generatedAt:new Date().toISOString(),entries},null,2)+'\n');
fs.writeFileSync(path.join(out,'browser-checks.json'),JSON.stringify({schema:'czn-browser-checks/v1',brand:'czn-v3',attempt:4,visualVerdict:'not-self-assessed',checks,errors},null,2)+'\n');
console.log(`captured=${entries.length} checks=${checks.length} errors=${errors.length}`);
