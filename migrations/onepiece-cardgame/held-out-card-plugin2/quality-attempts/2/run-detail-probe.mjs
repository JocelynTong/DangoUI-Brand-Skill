import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
const out=path.dirname(new URL(import.meta.url).pathname)
const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']})
const c=await b.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
const p=await c.newPage();await p.goto('http://127.0.0.1:10092/#/pages/detail/index?id=0',{waitUntil:'networkidle'})
const data=await p.evaluate(()=>{const sels=['.detail','.dhead','.dcover','.dinfo','.dtitle','.descwrap','.tabs','.dbottom'];const o={};for(const s of sels){const e=document.querySelector(s);if(e){const r=e.getBoundingClientRect(),cs=getComputedStyle(e);o[s]={x:r.x,y:r.y,w:r.width,h:r.height,display:cs.display,position:cs.position,padding:cs.padding,margin:cs.margin,minHeight:cs.minHeight}}}return o})
await fs.writeFile(path.join(out,'detail-layout-probe.json'),JSON.stringify(data,null,2));await b.close()
