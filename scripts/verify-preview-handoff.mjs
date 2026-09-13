import { execFileSync } from 'node:child_process'
import process from 'node:process'

const args = Object.fromEntries(process.argv.slice(2).map((entry) => {
  const [key, ...value] = entry.replace(/^--/, '').split('=')
  return [key, value.join('=') || true]
}))

const url = String(args.url || '')
const expectedRoot = String(args['expected-root'] || process.cwd())
const expectedMarker = String(args['expected-marker'] || '')

if (!url || !/^http:\/\/127\.0\.0\.1:\d+\//.test(url)) {
  throw new Error('Pass --url=http://127.0.0.1:<port>/...')
}

const port = new URL(url).port
let listeners = ''
try {
  listeners = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fn'], { encoding: 'utf8' })
} catch {
  throw new Error(`No listening preview process found on port ${port}`)
}

const pids = [...listeners.matchAll(/^p(\d+)$/gm)].map((match) => match[1])
if (pids.length !== 1) throw new Error(`Expected one listener on ${port}, found ${pids.length}`)

const cwdInfo = execFileSync('lsof', ['-a', '-p', pids[0], '-d', 'cwd', '-Fn'], { encoding: 'utf8' })
const actualRoot = cwdInfo.match(/^n(.+)$/m)?.[1]
if (actualRoot !== expectedRoot) {
  throw new Error(`Preview root mismatch: expected ${expectedRoot}, got ${actualRoot || 'unknown'}`)
}

const response = await fetch(url)
if (!response.ok) throw new Error(`Preview returned HTTP ${response.status}`)
const body = await response.text()
if (expectedMarker && !body.includes(expectedMarker)) {
  throw new Error(`Preview response does not contain expected marker: ${expectedMarker}`)
}

console.log(JSON.stringify({ ok: true, url, port, pid: Number(pids[0]), projectRoot: actualRoot }, null, 2))
