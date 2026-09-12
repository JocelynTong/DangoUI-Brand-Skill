import fs from 'node:fs'
import path from 'node:path'

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

const brands = []
const bySource = {}
for (const brand of published) {
  const brandRoot = path.join(outputRoot, 'brands', brand.id, brand.version)
  const artifacts = {}
  for (const name of brand.artifactFiles || []) {
    const sourceArtifact = path.join(root, brand.migrationRoot, name)
    if (!fs.existsSync(sourceArtifact)) throw new Error(`${brand.id}: missing artifact ${name}`)
    const text = fs.readFileSync(sourceArtifact, 'utf8')
    for (const pattern of forbiddenText) {
      if (pattern.test(text)) throw new Error(`${brand.id}/${name}: contains non-public reference ${pattern}`)
    }
    JSON.parse(text)
    const target = path.join(brandRoot, name)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(sourceArtifact, target)
    artifacts[name.replace(/\.json$/, '')] = `/brand-registry/v0.1/brands/${brand.id}/${brand.version}/${name}`
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
