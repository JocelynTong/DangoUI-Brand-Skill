import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const out=path.dirname(new URL(import.meta.url).pathname),host='http://127.0.0.1:10092/#'
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']})
const results=[]
const routes=[
  {name:'build',url:'/pages/build/index?mode=new',entry:'.lrow-img',mode:'build'},
  {name:'detail',url:'/pages/detail/index?id=0',entry:'.gcard',mode:'deck'},
  {name:'event',url:'/pages/event/index?id=0',entry:'.topdeck',mode:'deck',journey:true}
]
for(const viewport of [{width:390,height:844},{width:536,height:864},{width:1280,height:720}]) for(const route of routes){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'}),page=await context.newPage(),requests=[]
  page.on('request',r=>requests.push({method:r.method(),url:r.url()}))
  await page.goto(host+route.url,{waitUntil:'networkidle',timeout:30000})
  await page.locator(route.entry).first().click()
  if(route.journey){await page.waitForURL(/pages\/detail\/index/);await page.reload({waitUntil:'networkidle'});await page.locator('.gcard').first().click()}
  await page.locator('.cv.on').waitFor()
  const probe=await page.evaluate(mode=>{
    const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)],r=e=>{const x=e.getBoundingClientRect();return{left:x.left,top:x.top,right:x.right,bottom:x.bottom,width:x.width,height:x.height}},style=(s,p)=>getComputedStyle(q(s))[p]
    const controls=qa('.cv.on [role="button"]'), visual=qa('.cv.on,.cv.on *')
    const purple=visual.flatMap(e=>{const s=getComputedStyle(e);return [s.color,s.backgroundColor,s.borderColor,s.outlineColor].map(value=>({className:e.className,value}))}).filter(x=>/rgb\((?:9[0-9]|10[0-9]|11[0-9]|12[0-9]),\s*(?:5[0-9]|6[0-9]|7[0-9]|8[0-9]),\s*(?:17[0-9]|18[0-9]|19[0-9]|20[0-9]|21[0-9]|22[0-9]|23[0-9])\)/.test(x.value))
    return{mode,viewer:r(q('.cv')),modal:r(q('.cvinfo')),ancestors:[...function*(){let e=q('.cv').parentElement;while(e){const s=getComputedStyle(e);yield{className:e.className,transform:s.transform,position:s.position,rect:r(e)};e=e.parentElement}}()].slice(0,8),price:style('.price','color'),buy:style('.cvbuy','backgroundColor'),buyRect:r(q('.cvbuy')),controlCount:controls.length,undersized:controls.filter(e=>r(e).width<44||r(e).height<44).map(e=>({className:e.className,rect:r(e)})),nonFocusable:controls.filter(e=>e.tabIndex<0).map(e=>e.className),clipping:visual.filter(e=>e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1).map(e=>e.className).filter(Boolean).slice(0,20),purple,reducedMotion:visual.filter(e=>{const s=getComputedStyle(e);return(s.animationName!=='none'&&s.animationDuration!=='0s')||s.transitionDuration!=='0s'}).length,overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),step:mode==='build'?{wrap:r(q('.vstep')),minus:r(q('.vstep-minus')),plus:r(q('.vstep-plus')),count:q('.vstep-n').textContent}:null,nav:mode==='deck'?qa('.vnav-btn').map(r):null}
  },route.mode)
  const interaction={}
  if(route.mode==='build'){
    await page.locator('.vstep-plus').press('Enter'); interaction.afterPlusEnter=await page.locator('.vstep-n').textContent()
    await page.locator('.vstep-plus').press('Space'); interaction.afterPlusSpace=await page.locator('.vstep-n').textContent()
    await page.locator('.vstep-minus').click(); interaction.afterMinusPointer=await page.locator('.vstep-n').textContent()
  }else{
    const before=await page.locator('.cvname').textContent();await page.locator('.vnav-btn').nth(1).press('Enter');const afterEnter=await page.locator('.cvname').textContent();await page.locator('.vnav-btn').first().press('Space');const afterSpace=await page.locator('.cvname').textContent();interaction.navigation={before,afterEnter,afterSpace}
  }
  await page.locator('.cvbuy').press('Enter'); interaction.buyToast=await page.locator('body').evaluate(e=>e.innerText.includes('去购买 ｜ 跳转卡牌 SPU'))
  await page.locator('.cvbuy').focus(); const buyOutline=await page.locator('.cvbuy').evaluate(e=>getComputedStyle(e).outlineColor)
  await page.locator('.cvimg-hit').press('Enter'); await page.locator('.zoommask').waitFor(); await page.waitForTimeout(760)
  const zoom=await page.evaluate(()=>{const q=s=>document.querySelector(s),r=e=>{const x=e.getBoundingClientRect();return{width:x.width,height:x.height}},controls=[q('.zoomclose'),q('.zoomstage')];return{close:r(controls[0]),flip:r(controls[1]),focusable:controls.every(e=>e.tabIndex===0)}})
  await page.locator('.zoomstage').press('Space'); const flipped=await page.locator('.zoomflip').evaluate(e=>e.classList.contains('is-flipped'))
  await page.locator('.zoomclose').press('Enter'); await page.waitForTimeout(500)
  const png=path.join(out,`selfcheck-${viewport.width}x${viewport.height}-${route.name}-viewer.png`);await page.screenshot({path:png,fullPage:false})
  results.push({viewport,route:route.name,probe,interaction,buyOutline,zoom,flipped,screenshot:path.basename(png),writes:requests.filter(r=>!['GET','HEAD','OPTIONS'].includes(r.method))})
  await context.close()
}
const regression=[]
for(const route of ['plaza','mine','event','round']){const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();const suffix=route==='event'?'?id=0':route==='round'?'?event=0&round=1':'';await page.goto(`${host}/pages/${route}/index${suffix}`,{waitUntil:'networkidle',timeout:30000});const png=await page.screenshot({fullPage:true});regression.push({route,sha256:crypto.createHash('sha256').update(png).digest('hex'),overflow:await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth))});await context.close()}
await browser.close()
await fs.writeFile(path.join(out,'component-browser-probes.json'),JSON.stringify({schema:'heldout-component-family-selfcheck/v1',attempt:23,generatedAt:new Date().toISOString(),readOnly:true,results,regression},null,2)+'\n')
