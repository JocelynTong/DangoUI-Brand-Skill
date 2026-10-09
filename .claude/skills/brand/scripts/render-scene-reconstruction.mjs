#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { validateSceneReconstruction } from './validate-scene-reconstruction.mjs'

const [manifestArg, outputArg] = process.argv.slice(2)
if (!manifestArg || !outputArg) throw new Error('Usage: render-scene-reconstruction.mjs scene-reconstruction.json output.html')
const manifestFile = path.resolve(manifestArg)
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
const root = path.resolve(manifest.runtime?.assetRoot || path.dirname(manifestFile))
const validation = validateSceneReconstruction(manifest, { root })
if (!validation.ok) throw new Error(`Invalid scene reconstruction: ${validation.errors.join(', ')}`)
const runtime = manifest.runtime || {}
if (!runtime.backgroundUrl) throw new Error('SCENE_RUNTIME_BACKGROUND_REQUIRED')
if (!Array.isArray(runtime.groups) || !runtime.groups.length || runtime.groups.some((group) => !group.id || !Array.isArray(group.objects) || group.objects.length !== manifest.slots.length)) throw new Error('SCENE_RUNTIME_GROUPS_INVALID')
const sourceWidth = Number(runtime.objectSourceSize?.width || 245)
const sourceHeight = Number(runtime.objectSourceSize?.height || 342)
if (![sourceWidth, sourceHeight].every((value) => Number.isFinite(value) && value > 0)) throw new Error('SCENE_RUNTIME_OBJECT_SIZE_INVALID')
const plateWidth = Number(runtime.plateSourceSize?.width || manifest.sceneCanvas.width)
const plateHeight = Number(runtime.plateSourceSize?.height || manifest.sceneCanvas.height)
if (![plateWidth, plateHeight].every((value) => Number.isFinite(value) && value > 0) || plateWidth !== manifest.sceneCanvas.width || plateHeight < manifest.sceneCanvas.height) throw new Error('SCENE_RUNTIME_PLATE_SIZE_INVALID')
const payload = JSON.stringify({ ...manifest, runtime: { ...runtime, objectSourceSize: { width: sourceWidth, height: sourceHeight }, plateSourceSize: { width: plateWidth, height: plateHeight } } }).replaceAll('<', '\\u003c')
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Scene reconstruction</title><style>*{box-sizing:border-box}body{margin:0;background:#08111f;color:#eaf3ff;font:14px system-ui}main{width:min(100%,620px);margin:auto}.stage{position:relative;width:100%;aspect-ratio:${manifest.sceneCanvas.width}/${manifest.sceneCanvas.height};overflow:hidden;touch-action:pan-y}.space{position:absolute;width:${manifest.sceneCanvas.width}px;height:${manifest.sceneCanvas.height}px;transform-origin:0 0}.plate{position:absolute;inset:0 auto auto 0;width:${plateWidth}px;height:${plateHeight}px}.front,.light{position:absolute;inset:0;width:100%;height:100%}.objects{position:absolute;inset:0;z-index:2}.object{position:absolute;width:${sourceWidth}px;height:${sourceHeight}px;transform-origin:0 0;overflow:hidden}.object img{display:block;width:100%;height:100%;object-fit:fill}.object:after{content:"";position:absolute;inset:0;background:linear-gradient(112deg,transparent 20%,#fff5 42%,transparent 54%);mix-blend-mode:screen}.front{z-index:3;pointer-events:none}.light{z-index:4;pointer-events:none;background:${runtime.environmentLightCss || 'transparent'};mix-blend-mode:screen}.controls{display:flex;gap:8px;flex-wrap:wrap;padding:14px}.controls button{border:1px solid #8090aa;background:#f7f9fc;color:#152238;padding:9px 13px;border-radius:8px}.controls button[aria-pressed=true]{background:#183f72;color:white}.audit{padding:0 14px 18px;color:#aebed1;font-size:12px}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}</style></head><body><main><div class="stage"><div class="space"><img class="plate"><div class="objects"></div><svg class="front"></svg><div class="light"></div></div></div><nav class="controls"></nav><p class="audit">四角投影 · 前景遮挡 · 接触阴影 · 环境光 · 多组真实对象</p></main><script>const m=${payload};(${sceneRuntime.toString()})(m)</script></body></html>`
fs.writeFileSync(path.resolve(outputArg), html)

function sceneRuntime(m) {
  const $ = (selector) => document.querySelector(selector)
  const { width: w, height: h } = m.sceneCanvas
  const { width: sw, height: sh } = m.runtime.objectSourceSize
  $('.plate').src = m.runtime.backgroundUrl
  const project = (quad) => { const source = [[0, 0], [sw, 0], [sw, sh], [0, sh]], a = [], b = []; source.forEach(([x, y], i) => { const [u, v] = quad[i]; a.push([x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]); b.push(u,v) }); for (let k=0;k<8;k++){let p=k;for(let j=k+1;j<8;j++)if(Math.abs(a[j][k])>Math.abs(a[p][k]))p=j;[a[k],a[p]]=[a[p],a[k]];[b[k],b[p]]=[b[p],b[k]];const d=a[k][k];if(Math.abs(d)<1e-10)throw Error('Degenerate quad');for(let c=k;c<8;c++)a[k][c]/=d;b[k]/=d;for(let r=0;r<8;r++){if(r===k)continue;const f=a[r][k];for(let c=k;c<8;c++)a[r][c]-=f*a[k][c];b[r]-=f*b[k]}}return 'matrix3d('+[b[0],b[3],0,b[6],b[1],b[4],0,b[7],0,0,1,0,b[2],b[5],0,1].join(',')+')' }
  m.slots.forEach((slot) => { const node=document.createElement('div');node.className='object';node.dataset.slot=slot.id;node.style.transform=project(slot.quad);node.style.zIndex=slot.z;node.style.filter=`drop-shadow(${m.runtime.contactShadowCss || '0 7px 6px #0008'})`;node.append(document.createElement('img'));$('.objects').append(node) })
  const ns='http://www.w3.org/2000/svg', svg=$('.front');svg.setAttribute('viewBox',`0 0 ${w} ${h}`)
  if(m.layers.foreground.mode!=='none'){const defs=document.createElementNS(ns,'defs'),mask=document.createElementNS(ns,'mask');mask.id='scene-holes';const rect=document.createElementNS(ns,'rect');rect.setAttribute('width',w);rect.setAttribute('height',h);rect.setAttribute('fill','white');mask.append(rect);m.slots.forEach(slot=>{const polygon=document.createElementNS(ns,'polygon');polygon.setAttribute('points',slot.quad.map(point=>point.join(',')).join(' '));polygon.setAttribute('fill','black');mask.append(polygon)});defs.append(mask);svg.append(defs);const image=document.createElementNS(ns,'image');image.setAttribute('href',m.runtime.foregroundUrl||m.runtime.backgroundUrl);image.setAttribute('width',m.runtime.plateSourceSize.width);image.setAttribute('height',m.runtime.plateSourceSize.height);image.setAttribute('mask','url(#scene-holes)');svg.append(image)}
  let active=0;const show=(index)=>{active=(index+m.runtime.groups.length)%m.runtime.groups.length;document.querySelectorAll('.object img').forEach((image,i)=>image.src=m.runtime.groups[active].objects[i]);document.querySelectorAll('.controls button').forEach((button,i)=>button.setAttribute('aria-pressed',i===active))};m.runtime.groups.forEach((group,i)=>{const button=document.createElement('button');button.textContent=group.id;button.onclick=()=>show(i);$('.controls').append(button)})
  let down=null;$('.stage').onpointerdown=(event)=>{down=event.clientX;event.currentTarget.setPointerCapture(event.pointerId)};$('.stage').onpointerup=(event)=>{if(down!==null&&Math.abs(event.clientX-down)>35)show(active+(event.clientX<down?1:-1));down=null};$('.stage').ondragstart=(event)=>event.preventDefault();const resize=()=>$('.space').style.transform=`scale(${$('.stage').clientWidth/w})`;new ResizeObserver(resize).observe($('.stage'));resize();show(0)
}
