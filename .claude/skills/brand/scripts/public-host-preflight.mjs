import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const args = process.argv.slice(2)
const value = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}
const host = path.resolve(value('--host', '.'))
const platform = value('--platform', 'h5')
const failures = []
const warnings = []

if (platform !== 'h5') failures.push(`DANGOUI_PLATFORM_UNVERIFIED:${platform}`)
let pkg
try { pkg = JSON.parse(await readFile(path.join(host, 'package.json'), 'utf8')) } catch { failures.push('HOST_PACKAGE_JSON_MISSING') }
const declared = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}), ...(pkg?.peerDependencies || {}) }
if (!declared.dangoui) failures.push('DANGOUI_NOT_DECLARED')

const locks = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock']
let lockFound = false
for (const lock of locks) try { await stat(path.join(host, lock)); lockFound = true; break } catch {}
if (!lockFound) warnings.push('LOCKFILE_NOT_FOUND')

try {
  const req = createRequire(path.join(host, 'package.json'))
  const resolved = req.resolve('dangoui/package.json')
  const installed = JSON.parse(await readFile(resolved, 'utf8'))
  console.log(`DANGOUI_RESOLVED:${installed.version}`)
} catch { failures.push('DANGOUI_RUNTIME_NOT_RESOLVED') }

if (failures.length) {
  console.error(`BRAND_HOST_PREFLIGHT_FAIL\n${failures.join('\n')}`)
  if (warnings.length) console.error(warnings.join('\n'))
  process.exit(1)
}
console.log(`BRAND_HOST_PREFLIGHT_PASS:${platform}`)
if (warnings.length) console.warn(warnings.join('\n'))
