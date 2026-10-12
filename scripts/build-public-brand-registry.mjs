import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { materializeLearningDelivery } from './brand-learning-delivery.mjs'
import { collectImageReferences } from '../skills/brand/scripts/evidence-file-references.mjs'

const root = process.cwd()
const sourceFile = path.join(root, 'public', 'brand-previews', 'registry.json')
const outputRoot = path.join(root, 'public', 'brand-registry', 'v0.1')
const source = JSON.parse(fs.readFileSync(sourceFile, 'utf8'))
const brandFlag = process.argv.indexOf('--brand')
const selectedBrand = brandFlag < 0 ? '' : process.argv[brandFlag + 1]
if (brandFlag >= 0 && (!selectedBrand || selectedBrand.startsWith('--'))) throw new Error('--brand requires a brand id')
const published = (source.brands || []).filter((brand) => brand.publicationStatus === 'public-preview' && (!selectedBrand || brand.id === selectedBrand))
if (selectedBrand && published.length !== 1) throw new Error(`Unknown public brand: ${selectedBrand}`)
const forbiddenText = [/\/Users\//, /https?:\/\/(?:localhost|127\.0\.0\.1|10\.|192\.168\.)/i, /echotech\.feishu\.cn/i]

function normalizeSource(value) {
  const url = new URL(value)
  url.hash = ''
  url.search = ''
  url.hostname = url.hostname.toLowerCase()
  url.pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'
  return url.toString()
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

function collectReferencedPngs(value, found = new Set()) {
  collectImageReferences(value, found)
  return found
}

function migrationRelativePath(brand, referencedPath) {
  const normalized = referencedPath.replaceAll('\\', '/')
  const prefix = `${brand.migrationRoot.replaceAll('\\', '/').replace(/\/$/, '')}/`
  return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized.replace(/^\.\//, '')
}

function rewritePublishedMigrationReferences(value, brand) {
  const sourcePrefix = `${brand.migrationRoot.replaceAll('\\', '/').replace(/\/$/, '')}/`
  const publishedPrefix = `migrations/${brand.id}/`
  if (typeof value === 'string') {
    return value.replaceAll('\\', '/').startsWith(sourcePrefix)
      ? `${publishedPrefix}${value.replaceAll('\\', '/').slice(sourcePrefix.length)}`
      : value
  }
  if (Array.isArray(value)) return value.map((item) => rewritePublishedMigrationReferences(item, brand))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, rewritePublishedMigrationReferences(item, brand)]),
    )
  }
  return value
}

function sha256(file) {
  const bytes = fs.readFileSync(file)
  if (bytes.subarray(0,42).toString().startsWith('version https://git-lfs.github.com/spec/v1')) throw new Error(`Git LFS object not materialized: ${file}`)
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

// A scoped rebuild preserves every other installed registry entry and package.
const previousIndex = selectedBrand && fs.existsSync(path.join(outputRoot, 'index.json')) ? JSON.parse(fs.readFileSync(path.join(outputRoot, 'index.json'), 'utf8')) : {}
const previousSources = selectedBrand && fs.existsSync(path.join(outputRoot, 'by-source.json')) ? JSON.parse(fs.readFileSync(path.join(outputRoot, 'by-source.json'), 'utf8')) : {}
const brands = (previousIndex.brands || []).filter(brand => brand.id !== selectedBrand)
const bySource = Object.fromEntries(Object.entries(previousSources.sources || {}).filter(([, id]) => id !== selectedBrand))
// Validate the complete input set before touching an existing published package.
// A reference omitted from evidenceAssets is still a consumer dependency.
const evidenceFailures = []
const requiredEvidenceByBrand = new Map()
const runtimeFailures = []
const runtimeAssetsByBrand = new Map()
for (const brand of published) {
  const migrationRoot = path.resolve(root, brand.migrationRoot)
  const runtimeAssets = []
  runtimeAssetsByBrand.set(brand.id, runtimeAssets)
  const modFile = path.join(migrationRoot, 'brand-mod.json')
  if (fs.existsSync(modFile)) {
    const mod = JSON.parse(fs.readFileSync(modFile, 'utf8'))
    for (const asset of mod.assets || []) {
      if (!asset?.localPath) continue
      const localPath = String(asset.localPath).replaceAll('\\', '/')
      const sourceAsset = path.resolve(root, localPath)
      if (path.posix.isAbsolute(localPath) || /^[a-z]+:/i.test(localPath)
        || localPath.split('/').some((part) => !part || part === '.' || part === '..')
        || !sourceAsset.startsWith(`${root}${path.sep}`)
        || !fs.existsSync(sourceAsset) || !fs.statSync(sourceAsset).isFile()
        || fs.statSync(sourceAsset).size === 0
        || !fs.realpathSync(sourceAsset).startsWith(`${fs.realpathSync(root)}${path.sep}`)) {
        runtimeFailures.push(`${brand.id}: runtime asset not packageable: ${asset.localPath}`)
        continue
      }
      // Retain the verified bytes so a source change cannot race packaging.
      const bytes = fs.readFileSync(sourceAsset)
      const digest = crypto.createHash('sha256').update(bytes).digest('hex')
      if (asset.sourceSha256 !== digest) {
        runtimeFailures.push(`${brand.id}: runtime asset sourceSha256 mismatch: ${asset.localPath}`)
        continue
      }
      runtimeAssets.push({ id: asset.id, installPath: rewritePublishedMigrationReferences(localPath, brand), sha256: digest, bytes })
    }
  }
  const names = ['brand-evidence.json', 'brand-intent.json']
  const requiredReferences = new Set()
  requiredEvidenceByBrand.set(brand.id, requiredReferences)
  for (const name of names) {
    const file = path.join(migrationRoot, name)
    if (!fs.existsSync(file)) {
      evidenceFailures.push(`${brand.id}: missing artifact ${name}`)
      continue
    }
    for (const reference of collectReferencedPngs(JSON.parse(fs.readFileSync(file, 'utf8')))) {
      if (/^https?:\/\//i.test(reference)) continue // Source URL, not a frozen local capture.
      requiredReferences.add(reference)
      const relative = migrationRelativePath(brand, reference)
      const asset = path.resolve(migrationRoot, relative)
      if (!asset.startsWith(`${migrationRoot}${path.sep}`) || !fs.existsSync(asset)
        || !fs.statSync(asset).isFile() || fs.statSync(asset).size === 0
        || !fs.realpathSync(asset).startsWith(`${fs.realpathSync(migrationRoot)}${path.sep}`)) {
        evidenceFailures.push(`${brand.id}/${name}: evidence not packageable: ${reference}`)
      }
    }
  }
}
if (evidenceFailures.length) {
  throw new Error(`PUBLIC_REGISTRY_EVIDENCE_INCOMPLETE\n${evidenceFailures.join('\n')}`)
}
if (runtimeFailures.length) {
  throw new Error(`PUBLIC_REGISTRY_RUNTIME_ASSETS_INCOMPLETE\n${runtimeFailures.join('\n')}`)
}
const deliveries = new Map()
for (const brand of published) {
  const artifactFiles = [...new Set(brand.artifactFiles || [])]
  // The DTCG source is part of delivery whenever it exists, not just its adapter.
  if (fs.existsSync(path.join(root, brand.migrationRoot, 'brand-profile.dtcg.json')) && !artifactFiles.includes('brand-profile.dtcg.json')) artifactFiles.push('brand-profile.dtcg.json')
  const sourceModFile = path.join(root, brand.migrationRoot, 'brand-mod.json')
  if (fs.existsSync(sourceModFile)) {
    const patterns = JSON.parse(fs.readFileSync(sourceModFile, 'utf8'))?.verification?.patterns
    if (patterns && !artifactFiles.includes(patterns)) artifactFiles.push(patterns)
  }
  const delivery = materializeLearningDelivery(Object.fromEntries(artifactFiles.map(name => {
    const file = path.join(root, brand.migrationRoot, name)
    const text = fs.readFileSync(file, 'utf8')
    for (const pattern of forbiddenText) if (pattern.test(text)) throw new Error(`${brand.id}/${name}: contains non-public reference ${pattern}`)
    return [name, JSON.parse(text)]
  })))
  if (delivery['brand-mod.json']?.manifest) delivery['brand-mod.json'].manifest.version = brand.version
  deliveries.set(brand.id, delivery)
}
for (const brand of published) {
  const brandRoot = path.join(outputRoot, 'brands', brand.id, brand.version)
  const artifacts = {}
  const artifactHashes = {}
  const artifactValues = []
  const delivery = deliveries.get(brand.id)
  const artifactFiles = Object.keys(delivery)
  for (const name of artifactFiles) {
    const sourceArtifact = path.join(root, brand.migrationRoot, name)
    if (!fs.existsSync(sourceArtifact)) throw new Error(`${brand.id}: missing artifact ${name}`)
    const text = fs.readFileSync(sourceArtifact, 'utf8')
    for (const pattern of forbiddenText) {
      if (pattern.test(text)) throw new Error(`${brand.id}/${name}: contains non-public reference ${pattern}`)
    }
    const value = delivery[name]
    artifactValues.push(value)
    const publishedValue = rewritePublishedMigrationReferences(value, brand)
    const sourcePrefix = `${brand.migrationRoot.replaceAll('\\', '/').replace(/\/$/, '')}/`
    if (sourcePrefix !== `migrations/${brand.id}/` && JSON.stringify(publishedValue).includes(sourcePrefix)) {
      throw new Error(`${brand.id}/${name}: retained internal migration reference ${sourcePrefix}`)
    }
    const target = path.join(brandRoot, name)
    writeJson(target, publishedValue)
    artifacts[name.replace(/\.json$/, '')] = `/brand-registry/v0.1/brands/${brand.id}/${brand.version}/${name}`
    artifactHashes[name.replace(/\.json$/, '')] = sha256(target)
  }
  const evidenceAssets = []
  const publishedEvidencePaths = new Set()
  const referencedPngs = new Set()
  for (const value of artifactValues) collectReferencedPngs(value, referencedPngs)
  for (const reference of [...referencedPngs].sort()) {
    const relativePath = migrationRelativePath(brand, reference)
    if (publishedEvidencePaths.has(relativePath)) continue
    const sourceAsset = path.resolve(root, brand.migrationRoot, relativePath)
    const migrationRoot = path.resolve(root, brand.migrationRoot)
    if (!sourceAsset.startsWith(`${migrationRoot}${path.sep}`) || !fs.existsSync(sourceAsset)) {
      if (requiredEvidenceByBrand.get(brand.id).has(reference)) {
        throw new Error(`${brand.id}: evidence disappeared during packaging: ${reference}`)
      }
      continue // Other artifacts also contain source URLs and runtime asset metadata.
    }
    const publicRelativePath = path.posix.join('evidence', relativePath.replaceAll('\\', '/'))
    const target = path.join(brandRoot, publicRelativePath)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(sourceAsset, target)
    publishedEvidencePaths.add(relativePath)
    evidenceAssets.push({
      path: `/brand-registry/v0.1/brands/${brand.id}/${brand.version}/${publicRelativePath}`,
      installPath: relativePath.replaceAll('\\', '/'),
      sha256: sha256(sourceAsset),
    })
  }
  const canonicalSources = [...new Set((brand.canonicalSources || [brand.sourceUrl]).map(normalizeSource))]
  for (const sourceUrl of canonicalSources) {
    if (bySource[sourceUrl] && bySource[sourceUrl] !== brand.id) {
      throw new Error(`duplicate canonical source ${sourceUrl}`)
    }
    bySource[sourceUrl] = brand.id
  }
  const runtimeAssets = runtimeAssetsByBrand.get(brand.id).map(({ bytes, ...asset }) => {
    const relativePath = `runtime/${asset.installPath}`
    const target = path.join(brandRoot, relativePath)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, bytes)
    return { ...asset, path: `/brand-registry/v0.1/brands/${brand.id}/${brand.version}/${relativePath}` }
  })
  const manifest = {
    schema: 'public-brand-manifest.v0.1',
    id: brand.id,
    displayName: brand.displayName,
    version: brand.version,
    publicationStatus: brand.publicationStatus,
    canonicalSources,
    sourceHost: brand.sourceHost,
    preview: brand.path,
    artifacts,
    artifactHashes,
    evidenceAssets,
    runtimeAssets,
    platformSupport: brand.platformSupport,
    reusePolicy: brand.reusePolicy,
    verification: { web: brand.status, standardDemo: brand.standardDemo },
    updatedAt: brand.updatedAt,
  }
  writeJson(path.join(brandRoot, 'manifest.json'), manifest)
  brands.push({
    id: brand.id,
    displayName: brand.displayName,
    version: brand.version,
    canonicalSources,
    manifest: `/brand-registry/v0.1/brands/${brand.id}/${brand.version}/manifest.json`,
    preview: brand.path,
    platformSupport: brand.platformSupport,
    reusePolicy: brand.reusePolicy,
    updatedAt: brand.updatedAt,
  })
}

writeJson(path.join(outputRoot, 'index.json'), {
  schema: 'public-brand-registry.v0.1',
  generatedAt: source.updatedAt,
  access: source.access,
  brands,
})
writeJson(path.join(outputRoot, 'by-source.json'), {
  schema: 'public-brand-source-index.v0.1',
  generatedAt: source.updatedAt,
  sources: bySource,
})

console.log(`PUBLIC_BRAND_REGISTRY_BUILT ${published.length} brands (${brands.length} registry entries retained) -> ${path.relative(root, outputRoot)}`)
