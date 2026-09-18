import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const root = process.cwd()
const sourceFile = path.join(root, 'public', 'brand-previews', 'registry.json')
const outputRoot = path.join(root, 'public', 'brand-registry', 'v0.1')
const source = JSON.parse(fs.readFileSync(sourceFile, 'utf8'))
const published = (source.brands || []).filter((brand) => brand.publicationStatus === 'public-preview')
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
  if (typeof value === 'string') {
    const clean = value.split('#')[0]
    if (/\.png$/i.test(clean)) found.add(clean)
    return found
  }
  if (Array.isArray(value)) {
    for (const item of value) collectReferencedPngs(item, found)
    return found
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectReferencedPngs(item, found)
  }
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
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

const brands = []
const bySource = {}
for (const brand of published) {
  const brandRoot = path.join(outputRoot, 'brands', brand.id, brand.version)
  const artifacts = {}
  const artifactValues = []
  for (const name of brand.artifactFiles || []) {
    const sourceArtifact = path.join(root, brand.migrationRoot, name)
    if (!fs.existsSync(sourceArtifact)) throw new Error(`${brand.id}: missing artifact ${name}`)
    const text = fs.readFileSync(sourceArtifact, 'utf8')
    for (const pattern of forbiddenText) {
      if (pattern.test(text)) throw new Error(`${brand.id}/${name}: contains non-public reference ${pattern}`)
    }
    const value = JSON.parse(text)
    artifactValues.push(value)
    const publishedValue = rewritePublishedMigrationReferences(value, brand)
    const sourcePrefix = `${brand.migrationRoot.replaceAll('\\', '/').replace(/\/$/, '')}/`
    if (sourcePrefix !== `migrations/${brand.id}/` && JSON.stringify(publishedValue).includes(sourcePrefix)) {
      throw new Error(`${brand.id}/${name}: retained internal migration reference ${sourcePrefix}`)
    }
    const target = path.join(brandRoot, name)
    writeJson(target, publishedValue)
    artifacts[name.replace(/\.json$/, '')] = `/brand-registry/v0.1/brands/${brand.id}/${brand.version}/${name}`
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
    if (!sourceAsset.startsWith(`${migrationRoot}${path.sep}`) || !fs.existsSync(sourceAsset)) continue
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
    evidenceAssets,
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

console.log(`PUBLIC_BRAND_REGISTRY_BUILT ${brands.length} brands -> ${path.relative(root, outputRoot)}`)
