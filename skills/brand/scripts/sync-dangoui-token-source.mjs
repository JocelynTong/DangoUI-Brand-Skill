import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const valueAfter = (flag) => { const index = args.indexOf(flag); return index < 0 ? null : args[index + 1] }
const sourceArg = valueAfter('--source')
const releaseArg = valueAfter('--release-manifest')
const check = args.includes('--check')
const root = process.cwd()
const referenceDir = path.join(root, 'skills/brand/references')
const canonicalFile = path.join(referenceDir, 'dangoui.tokens.dtcg.json')
const sourceManifestFile = path.join(referenceDir, 'dangoui-token-source.manifest.json')
const contractFile = path.join(referenceDir, 'dangoui-token-contract.json')
const runtimeCatalogFile = path.join(referenceDir, 'dangoui.design-system.json')

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
const isToken = (value) => value && typeof value === 'object' && !Array.isArray(value) && '$type' in value && '$value' in value
function flatten(node, prefix = [], output = []) {
  if (isToken(node)) { output.push([prefix.join('.'), node]); return output }
  if (node && typeof node === 'object' && !Array.isArray(node)) for (const [key, value] of Object.entries(node)) if (!key.startsWith('$')) flatten(value, [...prefix, key], output)
  return output
}
const kebab = (value) => value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([a-zA-Z])(\d)/g, '$1-$2').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase()
const runtimeName = (logicalPath) => `--du-${kebab(logicalPath)}`
const aliasOf = (value) => typeof value === 'string' ? value.match(/^\{([^}]+)\}$/)?.[1] : null

function validateSource(source) {
  const errors = []
  if (source.$schema !== 'prototype-to-production.tokens/v0.1') errors.push('unsupported or missing $schema')
  if (!source.primitive || !source.semantic?.Light || !source.semantic?.Dark || !source.component?.Light || !source.component?.Dark) errors.push('required primitive/semantic/component modes are missing')
  for (const layer of ['semantic', 'component']) {
    const light = new Map(flatten(source[layer]?.Light || {}))
    const dark = new Map(flatten(source[layer]?.Dark || {}))
    for (const [tokenPath, token] of light) {
      if (!dark.has(tokenPath)) errors.push(`${layer}.Dark missing ${tokenPath}`)
      else if (dark.get(tokenPath).$type !== token.$type) errors.push(`${layer}.${tokenPath} type differs across modes`)
    }
    for (const tokenPath of dark.keys()) if (!light.has(tokenPath)) errors.push(`${layer}.Light missing ${tokenPath}`)
  }
  if (errors.length) throw new Error(`DangoUI canonical token source is invalid:\n- ${errors.join('\n- ')}`)
}

function buildContract(source, sourceManifest) {
  const runtimeCatalog = readJson(runtimeCatalogFile)
  const runtimeTokens = new Set(runtimeCatalog.tokens.map((token) => token.name))
  const semantic = {}
  const component = {}
  const missingSemanticTargets = []
  const componentGaps = []

  for (const mode of ['Light', 'Dark']) {
    semantic[mode] = flatten(source.semantic[mode]).map(([tokenPath, token]) => {
      const targetToken = runtimeName(tokenPath)
      const targetExists = runtimeTokens.has(targetToken)
      if (!targetExists) missingSemanticTargets.push({ mode, sourceToken: `semantic.${mode}.${tokenPath}`, targetToken })
      return { sourceToken: `semantic.${mode}.${tokenPath}`, type: token.$type, value: token.$value, targetToken, targetExists, status: targetExists ? 'mapped' : 'missing' }
    })
    component[mode] = flatten(source.component[mode]).map(([tokenPath, token]) => {
      const alias = aliasOf(token.$value)
      const semanticPrefix = `semantic.${mode}.`
      const derivedPath = alias?.startsWith(semanticPrefix) ? alias.slice(semanticPrefix.length) : tokenPath.split('.').slice(1).join('.')
      const targetToken = runtimeName(derivedPath)
      const targetExists = runtimeTokens.has(targetToken)
      const entry = { sourceToken: `component.${mode}.${tokenPath}`, type: token.$type, value: token.$value, targetToken, targetExists, mappingBasis: alias?.startsWith(semanticPrefix) ? 'semantic-alias' : 'component-path-compatibility' }
      if (!targetExists) componentGaps.push(entry)
      return entry
    })
  }

  return {
    schema: 'dangoui-token-contract/v0.1',
    source: { file: 'skills/brand/references/dangoui.tokens.dtcg.json', version: sourceManifest.version, sha256: sourceManifest.sourceSha256 },
    runtime: { catalog: 'skills/brand/references/dangoui.design-system.json', package: runtimeCatalog.source?.package, version: runtimeCatalog.source?.version },
    policy: {
      primitive: { brandWritable: false, purpose: 'base values and audit provenance' },
      semantic: { brandWritable: 'when-runtime-target-exists', targetNamespace: '--du-*', requirement: 'missing runtime targets remain capability gaps and cannot be emitted as mapped' },
      component: { brandWritable: true, requirement: 'prefer semantic alias; missing runtime targets remain capability gaps' }
    },
    counts: { primitive: flatten(source.primitive).length, semanticPerMode: semantic.Light.length, componentPerMode: component.Light.length },
    semantic,
    component,
    gates: { missingSemanticTargets, componentGaps }
  }
}

if (check) {
  for (const file of [canonicalFile, sourceManifestFile, contractFile]) if (!fs.existsSync(file)) throw new Error(`Missing generated DangoUI token artifact: ${path.relative(root, file)}`)
  const sourceText = fs.readFileSync(canonicalFile, 'utf8')
  const manifest = readJson(sourceManifestFile)
  if (sha256(sourceText) !== manifest.sourceSha256) throw new Error('Canonical DTCG source hash does not match its manifest')
  const contract = readJson(contractFile)
  if (contract.source.sha256 !== manifest.sourceSha256) throw new Error('DangoUI token contract is stale')
  console.log(`DANGOUI_TOKEN_SOURCE_CHECK_PASS version=${manifest.version} semanticGaps=${contract.gates.missingSemanticTargets.length} componentGaps=${contract.gates.componentGaps.length}`)
  process.exit(0)
}

if (!sourceArg || !releaseArg) throw new Error('Usage: node skills/brand/scripts/sync-dangoui-token-source.mjs --source <dangoui.tokens.json> --release-manifest <manifest.json>')
const sourceFile = path.resolve(sourceArg)
const releaseFile = path.resolve(releaseArg)
const sourceText = fs.readFileSync(sourceFile, 'utf8')
const source = JSON.parse(sourceText)
const release = readJson(releaseFile)
validateSource(source)
const actualHash = sha256(sourceText)
if (release.sourceSha256 !== actualHash) throw new Error(`Release manifest hash mismatch: expected ${release.sourceSha256}, got ${actualHash}`)

const sourceManifest = {
  schema: 'brand-skill.dangoui-token-source/v0.1',
  version: release.version,
  sourceSha256: actualHash,
  compatibility: release.compatibility,
  upstreamSchema: source.$schema,
  collections: source.$extensions?.['echo.source.collections'],
  policy: release.policy
}
// Build and validate every derived artifact before replacing any installed copy.
// A malformed upstream release must never leave the Brand Skill half-updated.
const contract = buildContract(source, sourceManifest)
fs.mkdirSync(referenceDir, { recursive: true })
fs.writeFileSync(canonicalFile, sourceText)
fs.writeFileSync(sourceManifestFile, `${JSON.stringify(sourceManifest, null, 2)}\n`)
fs.writeFileSync(contractFile, `${JSON.stringify(contract, null, 2)}\n`)
console.log(`DANGOUI_TOKEN_SOURCE_SYNC_PASS version=${sourceManifest.version} semantic=${contract.counts.semanticPerMode}/mode component=${contract.counts.componentPerMode}/mode semanticGaps=${contract.gates.missingSemanticTargets.length} componentGaps=${contract.gates.componentGaps.length}`)
