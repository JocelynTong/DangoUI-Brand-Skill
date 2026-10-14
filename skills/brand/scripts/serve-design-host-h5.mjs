#!/usr/bin/env node
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { evaluateHostDelivery } from './parent-delivery-gate.mjs'
import { imageConceptFile, imageConceptDelivery } from './full-image-concepts.mjs'

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
  if (pathname === '/__brand_comparison__') {
    const brand = url.searchParams.get('brand') || ''
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(brand)) { response.writeHead(400).end(); return }
    let delivery
    try { delivery = fs.existsSync(imageConceptFile(root, brand)) ? imageConceptDelivery({root, brand}) : evaluateHostDelivery({ root, brand }) }
    catch (error) { response.writeHead(409, {'content-type':'application/json; charset=utf-8'}).end(JSON.stringify({userGoalCompleted:false,error:error.message})); return }
    const imagePreview = delivery.medium === 'full-image' && delivery.previewAvailable === true && delivery.images?.length === 3
    if ((!delivery.userGoalCompleted && !imagePreview) || !delivery.comparisonPreview || delivery.approvedMaster) {
      response.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }).end(JSON.stringify(delivery))
      return
    }
    let html
    try { html = delivery.medium === 'full-image' ? imageComparisonHarness(delivery) : comparisonHarness(delivery) }
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

function imageComparisonHarness(delivery) {
  const cards = delivery.images.map(image => {
    const file = fs.realpathSync(image.path)
    if (!file.startsWith(root + path.sep)) throw new Error('Image outside isolated run')
    const src = '/' + path.relative(root, file).split(path.sep).map(encodeURIComponent).join('/')
    return `<section><h2>方案 ${escapeHtml(image.id.toUpperCase())}</h2><a href="${escapeHtml(src)}" target="_blank" rel="noopener"><img src="${escapeHtml(src)}" alt="方案 ${escapeHtml(image.id.toUpperCase())} 完整效果图"></a></section>`
  }).join('')
  const notes = [delivery.reviewNotes,...(delivery.presentationRequirements||[]), ...(delivery.limitations||[])].filter(Boolean).map(text=>`<li>${escapeHtml(text)}</li>`).join('')
  const status=delivery.previewStatus||'approved'
  const statusText=status==='pending'?'待独立审核 · 三图已生成，不代表交付通过':status==='failed'?'审核未通过 · 仅供诊断查看，不是合格选案':'独立审核完成 · 可供选案（不代表实施认证）'
  const guidance=status==='approved'?'可在对话中选择 A/B/C，或说“不满意，再来三个”；不会自动实施。':'请等待审核或纠正结果；当前展示不批准选案，不授权实施。'
  const refresh=status==='pending'?'<script>setTimeout(()=>{if(document.visibilityState==="visible")location.reload();else document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")location.reload()},{once:true})},15000)</script>':''
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>三张完整效果图 · 选向比较</title><style>
*{box-sizing:border-box}body{margin:0;padding:24px;background:#edf0f2;color:#172026;font:16px/1.6 system-ui,sans-serif}header,footer,main{max-width:1240px;margin:0 auto}h1{font-size:24px}main{display:flex;gap:20px;overflow-x:auto;align-items:start;padding:16px 0}section{flex:0 0 390px;background:white}h2{font-size:18px;padding:0 12px}img{display:block;width:390px;height:auto}footer{padding:16px 0}a{color:inherit}
</style></head><body data-review-status="${escapeHtml(status)}"><header><h1>同一场景 · 三张完整效果图</h1><h2 role="status">${statusText}</h2><p>图像预览，不可交互；未转成宿主 H5，未修改宿主。三案等权展示，无默认选中。</p><p>窄屏可横向查看，点击图片打开原图。${guidance}</p></header><main aria-label="等权三案原图">${cards}</main><footer><h2>审核说明与局限</h2><ul>${notes}</ul></footer>${refresh}</body></html>`
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
