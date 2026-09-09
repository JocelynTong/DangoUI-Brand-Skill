import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'

const out=path.dirname(new URL(import.meta.url).pathname),host='http://127.0.0.1:10092/#/pages/event/index?id=0'
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']})
const results=[]
for(const viewport of [{width:390,height:844},{width:536,height:864},{width:1280,height:720}]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'}),page=await context.newPage(),requests=[]
  page.on('request',r=>requests.push({method:r.method(),url:r.url()}))
  await page.goto(host,{waitUntil:'networkidle'})
  const installed=await page.evaluate(async()=>{const m=await import('/@fs/Users/jocelyn/Downloads/vibecoding-docs-demo/card-plugin2.0/frontend/node_modules/.vite/deps/@tarojs_router.js');window.__qaRouterModule=m;window.__qaOriginalRouterHistory=m.history;const proxy=new Proxy(m.history,{get(target,key){if(key==='push')return()=>{throw new Error('QA_NAVIGATION_REJECTION')};const value=target[key];return typeof value==='function'?value.bind(target):value}});m.setHistory(proxy);return m.history===proxy})
  await page.locator('.topdeck').first().click()
  await page.locator('.doverlay.shown').waitFor({timeout:5000})
  const restored=await page.evaluate(()=>{window.__qaRouterModule.setHistory(window.__qaOriginalRouterHistory);delete window.__qaRouterModule;delete window.__qaOriginalRouterHistory;return !Object.prototype.hasOwnProperty.call(window,'__qaOriginalRouterHistory')})
  const states={installed,restored,fallbackUrl:page.url(),shown:true}
  const titleToggle=page.locator('.doverlay .title-toggle-inline');if(await titleToggle.count()){await titleToggle.press('Enter');states.titleExpanded=await titleToggle.getAttribute('aria-expanded');await titleToggle.press('Space')}
  const descToggle=page.locator('.doverlay .desc-toggle-inline');if(await descToggle.count()){await descToggle.press('Space');states.descExpanded=await descToggle.getAttribute('aria-expanded');await descToggle.press('Enter')}
  await page.locator('.doverlay .tb').nth(1).press('Enter');states.textSelected=await page.locator('.doverlay .tb').nth(1).getAttribute('aria-selected')
  await page.locator('.doverlay .txt-row').first().press('Space');await page.locator('.cv.on').waitFor();states.textViewer=true;await page.locator('.cv').click({position:{x:3,y:3}})
  await page.locator('.doverlay .tb').first().press('Space');states.imageSelected=await page.locator('.doverlay .tb').first().getAttribute('aria-selected')
  await page.locator('.doverlay .gcard').first().press('Enter');await page.locator('.cv.on').waitFor();states.imageViewer=true;await page.locator('.cv').click({position:{x:3,y:3}})
  await page.locator('.doverlay .buybtn').press('Enter');states.buyToast=await page.locator('body').evaluate(e=>e.innerText.includes('去购买 ｜ 跳转卡组 SPU'))
  const fav=page.locator('.doverlay .dbtn-fav');const favBefore=await fav.innerText();await fav.click();states.favorite={before:favBefore,after:await fav.innerText()}
  const probe=await page.evaluate(()=>{const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)],r=e=>{const x=e.getBoundingClientRect();return{left:x.left,top:x.top,right:x.right,bottom:x.bottom,width:x.width,height:x.height}};const controls=qa('.doverlay [role="button"],.doverlay [role="tab"]');return{overlay:r(q('.doverlay')),controls:controls.length,undersized:controls.filter(e=>r(e).width<44||r(e).height<44).map(e=>({className:e.className,rect:r(e)})),nonFocusable:controls.filter(e=>e.tabIndex<0).map(e=>e.className),overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),reducedMotion:qa('.doverlay,.doverlay *').filter(e=>{const s=getComputedStyle(e);return(s.animationName!=='none'&&s.animationDuration!=='0s')||s.transitionDuration!=='0s'}).length}})
  await page.screenshot({path:path.join(out,`overlay-${viewport.width}x${viewport.height}.png`),fullPage:false})
  await page.locator('.doverlay .dbtn-copy').press('Space');await page.waitForURL(/pages\/build\/index/);states.copyNavigated=true;states.closed=!await page.locator('.doverlay.shown').count()
  results.push({viewport,states,probe,writes:requests.filter(r=>!['GET','HEAD','OPTIONS'].includes(r.method))})
  await context.close()
}
await browser.close();await fs.writeFile(path.join(out,'overlay-harness-probes.json'),JSON.stringify({schema:'heldout-detail-overlay-approved-harness/v1',attempt:24,testOnly:true,productionSourceChanged:false,results},null,2)+'\n')
