#!/usr/bin/env node
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { evaluateHostDelivery } from './parent-delivery-gate.mjs'
import { imageConceptFile, imageConceptDelivery, imageConceptHistory } from './full-image-concepts.mjs'

const args = process.argv.slice(2)
const arg = (name, fallback = '') => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1] || fallback }
const root = fs.realpathSync(path.resolve(arg('--root', '.')))
const port = Number(arg('--port', '0'))
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' }
const server = http.createServer((request, response) => {
  let url
  let pathname
  try { url = new URL(request.url || '/', 'http://127.0.0.1'); pathname = decodeURIComponent(url.pathname) }
  catch { response.writeHead(400).end(); return }
  if (pathname === '/__brand_history_image__') {
    const brand=url.searchParams.get('brand')||'',index=url.searchParams.get('history')||'',id=url.searchParams.get('direction')||'';
    if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(brand)||! /^[1-9][0-9]*$/.test(index)||!['a','b','c'].includes(id)){response.writeHead(400).end();return;}
    try {
      const item=imageConceptHistory({root,brand})[Number(index)-1]?.images.find(d=>d.id===id);
      if(!item){response.writeHead(404).end();return;}
      response.writeHead(200,{'content-type':types[path.extname(item.path).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(item.path).pipe(response);
    } catch(error){response.writeHead(409).end(error.message);}
    return;
  }
  if (pathname === '/__brand_comparison__') {
    const brand = url.searchParams.get('brand') || ''
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(brand)) { response.writeHead(400).end(); return }
    let delivery,viewRoot=root,historyIndex=0,historical
    try {
      if(url.searchParams.has('history')) {
        const value=url.searchParams.get('history');
        if(!/^[1-9][0-9]*$/.test(value))throw Error('Invalid history index.');
        historyIndex=Number(value);historical=imageConceptHistory({root,brand})[historyIndex-1];
        if(!historical)throw Error('Unknown bound history.');
        viewRoot=historical.artifactRoot;
      }
      delivery = fs.existsSync(imageConceptFile(viewRoot, brand)) ? imageConceptDelivery({root:viewRoot, brand}) : evaluateHostDelivery({ root:viewRoot, brand });
      if(historical&&(delivery.images.length!==historical.images.length||delivery.images.some(d=>!historical.images.some(p=>p.id===d.id&&p.sha256===d.sha256))))throw Error('Historical outputs changed after this batch was frozen.');
    }
    catch (error) { response.writeHead(409, {'content-type':'application/json; charset=utf-8'}).end(JSON.stringify({userGoalCompleted:false,error:error.message})); return }
    const imagePreview = delivery.medium === 'full-image' && delivery.previewAvailable === true && Array.isArray(delivery.images)
    if ((!delivery.userGoalCompleted && !imagePreview) || !delivery.comparisonPreview || delivery.approvedMaster) {
      response.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }).end(JSON.stringify(delivery))
      return
    }
    let html
    try { html = delivery.medium === 'full-image' ? imageComparisonHarness(delivery,viewRoot,historyIndex) : comparisonHarness(delivery) }
    catch (error) { response.writeHead(409, {'content-type':'application/json; charset=utf-8'}).end(JSON.stringify({userGoalCompleted:false,error:error.message})); return }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(html)
    return
  }
  if (pathname === '/__brand_viewport__') {
    const target = url.searchParams.get('path') || ''
    const width = boundedNumber(url.searchParams.get('width'), 390, 240, 1024)
    const height = boundedNumber(url.searchParams.get('height'), 844, 320, 1600)
    const targetFile = path.resolve(root, `.${target.startsWith('/') ? target : `/${target}`}`)
    if (!target || !targetFile.startsWith(`${root}${path.sep}`) || !fs.existsSync(targetFile) || !fs.statSync(targetFile).isFile() || path.extname(targetFile).toLowerCase() !== '.html' || !fs.realpathSync(targetFile).startsWith(`${root}${path.sep}`)) {
      response.writeHead(404).end()
      return
    }
    const src = `/${path.relative(root, targetFile).split(path.sep).map(encodeURIComponent).join('/')}`
    const body = viewportHarness({ src, width, height })
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    response.end(body)
    return
  }
  const file = path.resolve(root, `.${pathname}`)
  if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile() || !fs.realpathSync(file).startsWith(`${root}${path.sep}`)) {
    response.writeHead(404).end()
    return
  }
  response.writeHead(200, { 'content-type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' })
  fs.createReadStream(file).pipe(response)
})
server.listen(port, '127.0.0.1', () => console.log(JSON.stringify({ root, baseUrl: `http://127.0.0.1:${server.address().port}/`, medium: 'static-h5', screenshots: false, viewportHarness: '/__brand_viewport__?path=<root-relative-html>&width=390&height=844', comparisonHarness: '/__brand_comparison__?brand=<brand>' })))

function boundedNumber(value, fallback, minimum, maximum) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, Math.round(number))) : fallback
}

function viewportHarness({ src, width, height }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Brand viewport harness</title><style>html,body{margin:0;min-height:100%;background:#dfe5e3}body{display:grid;place-items:start center;padding:24px;box-sizing:border-box}#device{width:${width}px;height:${height}px;border:0;background:white;box-shadow:0 18px 60px rgba(20,35,30,.18)}</style></head><body>${viewportFrame({ src, width, height, id: 'device', title: `${width} by ${height} CSS viewport` })}<script>window.__brandViewport={width:${width},height:${height},frameId:'device',target:${JSON.stringify(src)}};</script></body></html>`
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

function imageComparisonHarness(delivery,viewRoot=root,historyIndex=0) {
  const awaitingReview=['pending','partial','partial-pending','partial-blocked'].includes(delivery.previewStatus);
  // Saved pixels are available to view, not a completed independent review.
  if(awaitingReview) delivery={...delivery,selectionAvailable:false};
  const observationsFile=path.join(viewRoot,'migrations',delivery.brand,'image-concepts-observations.json');
  const observations=fs.existsSync(observationsFile)?JSON.parse(fs.readFileSync(observationsFile,'utf8')):null;
  const observationNotes=observations?.schema==='brand-image-observations/v1'?(observations.directions||[]).flatMap(item=>delivery.images.some(image=>image.id===item.id&&image.sha256===item.sha256)?item.notes.map(note=>`方案 ${item.id.toUpperCase()} 已有观察（非审核通过）：${note}`):[]):[];
  const sampleNotice=delivery.sampleData?'<aside role="note" style="padding:16px;background:#fff3cf;border:2px solid #966b10;max-width:1240px;margin:auto"><strong>示例数据：</strong>所有卡组名称、作者、分类/环境和收藏/浏览数值均为示例，非真实业务数据。原图单独查看时也适用；实际落地使用宿主数据。</aside>':'';
  const cards = ['a','b','c'].map(id => {
    const image=delivery.images.find(item=>item.id===id);
    if(!image) {
      const failure=(delivery.generationFailures||[]).find(item=>item.direction===id);
      return `<section data-direction="${id}" data-generation-status="${failure?'blocked':'pending'}"><h2>方案 ${id.toUpperCase()}</h2><div style="padding:24px;min-height:420px;overflow-wrap:anywhere"><h3>${failure?'本方案生成受阻':'等待生成'}</h3>${failure?`<p><code>${escapeHtml(failure.code)}</code></p><p>${escapeHtml(failure.reason)}</p><p>以上为工具返回的原始原因；未提供更具体原因时不作推测。本位置没有生成图片，不计入成功数。</p><p>不会自动重试。${delivery.selectionAvailable!==false?'可选择已有图，或明确请求新一轮生成。':'本轮暂无可选图；可明确请求新一轮生成，或暂停。'}</p>`:'<p>成功后将在此显示完整效果图；已有图可先查看。</p>'}</div></section>`;
    }
    const file = fs.realpathSync(image.path)
    if (!file.startsWith(viewRoot + path.sep)) throw new Error('Image outside isolated run')
    const src = historyIndex?`/__brand_history_image__?brand=${encodeURIComponent(delivery.brand)}&history=${historyIndex}&direction=${image.id}`:'/' + path.relative(root, file).split(path.sep).map(encodeURIComponent).join('/')
    return `<section><h2>方案 ${escapeHtml(image.id.toUpperCase())}</h2><a href="${escapeHtml(src)}" target="_blank" rel="noopener"><img src="${escapeHtml(src)}" alt="方案 ${escapeHtml(image.id.toUpperCase())} 完整效果图"></a></section>`
  }).join('')
  const notes = [delivery.reviewNotes,...observationNotes,...(delivery.generationFailures||[]).map(f=>`方向 ${f.direction.toUpperCase()} 未完成：${f.code}。${f.reason}`),...(delivery.presentationRequirements||[]), ...(delivery.limitations||[])].filter(Boolean).map(text=>`<li>${escapeHtml(text)}</li>`).join('')
  const status=delivery.previewStatus||'approved'
  const count=delivery.images.length
  const statusText=status==='unverified'?(delivery.selectionAvailable?'已有原生生图来源核实的方案可选 · 参数未核实，不代表审核通过':'仅供预览 · ImageGen 来源及参数未核实，不可选图落地'):status==='pending'?'待独立审核 · 三图已生成，不代表交付通过':status==='partial-pending'?`已保存 ${count}/3 张 · 已有图待独立审核，仅供预览，暂不引导选图落地`:status==='partial-approved'?`已有 ${count}/3 张通过独立审核 · 三图目标未完成，不代表实施认证`:status==='partial'||status==='partial-blocked'?`已保存 ${count}/3 张 · 尚未完成三图审核`:status==='failed'?'审核未通过 · 保留问题说明；选择仅进入隔离纠正，须修复业务问题并重新独立验收':'独立审核完成 · 可供选案（不代表实施认证）'
  const selectableImages=delivery.images.filter(image=>!delivery.selectableIds||delivery.selectableIds.includes(image.id));
  const available=selectableImages.map(image=>image.id.toUpperCase()).join('/');
  const historicalAvailable=(delivery.history||[]).some(h=>h.images?.length);
  const guidance=`<aside aria-label="下一步选择"><h2>接下来可以怎么做</h2><p>回到对话告诉助手即可，不需要操作内部流程：</p><ul><li>再探索：说“再来三个新方向”。会新建一轮，保留已有图，不自动重试被拒方向。</li>${selectableImages.length&&delivery.selectionAvailable!==false?`<li>选已有图：本轮可选 ${escapeHtml(available)}。说“选本轮 ${escapeHtml(selectableImages[0].id.toUpperCase())}，落地隔离单页”（方向由你决定）。</li>`:'<li>本轮暂无可选图。</li>'}${historicalAvailable?'<li>选历史图：打开下面的历史批次，选好后说“选历史第 N 轮 C，落地隔离单页”，以实际轮次和方向为准。</li>':''}<li>暂时不继续：说“暂停”。</li></ul><p>只落地单页，不自动整体换肤；明确要求后才执行下一步。</p></aside>`;
  const directionStates=delivery.directionStates||['a','b','c'].map(id=>({id,status:delivery.images.some(d=>d.id===id)?'saved':'pending'}));
  const states=`<p aria-label="本轮方向状态">${directionStates.map(d=>`方案 ${d.id.toUpperCase()}：${d.status==='unverified'&&delivery.selectableIds?.includes(d.id)?'来源已核实，参数未核实，可选隔离单页':({saved:'已保存',unverified:'仅预览，来源及参数未核实',blocked:'生成受阻',pending:'待生成'})[d.status]}`).join(' · ')}</p>`;
  const history=`<nav aria-label="历史批次">${historyIndex?`<a href="/__brand_comparison__?brand=${encodeURIComponent(delivery.brand)}">返回最新轮</a><p>历史轮次 ${historyIndex}；选择时请注明此轮及方向。</p>`:''}${(delivery.history||[]).map((h,i)=>`<p><a href="/__brand_comparison__?brand=${encodeURIComponent(delivery.brand)}&history=${historyIndex+i+1}">回看历史轮次 ${historyIndex+i+1}：${h.completedCount} 张已保存${h.images.length?'，可选 '+h.images.map(d=>d.id.toUpperCase()).join('/'):'，暂无可选图'}</a>（不计入本轮）</p>`).join('')}</nav>`;
  const refresh=(['pending','partial','partial-pending'].includes(status)||['partial-blocked','unverified'].includes(status)&&directionStates.some(d=>d.status==='pending'))?'<script>setTimeout(()=>{if(document.visibilityState==="visible")location.reload();else document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")location.reload()},{once:true})},3000)</script>':''
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>完整效果图 · 选向比较</title><style>
*{box-sizing:border-box}body{margin:0;padding:24px;background:#edf0f2;color:#172026;font:16px/1.6 system-ui,sans-serif}header,footer,main{max-width:1240px;margin:0 auto}h1{font-size:24px}main{display:flex;gap:20px;overflow-x:auto;align-items:start;padding:16px 0}section{flex:0 0 390px;background:white}h2{font-size:18px;padding:0 12px}img{display:block;width:390px;height:auto}footer{padding:16px 0}a{color:inherit}
</style></head><body data-review-status="${escapeHtml(status)}"><header><h1>同一场景 · 完整效果图</h1><h2 role="status">${statusText}</h2>${states}<p>图像预览，不可交互；未转成宿主 H5，未修改宿主。已有方案等权展示，无默认选中。</p><p>窄屏可横向查看，点击图片打开原图。</p>${guidance}${history}</header>${sampleNotice}<main aria-label="已有方案原图">${cards}</main><footer><h2>审核说明与局限</h2><ul>${notes}</ul></footer>${refresh}</body></html>`
}

function viewportFrame({ src, width, height, id, title }) {
  return `<iframe id="${escapeHtml(id)}" title="${escapeHtml(title)}" src="${escapeHtml(src)}" width="${width}" height="${height}"></iframe>`
}

function comparisonHarness(delivery) {
  const labelFor = (artifact, index) => `方案 ${String.fromCharCode(65 + index)} · ${artifact.id}`
  const cards = delivery.previewArtifacts.map((artifact, index) => {
    const src = `/${path.relative(root, path.resolve(root, artifact.path)).split(path.sep).map(encodeURIComponent).join('/')}`
    const label = labelFor(artifact, index)
    return `<section><h2>${escapeHtml(label)}</h2>${viewportFrame({ src, width: 390, height: 844, id: `direction-${index}`, title: `${label} · 390 × 844 CSS px` })}</section>`
  }).join('')
  const recommended = delivery.recommendedArtifacts.map(artifact => labelFor(artifact, delivery.previewArtifacts.findIndex(item => item.id === artifact.id))).join('、')
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>宿主三案比较</title><style>
*{box-sizing:border-box}body{margin:0;padding:24px;background:#edf0f2;color:#172026;font:16px/1.6 system-ui,sans-serif}
header,footer{max-width:1272px;margin:0 auto}h1{font-size:24px;margin:0}p{margin:8px 0 16px}
main{display:flex;gap:24px;overflow-x:auto;max-width:1272px;margin:20px auto;padding:0 0 16px}
section{flex:0 0 408px;padding:8px;background:white;border:1px solid #d3d9dd;border-radius:12px}
h2{font-size:18px;margin:4px 0 12px;min-height:58px;overflow-wrap:anywhere}
iframe{display:block;width:390px;height:844px;border:0;background:white}footer{font-size:14px}strong{font-weight:600}
</style></head><body><header><h1>同一场景 · 三案比较</h1><p>三案均可直接操作，视口均为 390 × 844 CSS px。窄屏可横向滚动查看。</p><p>当前未选择任何方案。体验后请在对话中明确选择 A、B 或 C，也可以说明修改意见或全部拒绝。浏览和操作预览不会批准方案或修改宿主。</p></header><main aria-label="等权三案预览">${cards}</main><footer><p><strong>独立 QA 参考意见 · ${escapeHtml(recommended)}</strong><br>${escapeHtml(delivery.recommendationReason)}</p><p>推荐仅供参考；三案按 A/B/C 顺序等尺寸展示，最终由你选择。</p></footer></body></html>`
}
