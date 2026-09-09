import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const out=path.dirname(new URL(import.meta.url).pathname),base='http://127.0.0.1:10092/#/pages/detail/index?id=0'
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']})
const renders=[]
for(const viewport of [{width:390,height:844},{width:536,height:864},{width:1280,height:720}]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'}),page=await context.newPage(),requests=[]
  page.on('request',r=>requests.push({method:r.method(),url:r.url()}))
  await page.goto(base,{waitUntil:'networkidle',timeout:30000})
  const probe=await page.evaluate(()=>{
    const q=s=>document.querySelector(s),rect=e=>{const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}}
    const css=(s,p)=>getComputedStyle(q(s))[p], owners=['.buybtn','.dbtn-fav','.dbtn-copy'].map(q)
    const all=[...document.querySelectorAll('.buybtn,.buybtn *,.dbtn,.dbtn *')]
    const purpleVisual=all.flatMap(e=>{const s=getComputedStyle(e);return [s.color,s.backgroundColor,s.borderColor,s.outlineColor].map(v=>({node:e.className,value:v}))}).filter(x=>/rgb\((?:10[0-9]|11[0-9]|12[0-9]),\s*(?:5[0-9]|6[0-9]|7[0-9]),\s*(?:17[0-9]|18[0-9]|19[0-9]|20[0-9]|21[0-9])\)/.test(x.value))
    return {
      actionRects:Object.fromEntries(owners.map(e=>[e.className,rect(e)])),
      bottom:rect(q('.dbottom')),
      pageBottomPadding:getComputedStyle(q('.detail')).paddingBottom,
      colors:{price:css('.stat-price','color'),buy:css('.buybtn','backgroundColor'),favorite:css('.dbtn-fav','color'),favoriteBorder:css('.dbtn-fav','borderColor'),copy:css('.dbtn-copy','backgroundColor'),focus:css('.dbtn-copy','outlineColor'),bookmarkFilter:css('.dbtn-fav .dbtn-ic','filter')},
      purpleVisual,
      undersized:owners.filter(e=>rect(e).height<44||rect(e).width<44).map(e=>({className:e.className,rect:rect(e)})),
      clipping:[...document.querySelectorAll('.stat-price,.buy-t,.dbtn-t')].filter(e=>e.scrollWidth>e.clientWidth||e.scrollHeight>e.clientHeight).map(e=>e.className),
      reducedMotion:[...document.querySelectorAll('.detail,.detail *')].filter(e=>{const s=getComputedStyle(e);return s.animationName!=='none'&&s.animationDuration!=='0s'||s.transitionDuration!=='0s'}).length,
      overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth)
    }
  })
  const screenshot=`selfcheck-${viewport.width}x${viewport.height}-detail.png`
  await page.screenshot({path:path.join(out,screenshot),fullPage:true})
  renders.push({viewport,screenshot,probe,writes:requests.filter(r=>!['GET','HEAD','OPTIONS'].includes(r.method))})
  await context.close()
}
const otherRoutes=[]
for(const route of ['plaza','build','mine','event','round']){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),suffix=route==='event'?'?id=0':route==='round'?'?event=0&round=1':''
  await page.goto(`http://127.0.0.1:10092/#/pages/${route}/index${suffix}`,{waitUntil:'networkidle',timeout:30000})
  const png=await page.screenshot({fullPage:true})
  otherRoutes.push({route,sha256:crypto.createHash('sha256').update(png).digest('hex'),overflow:await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth))})
  await context.close()
}
await browser.close()
await fs.writeFile(path.join(out,'browser-probes.json'),JSON.stringify({schema:'heldout-detail-action-hierarchy-selfcheck/v1',attempt:22,generatedAt:new Date().toISOString(),readOnly:true,renders,otherRoutes},null,2)+'\n')
