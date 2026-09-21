#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const gate = path.resolve('skills/brand/scripts/public-host-preflight.mjs')
const fixture = ({ direct = false, adapter = true } = {}) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-qdmp-preflight-'))
  fs.mkdirSync(path.join(root, 'src/styles'), { recursive: true })
  fs.mkdirSync(path.join(root, 'src/components/brand'), { recursive: true })
  fs.mkdirSync(path.join(root, 'node_modules/dangoui'), { recursive: true })
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { dangoui: '3.6.16' } }))
  fs.writeFileSync(path.join(root, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'")
  fs.writeFileSync(path.join(root, 'node_modules/dangoui/package.json'), JSON.stringify({ version: '3.6.16', exports: { './package.json': './package.json', './mp/style.css': './dist/mp/style.css', './mp/theme.css': './dist/mp/theme.css' } }))
  fs.writeFileSync(path.join(root, 'src/styles/dangoui.weapp.js'), "import pkg from 'dangoui/package.json'\nimport 'dangoui/mp/style.css'\nimport 'dangoui/mp/theme.css'\n")
  if (adapter) fs.writeFileSync(path.join(root, 'src/components/brand/DuButton.weapp.vue'), '<template><button class="du-button" /></template>')
  if (direct) fs.writeFileSync(path.join(root, 'src/page.vue'), '<script>import { DuButton } from "dangoui"</script>')
  return root
}
const run = root => spawnSync(process.execPath, [gate, '--host', root, '--platform', 'qdmp'], { encoding: 'utf8' })

const pass = run(fixture())
assert.equal(pass.status, 0, pass.stderr)
assert.match(pass.stdout, /BRAND_HOST_PREFLIGHT_PASS:qdmp:dimina-adapter/)
const direct = run(fixture({ direct: true }))
assert.notEqual(direct.status, 0)
assert.match(direct.stderr, /DANGOUI_WEAPP_DIRECT_COMPONENT_IMPORT/)
const missing = run(fixture({ adapter: false }))
assert.notEqual(missing.status, 0)
assert.match(missing.stderr, /DANGOUI_WEAPP_ADAPTER_MISSING/)
console.log('public-host-preflight tests passed')
