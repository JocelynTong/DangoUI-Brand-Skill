import { chromium } from 'playwright-core'
import path from 'node:path'
const out=path.dirname(new URL(import.meta.url).pathname)
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']})
for(const [name,route] of [['plaza','pages/plaza/index'],['event','pages/event/index?id=0'],['detail','pages/detail/index?id=0']]){
  const c=await browser.newContext({viewport:{width:1280,height:720}});const p=await c.newPage();await p.goto('http://127.0.0.1:10092/#/'+route,{waitUntil:'networkidle'});
  await p.evaluate(()=>{const rx=/宝可梦|Pok[eé]mon|ONE\s*PIECE|路飞|喷火龙|卡组集换式卡牌/gi;const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(rx.test(n.nodeValue||''))n.nodeValue=(n.nodeValue||'').replace(rx,'████')}document.querySelectorAll('img,taro-image-core').forEach(el=>{el.style.filter='grayscale(1) blur(14px)';el.style.opacity='.22'})});
  await p.screenshot({path:path.join(out,`masked-${name}-desktop.png`),fullPage:false});await c.close()
}
await browser.close()
