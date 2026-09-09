import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const out = path.dirname(new URL(import.meta.url).pathname)
const base = 'http://127.0.0.1:10092/#/pages/plaza/index'
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({ headless: true, executablePath: chrome, args: ['--no-sandbox'] })
const viewports = [
  { id: 'fresh-390x844-plaza', width: 390, height: 844 },
  { id: 'fresh-536x864-plaza', width: 536, height: 864 },
  { id: 'fresh-1280x720-plaza', width: 1280, height: 720 },
]

const rect = `el => { const r=el.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height} }`
const renders=[]
for (const viewport of viewports) {
  const context=await browser.newContext({viewport,reducedMotion:'reduce'})
  const page=await context.newPage(); const requests=[]
  page.on('request',r=>requests.push({method:r.method(),url:r.url()}))
  await page.goto(base,{waitUntil:'networkidle',timeout:30000})
  const probe=await page.evaluate(new Function(`
    const rect=${rect};
    const wrap=document.querySelector('.search-wrap'), search=document.querySelector('.search'), input=document.querySelector('input');
    const panel=document.querySelector('.filter-panel'), lines=[...document.querySelectorAll('.filterline')];
    const env=document.querySelector('.filterline.second .filter-scroll'), chips=[...document.querySelectorAll('.filterline.second .chip')];
    const firstCard=document.querySelector('.deck-card[role="button"]'), season=document.querySelector('.season-banner,[class*="season"]');
    const wr=rect(wrap),sr=rect(search),ir=rect(input),pr=rect(panel),er=rect(env), lr=lines.map(rect);
    const chipRects=chips.map(el=>({text:el.textContent.trim(),...rect(el)}));
    const visible=chipRects.filter(r=>r.right>er.left&&r.left<er.right&&r.bottom>er.top&&r.top<er.bottom);
    const partial=visible.filter(r=>r.left<er.left-.5||r.right>er.right+.5||r.top<er.top-.5||r.bottom>er.bottom+.5);
    const cs=el=>{const s=getComputedStyle(el);return {display:s.display,height:s.height,lineHeight:s.lineHeight,paddingTop:s.paddingTop,paddingBottom:s.paddingBottom,alignItems:s.alignItems,overflowX:s.overflowX,overflowY:s.overflowY}};
    const fold=el=>{if(!el)return false;const r=el.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0};
    return {
      document:{scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,overflowPx:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth)},
      search:{wrap:wr,outer:sr,input:ir,wrapTopInset:sr.top-wr.top,wrapBottomInset:wr.bottom-sr.bottom,inputTopInset:ir.top-sr.top,inputBottomInset:sr.bottom-ir.bottom,computed:{wrap:cs(wrap),outer:cs(search),input:cs(input)}},
      verticalGaps:{navToSearch:(()=>{const n=document.querySelector('.topnav,.tabs-row,.nav-tabs');return n?wr.top-n.getBoundingClientRect().bottom:null})(),searchToPanel:pr.top-wr.bottom,panelToSeason:season.getBoundingClientRect().top-pr.bottom},
      panel:{rect:pr,computed:cs(panel),lines:lr,lineGap:lr[1].top-lr[0].bottom,contentBottomGap:pr.bottom-lr.at(-1).bottom},
      environment:{rect:er,computed:cs(env),scrollWidth:env.scrollWidth,clientWidth:env.clientWidth,scrollLeft:env.scrollLeft,optionCount:chips.length,visibleCount:visible.length,partial,chipTopInset:Math.min(...chipRects.map(r=>r.top))-er.top,chipBottomInset:er.bottom-Math.max(...chipRects.map(r=>r.bottom)),scrollable:env.scrollWidth>env.clientWidth},
      fold:{season:fold(season),firstCard:fold(firstCard),seasonTop:rect(season).top,firstCardTop:rect(firstCard).top},
      interactiveCount:document.querySelectorAll('.filterline .chip[role="button"]').length,
    }
  `))
  const screenshot=`${viewport.id}.png`; await page.screenshot({path:path.join(out,screenshot),fullPage:true})
  renders.push({viewport,screenshot,probe,writes:requests.filter(r=>!['GET','HEAD','OPTIONS'].includes(r.method))})
  await context.close()
}

const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
const page=await context.newPage(); const requests=[]; page.on('request',r=>requests.push({method:r.method(),url:r.url()}))
await page.goto(base,{waitUntil:'networkidle',timeout:30000})
const all=await page.locator('.filterline .chip').all(); const reachability=[]
for(let i=0;i<all.length;i++){
  await all[i].focus()
  reachability.push(await all[i].evaluate((el,index)=>{const r=el.getBoundingClientRect(),s=el.closest('.filter-scroll'),p=s.getBoundingClientRect();return{index,text:el.textContent.trim(),role:el.getAttribute('role'),tabIndex:el.tabIndex,ariaPressed:el.getAttribute('aria-pressed'),focused:document.activeElement===el,fullyVisible:r.left>=p.left-.5&&r.right<=p.right+.5&&r.top>=p.top-.5&&r.bottom<=p.bottom+.5,scrollLeft:s.scrollLeft}},i))
}
async function activate(mechanism){
  await page.goto(base,{waitUntil:'networkidle',timeout:30000}); const chip=page.locator('.filterline.second .chip').last(); await chip.focus();
  const before=await chip.getAttribute('aria-pressed'); if(mechanism==='pointer') await chip.click(); else await chip.press(mechanism)
  return chip.evaluate((el,args)=>({mechanism:args.mechanism,before:args.before,after:el.getAttribute('aria-pressed'),focused:document.activeElement===el,text:el.textContent.trim()}),{mechanism,before})
}
const interactions=[]; for(const m of ['pointer','Enter','Space']) interactions.push(await activate(m))
await page.goto(base,{waitUntil:'networkidle',timeout:30000}); const env=page.locator('.filterline.second .filter-scroll');
await env.evaluate(el=>el.scrollLeft=0); const b=await env.boundingBox(); await page.mouse.move(b.x+b.width/2,b.y+b.height/2); await page.mouse.wheel(500,0);
const horizontalWheel=await env.evaluate(el=>({scrollLeft:el.scrollLeft,moved:el.scrollLeft>0}))
await env.evaluate(el=>el.scrollLeft=0); await page.mouse.wheel(0,500)
const verticalWheel=await env.evaluate(el=>({scrollLeft:el.scrollLeft,moved:el.scrollLeft>0}))
await page.goto(base,{waitUntil:'networkidle',timeout:30000}); const last=page.locator('.filterline.second .chip').last(); await last.click();
const pointerReveal=await last.evaluate(el=>{const r=el.getBoundingClientRect(),s=el.closest('.filter-scroll'),p=s.getBoundingClientRect();return{text:el.textContent.trim(),selected:el.getAttribute('aria-pressed'),fullyVisible:r.left>=p.left-.5&&r.right<=p.right+.5,scrollLeft:s.scrollLeft}})
await context.close()

const regression=[]; const attempt4=path.resolve(out,'../4')
for(const route of ['build','mine','event','round','detail']){
  const c=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),p=await c.newPage();
  const suffix=route==='event'?'?id=0':route==='round'?'?event=0&round=1':route==='detail'?'?id=0':'';
  await p.goto(`http://127.0.0.1:10092/#/pages/${route}/index${suffix}`,{waitUntil:'networkidle',timeout:30000}); const png=await p.screenshot({fullPage:true});
  const old=path.join(attempt4,`mobile-390x844-${route}-fresh.png`); let oldSha=null; try{oldSha=crypto.createHash('sha256').update(await fs.readFile(old)).digest('hex')}catch{}
  const sha=crypto.createHash('sha256').update(png).digest('hex'); regression.push({route,sha256:sha,attempt4Sha256:oldSha,exactMatch:sha===oldSha,overflowPx:await p.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth))}); await c.close()
}
await browser.close()
const result={schema:'heldout-plaza-spacing-fresh-qa/v1',attempt:8,generatedAt:new Date().toISOString(),fresh:true,readOnly:true,base,renders,reachability,interactions,horizontalWheel,verticalWheel,pointerReveal,writes:requests.filter(r=>!['GET','HEAD','OPTIONS'].includes(r.method)),regression}
await fs.writeFile(path.join(out,'browser-probes.json'),JSON.stringify(result,null,2)+'\n')
