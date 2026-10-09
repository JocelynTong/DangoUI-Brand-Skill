#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright-core';
import { installEffectiveVisibility, collectPassiveControlStates } from './run-rendered-evidence-collector.mjs';
import { inspectRenderedAsset } from './rendered-asset-specs.mjs';
const arg = (name, fallback) => process.argv.includes(name) ? process.argv[process.argv.indexOf(name)+1] : fallback;
const root = path.resolve(arg('--root', '.'));
const out = path.resolve(root, arg('--out-dir', 'output/viewport-controls'));
fs.mkdirSync(out, {recursive:true});
const write = (name,data) => fs.writeFileSync(path.join(out,name),JSON.stringify(data,null,2)+'\n');
const browser = await chromium.launch({headless:true,args:['--disable-blink-features=AutomationControlled']});
try {
  const context = await browser.newContext({viewport:{width:Number(arg('--width',1440)),height:Number(arg('--height',900))},locale:'en-US',colorScheme:'light'});
  await context.addInitScript(installEffectiveVisibility);
  const page = await context.newPage();
  await page.goto(arg('--source-url',''),{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(2000);
  await page.evaluate(async()=>{await document.fonts.ready;});
  const capturePath=path.join(out,'viewport.png');
  await page.screenshot({path:capturePath});
  const specs=await inspectRenderedAsset(capturePath,'image/png');
  if(specs.inspection.status!=='inspected'||!specs.intrinsicSize.width||!specs.intrinsicSize.height)throw Error('EVIDENCE_CAPTURE_NOT_PERSISTABLE');
  const capture={path:path.relative(root,capturePath),sha256:crypto.createHash('sha256').update(fs.readFileSync(capturePath)).digest('hex')};
  write('persistence-probe.json',{status:'passed',checkedAt:new Date().toISOString(),beforeFullCollection:true,capture,intrinsicSize:specs.intrinsicSize,inspection:specs.inspection,scope:'viewport-only corrective capture'});
  const census=await page.evaluate(()=>({url:location.href,documentLang:document.documentElement.lang,translated:!!document.querySelector('.translated-ltr,.translated-rtl'),scrollTop:scrollY,controls:[...document.querySelectorAll('button:not([disabled]),a[href],[role="button"],input:not([disabled])')].map((e,index)=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return{index,selector:e.tagName.toLowerCase()+[...e.classList].map(x=>'.'+x).join(''),text:e.textContent.trim(),href:e.getAttribute('href'),rect:{x:r.x,y:r.y,width:r.width,height:r.height},visibility:window.__brandEffectiveVisibility(e),computed:{color:c.color,backgroundColor:c.backgroundColor,filter:c.filter},before:{backgroundColor:getComputedStyle(e,'::before').backgroundColor},ancestors:[...function*(n){while(n.parentElement){n=n.parentElement;yield n;}}(e)].filter(n=>/hidden|clip|scroll|auto/.test(getComputedStyle(n).overflowX+' '+getComputedStyle(n).overflowY)).map(n=>({tag:n.tagName,className:n.className,overflowX:getComputedStyle(n).overflowX,overflowY:getComputedStyle(n).overflowY,rect:{x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height},clientWidth:n.clientWidth,clientHeight:n.clientHeight}))};})}));
  write('census.json',{...census,capture});
  const states=await collectPassiveControlStates(page,out,root,{selector:arg('--selector','button:not([disabled]),a[href],[role="button"],input:not([disabled])'),maxControls:30});
  write('control-state-evidence.json',states);
  await context.close();
  console.log(JSON.stringify({out,capture,visible:census.controls.filter(c=>c.visibility.visible).map(c=>c.text),sampled:states.entries.length}));
}finally{await browser.close();}
