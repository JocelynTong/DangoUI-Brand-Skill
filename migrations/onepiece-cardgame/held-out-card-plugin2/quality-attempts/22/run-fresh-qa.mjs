import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const out = path.dirname(new URL(import.meta.url).pathname)
const origin = 'http://127.0.0.1:10092'
const browser = await chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--no-sandbox']})
const viewports = [{width:390,height:844},{width:536,height:864},{width:1280,height:720}]
const renders = []

const actionProbe = async (viewport) => {
  const context = await browser.newContext({viewport,reducedMotion:'reduce'})
  const page = await context.newPage(), requests=[]
  page.on('request',r=>requests.push({method:r.method(),url:r.url()}))
  await page.goto(`${origin}/#/pages/detail/index?id=0`,{waitUntil:'networkidle',timeout:30000})
  const metrics = await page.evaluate(()=>{
    const q=s=>document.querySelector(s), rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}}
    const css=(e,p)=>getComputedStyle(e)[p]
    const owners=['.buybtn','.dbtn-fav','.dbtn-copy'].map(q)
    const actionNodes=[...document.querySelectorAll('.stat-price,.buybtn,.buybtn *,.dbtn,.dbtn *')]
    const rgb=v=>{const m=v?.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);return m&&m.slice(1).map(Number)}
    const purple=v=>{const c=rgb(v);if(!c)return false;const [r,g,b]=c;return b>=90&&b-r>=25&&b-g>=20&&r>=45}
    const purpleVisual=actionNodes.flatMap(e=>['color','backgroundColor','borderColor','outlineColor'].map(p=>({node:e.className,property:p,value:css(e,p)}))).filter(x=>purple(x.value))
    const focus={}
    for(const e of owners){e.focus();focus[e.className]={outlineColor:css(e,'outlineColor'),outlineWidth:css(e,'outlineWidth'),outlineStyle:css(e,'outlineStyle')}}
    const bottom=q('.dbottom'), detail=q('.detail'), grid=q('.grid')
    const lastCard=[...grid.children].at(-1)
    return {
      rects:Object.fromEntries(owners.map(e=>[e.className,rect(e)])),bottom:rect(bottom),pageBottomPadding:css(detail,'paddingBottom'),
      lastCard:rect(lastCard),document:{clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,clientHeight:document.documentElement.clientHeight,scrollHeight:document.documentElement.scrollHeight},
      colors:{price:css(q('.stat-price'),'color'),buyBg:css(q('.buybtn'),'backgroundColor'),buyColor:css(q('.buybtn'),'color'),favoriteColor:css(q('.dbtn-fav'),'color'),favoriteBorder:css(q('.dbtn-fav'),'borderColor'),favoriteIcon:css(q('.dbtn-fav .dbtn-ic'),'filter'),copyBg:css(q('.dbtn-copy'),'backgroundColor')},
      focus,purpleVisual,
      undersized:owners.filter(e=>rect(e).height<44||rect(e).width<44).map(e=>({className:e.className,rect:rect(e)})),
      clipping:[...document.querySelectorAll('.stat-price,.buy-t,.dbtn-t')].filter(e=>e.scrollWidth>e.clientWidth||e.scrollHeight>e.clientHeight).map(e=>({className:e.className,clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight})),
      overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),
      reducedMotion:[...document.querySelectorAll('.detail,.detail *')].filter(e=>{const s=getComputedStyle(e);return (s.animationName!=='none'&&s.animationDuration!=='0s')||s.transitionDuration!=='0s'}).length,
      semantics:owners.map(e=>({className:e.className,role:e.getAttribute('role'),tabindex:e.getAttribute('tabindex'),text:e.textContent.trim()}))
    }
  })
  const screenshot=`fresh-${viewport.width}x${viewport.height}-detail.png`
  await page.screenshot({path:path.join(out,screenshot),fullPage:true})
  await page.mouse.wheel(0,10000); await page.waitForTimeout(150)
  const bottomState=await page.evaluate(()=>{const card=[...document.querySelector('.grid').children].at(-1),bar=document.querySelector('.dbottom'),r=e=>{const x=e.getBoundingClientRect();return{top:x.top,bottom:x.bottom,height:x.height}};const scrollables=[...document.querySelectorAll('html,body,.taro_router,.taro_page,.detail')].map(e=>({className:e.className||e.tagName,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,scrollTop:e.scrollTop,overflowY:getComputedStyle(e).overflowY}));return{scrollables,lastCard:r(card),bottom:r(bar),lastCardFullyAboveBar:r(card).bottom<=r(bar).top,safeGap:Math.max(0,r(bar).top-r(card).bottom)}})
  const bottomScreenshot=`fresh-${viewport.width}x${viewport.height}-detail-bottom.png`
  await page.screenshot({path:path.join(out,bottomScreenshot),fullPage:true})
  const networkWrites=requests.filter(r=>!['GET','HEAD','OPTIONS'].includes(r.method))
  await context.close()
  return {viewport,screenshot,bottomScreenshot,metrics,bottomState,networkWrites}
}

for(const viewport of viewports) renders.push(await actionProbe(viewport))

const interaction=[]
for(const input of ['pointer','Enter','Space']) for(const selector of ['.buybtn','.dbtn-fav','.dbtn-copy']){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}), page=await context.newPage(), requests=[]
  page.on('request',r=>requests.push({method:r.method(),url:r.url()}))
  await page.goto(`${origin}/#/pages/detail/index?id=0`,{waitUntil:'networkidle',timeout:30000})
  const before={url:page.url(),fav:await page.locator('.dbtn-fav').getAttribute('aria-checked'),text:await page.locator('body').innerText()}
  if(input==='pointer') await page.locator(selector).click(); else await page.locator(selector).press(input)
  await page.waitForTimeout(250)
  const after={url:page.url(),fav:await page.locator('.dbtn-fav').getAttribute('aria-checked'),text:await page.locator('body').innerText()}
  interaction.push({selector,input,before:{url:before.url,fav:before.fav},after:{url:after.url,fav:after.fav},toastDelta:after.text.includes('去购买 ｜ 跳转卡组 SPU')||after.text.includes('已收藏')||after.text.includes('已取消'),networkWrites:requests.filter(r=>!['GET','HEAD','OPTIONS'].includes(r.method))})
  await context.close()
}

const otherRoutes=[]
for(const route of ['plaza','build','mine','event','round']){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),requests=[]
  page.on('request',r=>requests.push({method:r.method(),url:r.url()}))
  const suffix=route==='event'?'?id=0':route==='round'?'?event=0&round=1':''
  await page.goto(`${origin}/#/pages/${route}/index${suffix}`,{waitUntil:'networkidle',timeout:30000})
  const screenshot=`fresh-390x844-${route}.png`, png=await page.screenshot({path:path.join(out,screenshot),fullPage:true})
  otherRoutes.push({route,screenshot,sha256:crypto.createHash('sha256').update(png).digest('hex'),overflow:await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth)),networkWrites:requests.filter(r=>!['GET','HEAD','OPTIONS'].includes(r.method))})
  await context.close()
}
await browser.close()
await fs.writeFile(path.join(out,'fresh-browser-probes.json'),JSON.stringify({schema:'heldout-detail-action-hierarchy-fresh-qa/v1',attempt:22,generatedAt:new Date().toISOString(),readOnly:true,renders,interaction,otherRoutes},null,2)+'\n')
