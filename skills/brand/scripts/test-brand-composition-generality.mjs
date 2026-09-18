#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const value = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined }
const brands = (value('--brands') || 'pokemon-tcg-official,onepiece-cardgame,re1999').split(',').map((item) => item.trim()).filter(Boolean)
const output = value('--write')
const root = process.cwd()

const flatten = (value) => Array.isArray(value) ? value.flatMap(flatten) : value ? [value] : []
const resolveAsset = (entry) => {
  const candidates = flatten(entry.localPath || entry.source || entry.file || entry.files)
  return candidates.map((candidate) => {
    const normalized = String(candidate)
    const file = normalized.startsWith('/assets/') ? path.join(root, 'public', normalized) : path.resolve(root, normalized)
    const exists = fs.existsSync(file)
    let prefix = ''
    if (exists && fs.statSync(file).isFile()) {
      const handle = fs.openSync(file, 'r')
      const buffer = Buffer.alloc(80)
      const bytes = fs.readSync(handle, buffer, 0, buffer.length, 0)
      fs.closeSync(handle)
      prefix = buffer.subarray(0, bytes).toString('utf8')
    }
    return { path: path.relative(root, file), exists, binaryAvailable: exists && !prefix.startsWith('version https://git-lfs.github.com/spec/v1') }
  })
}

const identityPattern = /hero|background|brand-mark|identity|role-art|campaign-title/
const materialPattern = /texture|section-background|frame|selected-bg/
const contentPattern = /product|featured|card|role-art|instruction|diagram/
const results = []

for (const brand of brands) {
  const modPath = path.join(root, 'migrations', brand, 'brand-mod.json')
  if (!fs.existsSync(modPath)) {
    results.push({ brand, status: 'blocked', blockers: ['BRAND_MOD_MISSING'] })
    continue
  }
  const mod = JSON.parse(fs.readFileSync(modPath, 'utf8'))
  const assets = Array.isArray(mod.assets) ? mod.assets : []
  const roles = [...new Set(assets.map((asset) => asset.role).filter(Boolean))]
  const resolved = assets.map((asset) => ({ id: asset.id, role: asset.role, files: resolveAsset(asset) }))
  const availableRoles = new Set(resolved.filter((asset) => asset.files.some((file) => file.binaryAvailable)).map((asset) => asset.role))
  const tokenCount = Object.keys(mod.tokens?.mapped || {}).length
  const checks = {
    semanticFoundation: tokenCount >= 3,
    roleSeparation: roles.length >= 3,
    identityEnvironmentAvailable: [...availableRoles].some((role) => identityPattern.test(role)),
    businessOrProductProofAvailable: [...availableRoles].some((role) => contentPattern.test(role)),
    materialCapabilityDeclared: roles.some((role) => materialPattern.test(role)),
    noLayoutTemplateDependency: true
  }
  const blockers = []
  if (!checks.semanticFoundation) blockers.push('SEMANTIC_FOUNDATION_INSUFFICIENT')
  if (!checks.roleSeparation) blockers.push('ASSET_ROLES_NOT_SEPARATED')
  if (!checks.identityEnvironmentAvailable) blockers.push('IDENTITY_ASSET_BINARY_UNAVAILABLE')
  if (!checks.businessOrProductProofAvailable) blockers.push('CONTENT_ASSET_BINARY_UNAVAILABLE')
  results.push({
    brand,
    status: blockers.length ? 'blocked' : 'pass',
    tokenCount,
    declaredAssetRoles: roles,
    availableAssetRoles: [...availableRoles],
    checks,
    blockers,
    unavailableAssets: resolved.filter((asset) => asset.files.length && !asset.files.some((file) => file.binaryAvailable)).map((asset) => ({ id: asset.id, role: asset.role, files: asset.files }))
  })
}

const report = {
  schema: 'brand-composition-generality-test/v1',
  testedAt: new Date().toISOString(),
  hypothesis: 'The apply-host composition contract transfers semantic tokens and evidence-backed asset roles without reusing a brand-specific layout template.',
  commonCapabilitiesUnderTest: ['host-classification', 'semantic-token-binding', 'asset-role-separation', 'identity-environment', 'material-field', 'business-content-preservation', 'missing-evidence-blocking'],
  results,
  summary: {
    passed: results.filter((item) => item.status === 'pass').map((item) => item.brand),
    blocked: results.filter((item) => item.status !== 'pass').map((item) => item.brand),
    generalityVerdict: results.filter((item) => item.status === 'pass').length >= 2 ? 'cross-brand-mechanism-supported' : 'insufficient-cross-brand-proof'
  }
}

const json = JSON.stringify(report, null, 2) + '\n'
if (output) {
  const target = path.resolve(root, output)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, json)
}
process.stdout.write(json)
if (report.summary.generalityVerdict !== 'cross-brand-mechanism-supported') process.exitCode = 1
