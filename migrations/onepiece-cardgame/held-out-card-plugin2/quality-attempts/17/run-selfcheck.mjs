import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const out=path.dirname(new URL(import.meta.url).pathname),base='http://127.0.0.1:10092/#/pages/build/index'
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']})
const results=[]
for(const viewport of [{width:390,height:844},{width:536,height:864},{width:1280,height:720}]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'}),page=await context.newPage(),writes=[]
  page.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method()))writes.push({method:r.method(),url:r.url()})})
  await page.goto(base,{waitUntil:'networkidle'});await page.locator('.pubbtn').first().click();const env=page.locator('.envselect');
  const colors=await env.evaluate(e=>{const t=e.querySelector('.envtext'),ec=getComputedStyle(e),tc=getComputedStyle(t);return{text:tc.color,background:ec.backgroundColor,value:t.textContent.trim()}})
  await env.click();const pointer=await page.evaluate(()=>({expanded:document.querySelector('.envselect').getAttribute('aria-expanded'),wheelVisible:!!document.querySelector('.envpicker')&&document.querySelector('.envpicker').getBoundingClientRect().height>0}))
  await env.click();await env.focus();await page.keyboard.press('Enter');const enter=await page.evaluate(()=>({expanded:document.querySelector('.envselect').getAttribute('aria-expanded'),wheelVisible:!!document.querySelector('.envpicker')&&document.querySelector('.envpicker').getBoundingClientRect().height>0}))
  await page.keyboard.press('Enter');await env.focus();await page.keyboard.press('Space');const space=await page.evaluate(()=>({expanded:document.querySelector('.envselect').getAttribute('aria-expanded'),wheelVisible:!!document.querySelector('.envpicker')&&document.querySelector('.envpicker').getBoundingClientRect().height>0}))
  await page.keyboard.press('Space');await page.locator('.sheet-publish').click();const invalid=await page.evaluate(()=>({sheetOpen:document.querySelector('.sheet').classList.contains('on'),feedback:/请选择封面|请输入卡组名|不符合发布规则/.test(document.body.innerText)}))
  const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));await page.screenshot({path:path.join(out,`selfcheck-${viewport.width}x${viewport.height}-build-env.png`)});results.push({viewport,colors,pointer,enter,space,invalid,overflow,writes});await context.close()
}
const otherRoutes=[];for(const route of ['plaza','detail','mine','event','round']){const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),suffix=route==='detail'||route==='event'?'?id=0':route==='round'?'?event=0&round=1':'';await page.goto(`http://127.0.0.1:10092/#/pages/${route}/index${suffix}`,{waitUntil:'networkidle'});const png=await page.screenshot({fullPage:true});otherRoutes.push({route,sha256:crypto.createHash('sha256').update(png).digest('hex'),overflow:await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth))});await context.close()}
await browser.close();await fs.writeFile(path.join(out,'browser-probes.json'),JSON.stringify({schema:'heldout-build-state-contract-repair-selfcheck/v1',attempt:17,generatedAt:new Date().toISOString(),readOnly:true,results,otherRoutes},null,2)+'\n')
