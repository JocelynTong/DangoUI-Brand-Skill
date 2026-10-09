#!/usr/bin/env node
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

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
  if (pathname === '/__brand_viewport__') {
    const target = decodeURIComponent(url.searchParams.get('path') || '')
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
server.listen(port, '127.0.0.1', () => console.log(JSON.stringify({ root, baseUrl: `http://127.0.0.1:${server.address().port}/`, medium: 'static-h5', screenshots: false, viewportHarness: '/__brand_viewport__?path=<root-relative-html>&width=390&height=844' })))

function boundedNumber(value, fallback, minimum, maximum) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, Math.round(number))) : fallback
}

function viewportHarness({ src, width, height }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Brand viewport harness</title><style>html,body{margin:0;min-height:100%;background:#dfe5e3}body{display:grid;place-items:start center;padding:24px;box-sizing:border-box}#device{width:${width}px;height:${height}px;border:0;background:white;box-shadow:0 18px 60px rgba(20,35,30,.18)}</style></head><body><iframe id="device" title="${width} by ${height} CSS viewport" src="${src}" width="${width}" height="${height}"></iframe><script>window.__brandViewport={width:${width},height:${height},frameId:'device',target:${JSON.stringify(src)}};</script></body></html>`
}
