import { readFile, readdir, stat } from 'node:fs/promises'
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

if (!new Set(['h5', 'qdmp']).has(platform)) failures.push(`DANGOUI_PLATFORM_UNVERIFIED:${platform}`)
let pkg
try { pkg = JSON.parse(await readFile(path.join(host, 'package.json'), 'utf8')) } catch { failures.push('HOST_PACKAGE_JSON_MISSING') }
const declared = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}), ...(pkg?.peerDependencies || {}) }
if (!declared.dangoui) failures.push('DANGOUI_NOT_DECLARED')

const locks = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock']
let lockFound = false
for (const lock of locks) try { await stat(path.join(host, lock)); lockFound = true; break } catch {}
if (!lockFound) warnings.push('LOCKFILE_NOT_FOUND')

let installed
try {
  const req = createRequire(path.join(host, 'package.json'))
  const resolved = req.resolve('dangoui/package.json')
  installed = JSON.parse(await readFile(resolved, 'utf8'))
  console.log(`DANGOUI_RESOLVED:${installed.version}`)
} catch { failures.push('DANGOUI_RUNTIME_NOT_RESOLVED') }

if (platform === 'qdmp') {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(declared.dangoui || '')) failures.push('DANGOUI_EXACT_VERSION_REQUIRED')
  if (installed && declared.dangoui !== installed.version) failures.push('DANGOUI_INSTALLED_VERSION_MISMATCH')
  for (const exportName of ['./mp/style.css', './mp/theme.css']) {
    if (installed && !(exportName in (installed.exports || {}))) failures.push(`DANGOUI_STYLE_EXPORT_MISSING:${exportName}`)
  }

  const styleFile = path.join(host, 'src/styles/dangoui.weapp.js')
  let styleText = ''
  try { styleText = await readFile(styleFile, 'utf8') } catch { failures.push('DANGOUI_WEAPP_STYLE_ENTRY_MISSING') }
  for (const marker of ['dangoui/package.json', 'dangoui/mp/style.css', 'dangoui/mp/theme.css']) {
    if (styleText && !styleText.includes(marker)) failures.push(`DANGOUI_WEAPP_STYLE_MARKER_MISSING:${marker}`)
  }

  const sourceFiles = []
  const walk = async directory => {
    let entries = []
    try { entries = await readdir(directory, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) await walk(target)
      else if (/\.(?:js|jsx|ts|tsx|vue)$/.test(entry.name)) sourceFiles.push(target)
    }
  }
  await walk(path.join(host, 'src'))
  const adapters = sourceFiles.filter(file => file.endsWith('.weapp.vue'))
  if (!adapters.length) failures.push('DANGOUI_WEAPP_ADAPTER_MISSING')
  for (const file of sourceFiles) {
    if (file.endsWith('.h5.vue')) continue
    const text = await readFile(file, 'utf8')
    if (/import\s*\{[^}]+\}\s*from\s*['"]dangoui['"]/.test(text)) {
      failures.push(`DANGOUI_WEAPP_DIRECT_COMPONENT_IMPORT:${path.relative(host, file)}`)
    }
  }
}

if (failures.length) {
  console.error(`BRAND_HOST_PREFLIGHT_FAIL\n${failures.join('\n')}`)
  if (warnings.length) console.error(warnings.join('\n'))
  process.exit(1)
}
console.log(`BRAND_HOST_PREFLIGHT_PASS:${platform}${platform === 'qdmp' ? ':dimina-adapter' : ''}`)
if (warnings.length) console.warn(warnings.join('\n'))
