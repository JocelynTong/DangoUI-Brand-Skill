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
  let pathname
  try { pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname) }
  catch { response.writeHead(400).end(); return }
  const file = path.resolve(root, `.${pathname}`)
  if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile() || !fs.realpathSync(file).startsWith(`${root}${path.sep}`)) {
    response.writeHead(404).end()
    return
  }
  response.writeHead(200, { 'content-type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' })
  fs.createReadStream(file).pipe(response)
})
server.listen(port, '127.0.0.1', () => console.log(JSON.stringify({ root, baseUrl: `http://127.0.0.1:${server.address().port}/`, medium: 'static-h5', screenshots: false })))
