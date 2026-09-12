import fs from 'node:fs'
import path from 'node:path'
import {
  PREVIEW_BLOCKER_CODES,
  getScrollContract,
  hasRequiredSectionCount,
} from './brand-preview-layout-contract.mjs'

const root = process.cwd()
const registryFile = path.resolve(root, 'public/brand-previews/registry.json')
const appVueFile = path.resolve(root, 'src/App.vue')
const requiredEntryFields = [
  'id',
  'displayName',
  'sourceUrl',
  'path',
  'migrationRoot',
  'status',
  'standardDemo',
  'businessApply',
  'version',
  'publicationStatus',
  'canonicalSources',
  'artifactFiles',
  'platformSupport',
  'reusePolicy'
]
const publicationStatuses = new Set(['draft', 'public-preview', 'published', 'retired'])
const platformStatuses = new Set(['verified', 'planned', 'unverified', 'unsupported'])
const platformNames = ['web', 'taroH5', 'weapp', 'ios', 'android', 'flutter', 'harmonyos']
const publicArtifactRoot = path.resolve(root, 'public', 'brand-registry', 'v0.1')
const forbiddenPublicText = [/\/Users\//, /https?:\/\/(?:localhost|127\.0\.0\.1|10\.|192\.168\.)/i, /echotech\.feishu\.cn/i]
const requiredTokens = ['--du-bg-2', '--du-bg-1', '--du-text-1', '--du-primary-color']
const shellBooleanFields = ['statusBar', 'navigationBar', 'bottomActions', 'fab']
const supportedSectionTypes = new Set([
  'brand-hero',
  'action-cluster',
  'featured-card-strip',
  'filter-tabs',
  'anchor-navigation',
  'flip-card-gallery',
  'center-cta',
  'mega-evolve-dual-card',
  'expansion-highlights',
  'product-gallery',
  'home-welcome',
  'home-editorial-list',
  'home-footer-illustration',
  'retailer-cta',
  'checklist-download',
  'event-editorial-board',
  'onepiece-news-feature',
  'onepiece-event-discovery',
  'database-card-strip',
  'database-cta',
  'pokemon-database',
  'pokemon-learn-section'
])
const assetValueKeys = new Set([
  'src',
  'front',
  'back',
  'image',
  'logo',
  'cardBack',
  'href',
  'url',
  'poster',
  'background',
  'backgroundImage'
])
const assetListKeys = new Set(['assets', 'cards', 'images', 'logos', 'products'])
const errors = []
const warnings = []
const learningProofKinds = ['evidenceFidelity', 'structuralFidelity', 'generativeProof']
const proofRoles = new Set(['source-calibration', 'structural-transfer', 'generative-held-out'])

function readJson(file, scope) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    errors.push(`${scope}: cannot read JSON (${error.message})`)
    return null
  }
}

function fail(scope, message) {
  errors.push(`${scope}: ${message}`)
}

function warn(scope, message) {
  warnings.push(`${scope}: ${message}`)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeSourceUrl(value) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    url.hash = ''
    url.search = ''
    url.hostname = url.hostname.toLowerCase()
    url.pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'
    return url.toString()
  } catch {
    return null
  }
}

function validateRegistryEntry(entry, index) {
  const scope = `registry.brands[${index}]${entry?.id ? ` (${entry.id})` : ''}`

  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    fail(scope, 'entry must be an object')
    return
  }

  for (const field of requiredEntryFields) {
    if (!(field in entry)) fail(scope, `missing ${field}`)
  }

  for (const field of ['brand', 'preview']) {
    if (field in entry) fail(scope, `legacy ${field} field is not allowed; use id/path`)
  }

  for (const field of ['id', 'displayName', 'sourceUrl', 'path', 'migrationRoot', 'status']) {
    if (field in entry && !isNonEmptyString(entry[field])) fail(scope, `${field} must be a non-empty string`)
  }

  if (typeof entry.standardDemo !== 'boolean') fail(scope, 'standardDemo must be boolean')
  if (typeof entry.businessApply !== 'boolean') fail(scope, 'businessApply must be boolean')
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(entry.version || '')) fail(scope, 'version must be semantic')
  if (!publicationStatuses.has(entry.publicationStatus)) fail(scope, 'publicationStatus is invalid')
  if (!Array.isArray(entry.canonicalSources) || !entry.canonicalSources.length) {
    fail(scope, 'canonicalSources must not be empty')
  } else {
    for (const sourceUrl of entry.canonicalSources) {
      if (!normalizeSourceUrl(sourceUrl)) fail(scope, `canonical source must be a public HTTP(S) URL: ${sourceUrl}`)
    }
  }
  if (!Array.isArray(entry.artifactFiles)) fail(scope, 'artifactFiles must be an array')
  if (!entry.platformSupport || typeof entry.platformSupport !== 'object') {
    fail(scope, 'platformSupport must be an object')
  } else {
    for (const platform of platformNames) {
      if (!platformStatuses.has(entry.platformSupport[platform])) fail(scope, `platformSupport.${platform} is invalid`)
    }
  }
  if (entry.platformSupport?.web === 'verified' && entry.status !== 'fidelity-pass') {
    fail(scope, 'web can be verified only after fidelity-pass')
  }
  if (!['public', 'review-required'].includes(entry.reusePolicy?.metadataAndRules)) {
    fail(scope, 'reusePolicy.metadataAndRules is invalid')
  }
  if (!['public', 'review-required', 'excluded'].includes(entry.reusePolicy?.runtimeAssets)) {
    fail(scope, 'reusePolicy.runtimeAssets is invalid')
  }

  if (entry.publicationStatus === 'public-preview') {
    if (!entry.artifactFiles?.length) fail(scope, 'public-preview entries need artifactFiles')
    for (const name of entry.artifactFiles || []) {
      if (!/^[a-z0-9-]+\.json$/.test(name)) fail(scope, `invalid artifact filename: ${name}`)
      const artifactFile = path.resolve(root, entry.migrationRoot || '', name)
      if (!fs.existsSync(artifactFile)) fail(scope, `artifact does not exist: ${name}`)
      else {
        const text = fs.readFileSync(artifactFile, 'utf8')
        if (forbiddenPublicText.some((pattern) => pattern.test(text))) fail(scope, `artifact contains a private/local reference: ${name}`)
      }
    }
  }

  if (isNonEmptyString(entry.path)) {
    if (!entry.path.startsWith('/brand-previews/')) {
      fail(scope, 'path must start with /brand-previews/')
    }
    if (entry.path.includes('public/')) {
      fail(scope, 'path must be a public URL path, not a filesystem path')
    }
  }

  if (!entry.id || !entry.path) return

  const previewFile = path.resolve(root, 'public', entry.path.replace(/^\/+/, ''))
  if (!fs.existsSync(previewFile)) {
    fail(scope, `preview JSON does not exist: ${entry.path}`)
    return
  }

  const preview = readJson(previewFile, entry.path)
  if (!preview) return

  validatePreview(entry, preview, entry.path)
}

function validatePreview(entry, preview, scope) {
  if (preview.brand !== entry.id) fail(scope, `brand (${preview.brand}) must match registry id (${entry.id})`)
  if (preview.displayName !== entry.displayName) {
    warn(scope, `displayName (${preview.displayName}) differs from registry (${entry.displayName})`)
  }
  if (preview.sourceUrl !== entry.sourceUrl) fail(scope, 'sourceUrl must match registry sourceUrl')
  if (preview.status !== entry.status) fail(scope, 'status must match registry status')
  if (preview.standardDemo !== entry.standardDemo) fail(scope, 'standardDemo must match registry standardDemo')
  if (preview.businessApply !== entry.businessApply) fail(scope, 'businessApply must match registry businessApply')
  if (preview.migrationRoot !== entry.migrationRoot) fail(scope, 'migrationRoot must match registry migrationRoot')

  validateCanonicalFidelityState(entry, preview, scope)

  if (entry.standardDemo !== true) {
    fail(scope, 'registry preview entries must be standardDemo=true; business previews do not belong here')
  }
  if (entry.businessApply !== false) {
    fail(scope, 'registry preview entries must be businessApply=false')
  }

  validateDemoPurpose(scope, entry, preview)

  const preset = preview.preset
  if (!preset || typeof preset !== 'object') {
    fail(scope, 'missing preset')
    return
  }

  if (preset.id !== entry.id) fail(scope, `preset.id (${preset.id}) must match registry id (${entry.id})`)
  if (!isNonEmptyString(preset.label)) fail(scope, 'preset.label is required')
  if (!isNonEmptyString(preset.source)) fail(scope, 'preset.source is required')
  if (!Array.isArray(preset.tokens) || preset.tokens.length < requiredTokens.length) {
    fail(scope, 'preset.tokens must include core DangoUI tokens')
  } else {
    const tokenNames = new Set(preset.tokens.map((token) => token?.name))
    for (const token of requiredTokens) {
      if (!tokenNames.has(token)) fail(scope, `preset.tokens missing ${token}`)
    }
  }

  if (!preset.assets || typeof preset.assets !== 'object' || !Object.keys(preset.assets).length) {
    fail(scope, 'preset.assets must not be empty')
  }

  const sourceEvidence = loadSourceEvidence(entry)
  if (!Array.isArray(preview.pages) || preview.pages.length < 2) {
    fail(scope, 'pages must include at least two standard demo pages')
  } else {
    const hasSchemaPages = preview.pages.some((page) => Array.isArray(page?.sections) && page.sections.length)
    const sectionSignatures = new Set()
    for (const page of preview.pages) {
      validatePage(scope, entry.id, page, { requireSchema: hasSchemaPages, preview, sourceEvidence })
      if (Array.isArray(page?.sections) && page.sections.length) {
        sectionSignatures.add(page.sections.map((section) => section?.type || '<missing>').join(' > '))
      }
    }
    if (hasSchemaPages && preview.pages.length >= 3 && sectionSignatures.size < 3) {
      fail(scope, 'schema-driven previews need at least three distinct section signatures across demo pages')
    }
    if (!hasSchemaPages) {
      warn(scope, 'legacy preview has no sections[]; schema-driven renderer gate is not active for this brand yet')
    }
    validateSourceNavigation(scope, preview.pages, preview.sourceNavigation, { required: hasSchemaPages })
  }

  const recipeCategories = preview.styleRecipeDetails && Object.keys(preview.styleRecipeDetails)
  if (!recipeCategories?.length) {
    fail(scope, 'styleRecipeDetails must expose style tab evidence')
  }

  if (!Array.isArray(preview.mustVerifyBeforeApply) || preview.mustVerifyBeforeApply.length < 2) {
    warn(scope, 'mustVerifyBeforeApply should list concrete visual checks before business apply')
  }
}

function validateCanonicalFidelityState(entry, preview, scope) {
  if (!isNonEmptyString(entry?.migrationRoot)) return
  const reportFile = path.resolve(root, entry.migrationRoot, 'fidelity-report.json')
  if (!fs.existsSync(reportFile)) return
  const report = readJson(reportFile, reportFile)
  if (!report || report.status !== 'fidelity-pass') return

  const canonicalPass = report.learningProof?.status === 'learning-proof-pass'
    && learningProofKinds.every((kind) => report.learningProof?.[kind] === 'pass')
    && !(report.protocolFailures || []).length
    && !(report.hardFailures || []).length
  if (!canonicalPass) return

  if (entry.status !== 'fidelity-pass' || preview.status !== 'fidelity-pass') {
    fail(scope, 'canonical fidelity report passed, but registry/preview status is stale')
  }
  if (preview.learningProof?.status !== 'fidelity-pass') {
    fail(scope, 'canonical fidelity report passed, but learningProof.status is stale')
  }
  const runtimeProofs = [
    preview.learningProof?.evidenceStatus,
    preview.learningProof?.structureStatus,
    preview.learningProof?.generativeStatus,
  ]
  if (runtimeProofs.some((status) => !['pass', '通过', '已通过'].includes(status))) {
    fail(scope, 'canonical fidelity report passed, but one or more runtime proof labels are stale')
  }
  if (learningProofKinds.some((kind) => preview.proofs?.[kind]?.status !== 'pass')) {
    fail(scope, 'canonical fidelity report passed, but proofs.* status is stale')
  }
  if (preview.generativeChallenge?.status !== 'pass') {
    fail(scope, 'canonical fidelity report passed, but generativeChallenge.status is stale')
  }
}

function loadSourceEvidence(entry) {
  const migrationRoot = entry?.migrationRoot
  if (!isNonEmptyString(migrationRoot)) return null
  const result = {}
  for (const name of ['brand-evidence.json', 'site-evidence.json', 'goal-contract.json']) {
    const evidenceFile = path.resolve(root, migrationRoot, name)
    if (fs.existsSync(evidenceFile)) result[name.replace(/\.json$/, '').replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = readJson(evidenceFile, evidenceFile)
  }
  return Object.keys(result).length ? result : null
}

function validateDemoPurpose(scope, entry, preview) {
  if (entry.demoPurpose !== preview.demoPurpose) {
    fail(scope, 'demoPurpose must match registry demoPurpose')
  }
  if (preview.demoPurpose !== 'brand-learning-capability-test') {
    warn(scope, 'preview has not adopted the brand-learning-capability-test contract')
    return
  }
  if (!Array.isArray(preview.nonGoals) || preview.nonGoals.length < 3 || preview.nonGoals.some((item) => !isNonEmptyString(item))) {
    fail(scope, 'nonGoals must list at least three explicit non-goals')
  }
  if (!preview.proofs || typeof preview.proofs !== 'object' || Array.isArray(preview.proofs)) {
    fail(scope, 'proofs object is required for a brand-learning capability test')
  } else {
    for (const kind of learningProofKinds) {
      const proof = preview.proofs[kind]
      if (!proof || typeof proof !== 'object' || Array.isArray(proof)) {
        fail(scope, `proofs.${kind} is required`)
        continue
      }
      if (!isNonEmptyString(proof.claim)) fail(scope, `proofs.${kind}.claim is required`)
      if (!['pending', 'blocked', 'pass', 'fail'].includes(proof.status)) {
        fail(scope, `proofs.${kind}.status must be pending, blocked, pass or fail`)
      }
      if (!Array.isArray(proof.requiredEvidence) || !proof.requiredEvidence.length) {
        fail(scope, `proofs.${kind}.requiredEvidence must not be empty`)
      }
    }
  }
  if (!preview.generativeChallenge || typeof preview.generativeChallenge !== 'object') {
    fail(scope, 'generativeChallenge is required')
  } else {
    if (!isNonEmptyString(preview.generativeChallenge.challengeId)) fail(scope, 'generativeChallenge.challengeId is required')
    if (!isNonEmptyString(preview.generativeChallenge.heldOutContentRule)) fail(scope, 'generativeChallenge.heldOutContentRule is required')
    if (!['pending', 'blocked', 'pass', 'fail'].includes(preview.generativeChallenge.status)) {
      fail(scope, 'generativeChallenge.status must be pending, blocked, pass or fail')
    }
  }
  const proofPages = Array.isArray(preview.pages) ? preview.pages : []
  const heldOutPages = proofPages.filter((page) => page?.proofRole === 'generative-held-out')
  if (!heldOutPages.length) fail(scope, 'at least one page must have proofRole=generative-held-out')
  if (proofPages.length && proofPages.every((page) => isNonEmptyString(page?.mapsToSourcePageId))) {
    fail(scope, 'a learning capability test cannot consist only of one-to-one source page mappings')
  }
  for (const page of heldOutPages) {
    if (isNonEmptyString(page.mapsToSourcePageId)) fail(scope, `held-out page ${page.id} must not map one-to-one to a source page`)
    if (page.contentIndependence?.mode !== 'held-out-content') {
      fail(scope, `held-out page ${page.id} must declare contentIndependence.mode=held-out-content`)
    }
  }
  if (heldOutPages.length && !heldOutPages.some((page) => page.id === preview.generativeChallenge?.targetPageId)) {
    fail(scope, 'generativeChallenge.targetPageId must reference a generative-held-out page')
  }
}

function validateSourceNavigation(scope, pages, sourceNavigation, options = {}) {
  if (sourceNavigation == null) {
    if (options.required) {
      fail(
        scope,
        'sourceNavigation is required for schema-driven previews; list every source-site navigation page represented by the demo',
      )
    }
    return
  }
  if (!sourceNavigation || typeof sourceNavigation !== 'object' || Array.isArray(sourceNavigation)) {
    fail(scope, 'sourceNavigation must be an object when declared')
    return
  }

  const visiblePageIds = sourceNavigation.visiblePageIds
  if (!Array.isArray(visiblePageIds) || visiblePageIds.length < 1) {
    fail(scope, 'sourceNavigation.visiblePageIds must list the source-site navigation pages represented in the demo')
    return
  }

  const pageIds = new Set(pages.map((page) => page?.id).filter(Boolean))
  const visibleRuntimePageIds = pages
    .filter((page) => page?.nav !== false && page?.secondary !== true && page?.evidenceOnly !== true)
    .map((page) => page.id)

  for (const pageId of visiblePageIds) {
    if (!pageIds.has(pageId)) fail(scope, `sourceNavigation.visiblePageIds references unknown page "${pageId}"`)
  }

  if (visibleRuntimePageIds.join(' | ') !== visiblePageIds.join(' | ')) {
    fail(
      scope,
      `visible demo pages must match sourceNavigation.visiblePageIds; got [${visibleRuntimePageIds.join(', ')}], expected [${visiblePageIds.join(', ')}]`,
    )
  }

  if (!Array.isArray(sourceNavigation.items) || sourceNavigation.items.length !== visiblePageIds.length) {
    fail(scope, 'sourceNavigation.items must describe each visible source navigation page')
    return
  }
  for (const [index, item] of sourceNavigation.items.entries()) {
    if (!isNonEmptyString(item?.label)) fail(scope, `sourceNavigation.items[${index}].label is required`)
    if (item?.pageId !== visiblePageIds[index]) {
      fail(scope, `sourceNavigation.items[${index}].pageId must match visiblePageIds[${index}]`)
    }
  }
}

function validatePage(scope, brand, page, options = {}) {
  const pageScope = `${scope} page ${page?.id || '<missing>'}`
  if (!isNonEmptyString(page?.id)) fail(pageScope, 'id is required')
  if (page?.id && page.id !== brand && !page.id.startsWith(`${brand}-`)) fail(pageScope, `id must equal ${brand} or start with ${brand}-`)
  if (!isNonEmptyString(page?.kind)) fail(pageScope, 'kind is required')
  if (!isNonEmptyString(page?.layoutRecipe)) warn(pageScope, 'layoutRecipe should explain the page template')
  if (!Array.isArray(page?.components) || page.components.length < 1) {
    fail(pageScope, 'components must list the DangoUI/component roles used by the preview')
  }

  if (proofRoles.has(page?.proofRole)) {
    if (!Array.isArray(page.recipeIds) || !page.recipeIds.length) fail(pageScope, 'recipeIds must identify reusable brand recipes')
    if (!Array.isArray(page.evidenceTrace) || !page.evidenceTrace.length) fail(pageScope, 'evidenceTrace must not be empty')
    if (!page.contentIndependence || typeof page.contentIndependence !== 'object') {
      fail(pageScope, 'contentIndependence is required for proof pages')
    } else {
      if (!['source-content', 'representative-content', 'held-out-content'].includes(page.contentIndependence.mode)) {
        fail(pageScope, 'contentIndependence.mode is invalid')
      }
      if (!['pending', 'blocked', 'pass', 'fail'].includes(page.contentIndependence.status)) {
        fail(pageScope, 'contentIndependence.status must be pending, blocked, pass or fail')
      }
    }
  } else if (page?.proofRole != null) {
    fail(pageScope, `unsupported proofRole "${page.proofRole}"`)
  }

  const hasSections = Array.isArray(page?.sections) && page.sections.length > 0
  const scrollContract = getScrollContract({
    page,
    preview: options.preview,
    sourceEvidence: options.sourceEvidence,
  })
  if (scrollContract.required && !hasRequiredSectionCount(scrollContract)) {
    fail(
      pageScope,
      `${PREVIEW_BLOCKER_CODES.MULTI_MODULE_PAGE_SECTIONS_MISSING}: long/multi-module evidence requires at least 2 schema sections (found ${scrollContract.sectionCount}; ${scrollContract.reasons.join('; ')})`,
    )
  }
  if (options.requireSchema && !hasSections) {
    fail(pageScope, 'sections[] is required when a preview uses schema-driven pages')
  }
  if (!options.requireSchema && !hasSections) return

  if (!page.shell || typeof page.shell !== 'object' || Array.isArray(page.shell)) {
    fail(pageScope, `${PREVIEW_BLOCKER_CODES.MOCKUP_SHELL_MISSING}: shell object is required for schema-driven pages`)
  } else {
    if (!['phone', 'desktop'].includes(page.shell.device)) {
      fail(pageScope, `${PREVIEW_BLOCKER_CODES.MOCKUP_SHELL_MISSING}: shell.device must be phone or desktop`)
    }
    for (const field of shellBooleanFields) {
      if (!(field in page.shell)) {
        fail(pageScope, `shell.${field} must be explicitly declared for schema-driven pages`)
      } else if (typeof page.shell[field] !== 'boolean') {
        fail(pageScope, `shell.${field} must be boolean`)
      }
    }
    if (page.shell.navigationBar === false && page.components?.includes('NavigationBar')) {
      fail(pageScope, 'navigationBar=false but components includes NavigationBar')
    }
  }

  for (const [index, section] of (page.sections || []).entries()) {
    validateSection(pageScope, section, index)
  }

}

function validateSection(pageScope, section, index) {
  const sectionScope = `${pageScope} sections[${index}]`
  if (!section || typeof section !== 'object' || Array.isArray(section)) {
    fail(sectionScope, 'section must be an object')
    return
  }
  if (!isNonEmptyString(section.type)) fail(sectionScope, 'type is required')
  if (isNonEmptyString(section.type) && !supportedSectionTypes.has(section.type)) {
    fail(sectionScope, `unsupported section.type "${section.type}"; add a section renderer before using it`)
  }
  if ('component' in section && !isNonEmptyString(section.component)) {
    fail(sectionScope, 'component must be a non-empty string when declared')
  }
  if ('recipe' in section && !isNonEmptyString(section.recipe)) {
    fail(sectionScope, 'recipe must be a non-empty string when declared')
  }
  if (section.interaction && typeof section.interaction !== 'object') {
    fail(sectionScope, 'interaction must be an object when declared')
  }

  const assetRefs = collectAssetRefs(section.assets)
  for (const asset of assetRefs) validateAssetRef(sectionScope, asset)
}

function collectAssetRefs(value, refs = [], key = '') {
  if (!value) return refs
  if (typeof value === 'string') {
    if (assetValueKeys.has(key) || assetListKeys.has(key) || /^(https?:)?\/\//.test(value) || value.startsWith('/')) {
      refs.push(value)
    }
    return refs
  }
  if (Array.isArray(value)) {
    for (const item of value) collectAssetRefs(item, refs, key)
    return refs
  }
  if (typeof value === 'object') {
    for (const [childKey, item] of Object.entries(value)) collectAssetRefs(item, refs, childKey)
  }
  return refs
}

function validateAssetRef(scope, asset) {
  if (!isNonEmptyString(asset)) return
  if (/^(https?:)?\/\//.test(asset) || asset.startsWith('data:')) {
    warn(scope, `remote asset is format-checked only; browser naturalWidth gate is still required: ${asset}`)
    return
  }
  if (!asset.startsWith('/')) {
    fail(scope, `asset reference must be an absolute public path or URL: ${asset}`)
    return
  }
  const publicFile = path.resolve(root, 'public', asset.replace(/^\/+/, ''))
  if (!fs.existsSync(publicFile)) {
    fail(scope, `local asset does not exist under public/: ${asset}`)
  }
}

function validateRendererArchitecture() {
  if (!fs.existsSync(appVueFile)) {
    warn('src/App.vue', 'renderer file not found; architecture gate skipped')
    return
  }

  const source = fs.readFileSync(appVueFile, 'utf8')
  const schemaTemplateMatch = source.match(
    /<template v-else-if="isSourceSchemaTemplate">([\s\S]*?)<\/template>\s*<template v-else-if="isRuntimePreviewTemplate">/
  )
  const schemaTemplate = schemaTemplateMatch?.[1] || ''
  const forbiddenFallbackSymbols = [
    'fallbackSourceCards',
    'runtimeHeroLogoAsset',
    'runtimeCardBackAsset',
    'runtimeSourceCards',
    'runtimeMegaCards',
    'runtimeHighlightCards',
    'runtimeProductAssets',
    'findRuntimeSection',
    'firstAssetValue'
  ]

  if (!schemaTemplate) {
    fail('src/App.vue', 'schema preview template block is required before the legacy runtime preview renderer')
  } else {
    if (!/<component\b/.test(schemaTemplate) || !/runtimeSchemaSections/.test(schemaTemplate)) {
      fail('src/App.vue', 'schema preview template must render sections with a component loop over runtimeSchemaSections')
    }
    if (/runtimePreviewPageKind\s*===\s*['"]/.test(schemaTemplate)) {
      fail('src/App.vue', 'schema preview template must not branch by runtimePreviewPageKind')
    }
  }

  if (!/sectionRendererRegistry/.test(source)) {
    fail('src/App.vue', 'schema-driven renderer must expose sectionRendererRegistry')
  }
  if (/pitch-black-demo/.test(source)) {
    fail('src/App.vue', 'schema-driven renderer must not keep Pitch Black structural classes or brand-specific template hooks')
  }
  if (!/selectedTemplateHasSchemaSections/.test(source)) {
    fail('src/App.vue', 'shell defaults must detect schema pages before falling back')
  }
  for (const symbol of forbiddenFallbackSymbols) {
    if (new RegExp(`\\b${symbol}\\b`).test(source)) {
      fail('src/App.vue', `schema renderer must not keep hardcoded fallback symbol ${symbol}`)
    }
  }
  if (/selectedStyle\.id\s*===\s*['"][^'"]+['"]/.test(source)) {
    fail('src/App.vue', 'must not branch on selectedStyle.id for brand-specific preview DOM')
  }
  if (/pages\.push\(genericPublishPage\)/.test(source)) {
    fail('src/App.vue', 'must not auto-inject fallback Publish pages into registered brand previews')
  }
  if (/\["NavigationBar",\s*"HeroHeader",\s*"Card",\s*"Button"\]/.test(source)) {
    fail('src/App.vue', 'runtime pages must not silently default to NavigationBar/HeroHeader/Card/Button')
  }
}

function main() {
  validateRendererArchitecture()

  if (!fs.existsSync(registryFile)) {
    fail('public/brand-previews/registry.json', 'registry file is required for standard demo previews')
  }

  const registry = readJson(registryFile, 'public/brand-previews/registry.json')
  if (!registry) return finish()

  if (registry.schema !== 'brand-preview-registry.v0.2') {
    fail('registry', 'schema must be brand-preview-registry.v0.2')
  }

  if (registry.access?.read !== 'public' || registry.access?.authentication !== 'none' || registry.access?.write !== 'curated-pull-request') {
    fail('registry', 'access must declare public unauthenticated reads and curated-pull-request writes')
  }

  if ('items' in registry) fail('registry', 'legacy items[] is not allowed; use brands[]')
  if (!Array.isArray(registry.brands)) fail('registry', 'brands[] is required')

  const seen = new Set()
  const seenSources = new Map()
  for (const [index, entry] of (registry.brands || []).entries()) {
    if (entry?.id) {
      if (seen.has(entry.id)) fail(`registry.brands[${index}]`, `duplicate id ${entry.id}`)
      seen.add(entry.id)
    }
    for (const source of entry?.canonicalSources || []) {
      const normalized = normalizeSourceUrl(source)
      if (!normalized) continue
      if (seenSources.has(normalized) && seenSources.get(normalized) !== entry.id) {
        fail(`registry.brands[${index}]`, `canonical source already belongs to ${seenSources.get(normalized)}: ${normalized}`)
      }
      seenSources.set(normalized, entry.id)
    }
    validateRegistryEntry(entry, index)
  }

  if (!seen.size) fail('registry', 'brands[] must not be empty')
  validatePublishedRegistry(registry)
  finish(seen.size)
}

function validatePublishedRegistry(registry) {
  const published = (registry.brands || []).filter((entry) => entry.publicationStatus === 'public-preview')
  const indexFile = path.join(publicArtifactRoot, 'index.json')
  const bySourceFile = path.join(publicArtifactRoot, 'by-source.json')
  if (!fs.existsSync(indexFile) || !fs.existsSync(bySourceFile)) {
    fail('public brand registry', 'generated index is missing; run npm run build:brand-registry')
    return
  }
  const index = readJson(indexFile, indexFile)
  const bySource = readJson(bySourceFile, bySourceFile)
  if (index?.schema !== 'public-brand-registry.v0.1') fail(indexFile, 'invalid schema')
  if (bySource?.schema !== 'public-brand-source-index.v0.1') fail(bySourceFile, 'invalid schema')
  if ((index?.brands || []).length !== published.length) fail(indexFile, 'published brand count is stale')
  for (const entry of published) {
    const manifestFile = path.join(publicArtifactRoot, 'brands', entry.id, entry.version, 'manifest.json')
    const manifest = fs.existsSync(manifestFile) ? readJson(manifestFile, manifestFile) : null
    if (!manifest) fail(entry.id, 'public manifest is missing')
    if (manifest?.id !== entry.id || manifest?.version !== entry.version) fail(entry.id, 'public manifest is stale')
    for (const source of entry.canonicalSources || []) {
      if (bySource?.sources?.[normalizeSourceUrl(source)] !== entry.id) fail(entry.id, `source index is stale: ${source}`)
    }
  }
}

function finish(count = 0) {
  for (const warning of warnings) console.warn(`brand-preview warning: ${warning}`)

  if (errors.length) {
    for (const error of errors) console.error(`brand-preview validation failed: ${error}`)
    process.exit(1)
  }

  console.log(`brand-preview summary: ${count} preview(s) ok`)
}

main()
