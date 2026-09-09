import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const files = args.length
  ? args
  : fs
      .readdirSync(path.resolve(process.cwd(), 'migrations'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `migrations/${entry.name}/brand-mod.json`)
      .filter((file) => fs.existsSync(path.resolve(process.cwd(), file)))

function readJson(target) {
  return JSON.parse(fs.readFileSync(target, 'utf8'))
}

function fail(file, message) {
  console.error(`brand-mod validation failed in ${file}: ${message}`)
  process.exit(1)
}

const warnings = []

function warn(file, message) {
  warnings.push(`brand-mod warning in ${file}: ${message}`)
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function flattenDtcgTokens(node, trail = [], tokens = []) {
  if (!isPlainObject(node)) return tokens

  if ('$type' in node && '$value' in node) {
    tokens.push({ path: trail, token: node })
    return tokens
  }

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) continue
    flattenDtcgTokens(value, [...trail, key], tokens)
  }

  return tokens
}

function validateDtcgTokens(file, mod) {
  if (!isPlainObject(mod.tokens.dtcg)) {
    fail(file, 'tokens.dtcg must exist as the canonical DTCG token tree')
  }

  const flattened = flattenDtcgTokens(mod.tokens.dtcg)
  if (!flattened.length) {
    fail(file, 'tokens.dtcg must include at least one token')
  }

  const coveredTargets = new Set()

  for (const entry of flattened) {
    const { token, path: tokenPath } = entry
    if (typeof token.$type !== 'string' || !token.$type.trim()) {
      fail(file, `DTCG token ${tokenPath.join('.')} must define a non-empty $type`)
    }

    if (!isPlainObject(token.$extensions)) {
      fail(file, `DTCG token ${tokenPath.join('.')} must define $extensions`)
    }

    const target = token.$extensions['echo.brand.target']
    const channel = token.$extensions['echo.brand.channel']

    if (typeof target !== 'string' || !target.trim()) {
      fail(file, `DTCG token ${tokenPath.join('.')} must define $extensions["echo.brand.target"]`)
    }

    if (channel !== 'mapped' && channel !== 'styleOnly') {
      fail(file, `DTCG token ${tokenPath.join('.')} must define channel as mapped or styleOnly`)
    }

    coveredTargets.add(target)
  }

  for (const key of Object.keys(mod.tokens.mapped)) {
    if (!coveredTargets.has(key)) {
      fail(file, `tokens.dtcg must cover mapped compatibility token ${key}`)
    }
  }

  for (const key of Object.keys(mod.tokens.styleOnly)) {
    if (!coveredTargets.has(key)) {
      fail(file, `tokens.dtcg must cover styleOnly compatibility token ${key}`)
    }
  }
}

function validate(file) {
  const absolute = path.resolve(process.cwd(), file)
  const mod = readJson(absolute)

  if (mod.schema !== 'brand-mod.v0.1') fail(file, 'schema must be brand-mod.v0.1')

  const requiredTopLevel = [
    'manifest',
    'tokens',
    'semanticRoles',
    'componentVariants',
    'slots',
    'assets',
    'layoutRules',
    'platformOverrides',
    'verification'
  ]

  for (const key of requiredTopLevel) {
    if (!mod[key]) fail(file, `missing top-level field: ${key}`)
  }

  for (const key of ['brand', 'displayName', 'sourceUrl', 'version', 'scope', 'producer']) {
    if (!mod.manifest[key]) fail(file, `missing manifest.${key}`)
  }

  if (mod.manifest.scope.for && (!Array.isArray(mod.manifest.scope.for) || !mod.manifest.scope.for.length)) {
    fail(file, 'manifest.scope.for must be a non-empty string array when present')
  }

  if (mod.manifest.scope.notFor?.some((item) => /game-only/i.test(item)) !== true) {
    fail(file, 'manifest.scope.notFor must clarify this is not game-only')
  }

  if (mod.manifest.producer.decoupledFrom?.includes('/qdmp') !== true) {
    fail(file, 'manifest.producer.decoupledFrom must include /qdmp')
  }

  if (!mod.tokens.mapped || !Object.keys(mod.tokens.mapped).length) {
    fail(file, 'tokens.mapped must not be empty')
  }

  if (!mod.tokens.styleOnly || !Object.keys(mod.tokens.styleOnly).length) {
    fail(file, 'tokens.styleOnly must not be empty')
  }

  validateDtcgTokens(file, mod)
  validateSemanticRoles(file, mod)

  const assetIds = new Set(mod.assets.map((asset) => asset.id))
  const requiredAssetRoles = ['hero-background', 'section-background']
  for (const role of requiredAssetRoles) {
    const roleAssets = mod.assets.filter((asset) => asset.role === role)
    const hasAcceptedAsset = roleAssets.some((asset) => asset.status !== 'rejected')
    const hasRejectedAudit = roleAssets.some((asset) => asset.status === 'rejected'
      && asset.target === null
      && asset.value === null
      && Array.isArray(asset.evidenceRefs)
      && asset.evidenceRefs.length > 0
      && typeof asset.reason === 'string'
      && asset.reason.trim().length > 0)
    if (!hasAcceptedAsset && !hasRejectedAudit) {
      fail(file, `missing asset role or evidence-backed rejected audit: ${role}`)
    }
  }

  const sectionChain = mod.layoutRules.sectionBackgroundChain
  if (!sectionChain?.layers?.length) fail(file, 'layoutRules.sectionBackgroundChain.layers must not be empty')

  for (const layer of sectionChain.layers) {
    if (!assetIds.has(layer.assetId)) {
      fail(file, `sectionBackgroundChain layer ${layer.id} references missing asset ${layer.assetId}`)
    }
  }

  if (mod.layoutRules.overlay?.inspectorTag?.mustNotAffectLayout !== true) {
    fail(file, 'inspector overlay tag must be marked as not affecting layout')
  }

  if (mod.layoutRules.bottomBarReserve?.required !== true) {
    fail(file, 'bottomBarReserve.required must be true')
  }

  if (!Array.isArray(mod.componentVariants) || mod.componentVariants.length < 3) {
    fail(file, 'componentVariants should include at least three variants')
  }

  if (!Array.isArray(mod.slots) || mod.slots.length < 3) {
    fail(file, 'slots should include at least three visual slots')
  }

  validateRuleCandidates(file, mod)

  console.log(`brand-mod ok: ${file}`)
}

function validateSemanticRoles(file, mod) {
  if (!isPlainObject(mod.semanticRoles) || !Object.keys(mod.semanticRoles).length) {
    fail(file, 'semanticRoles must exist and must not be empty')
  }

  const requiredRoles = [
    'surface.page',
    'surface.card',
    'text.primary',
    'border.subtle',
    'action.primary.fill'
  ]

  for (const roleKey of requiredRoles) {
    if (!isPlainObject(mod.semanticRoles[roleKey])) {
      fail(file, `semanticRoles.${roleKey} is required`)
    }
  }

  const tokenBackedRoles = {
    'surface.page': '--du-bg-2',
    'surface.card': '--du-bg-1'
  }

  for (const [roleKey, target] of Object.entries(tokenBackedRoles)) {
    const role = mod.semanticRoles[roleKey]
    if (role.target !== target) {
      fail(file, `semanticRoles.${roleKey}.target must be ${target}`)
    }
  }

  const textPrimaryRole = mod.semanticRoles['text.primary']
  const rejectedTextPrimaryRole = textPrimaryRole.kind === 'unresolvedEvidenceRole'
    && textPrimaryRole.target === null
    && textPrimaryRole.value === null
    && textPrimaryRole.status === 'rejected'
    && Array.isArray(textPrimaryRole.evidenceRefs)
    && textPrimaryRole.evidenceRefs.length > 0
    && typeof textPrimaryRole.reason === 'string'
    && textPrimaryRole.reason.trim().length > 0
  if (textPrimaryRole.target !== '--du-text-1' && !rejectedTextPrimaryRole) {
    fail(file, 'semanticRoles.text.primary must map to --du-text-1 or record an evidence-backed rejected unresolved role')
  }

  const borderRole = mod.semanticRoles['border.subtle']
  const rejectedBorderRole = borderRole.kind === 'unresolvedEvidenceRole'
    && borderRole.target === null
    && borderRole.value === null
    && borderRole.status === 'rejected'
    && Array.isArray(borderRole.evidenceRefs)
    && borderRole.evidenceRefs.length > 0
    && typeof borderRole.reason === 'string'
    && borderRole.reason.trim().length > 0
  if (borderRole.target !== '--du-border-1' && !rejectedBorderRole) {
    fail(file, 'semanticRoles.border.subtle must map to --du-border-1 or record an evidence-backed rejected unresolved role')
  }

  const primaryRole = mod.semanticRoles['action.primary.fill']
  if (!Array.isArray(primaryRole.sources) || !primaryRole.sources.length) {
    fail(file, 'semanticRoles.action.primary.fill.sources must not be empty')
  }

  if (primaryRole.kind === 'actionEvidence') {
    if (!isPlainObject(primaryRole.protocol)) {
      fail(file, 'semanticRoles.action.primary.fill.protocol must exist when derived from action evidence')
    }
    if (typeof primaryRole.protocol.bucket !== 'string' || !primaryRole.protocol.bucket.trim()) {
      fail(file, 'semanticRoles.action.primary.fill.protocol.bucket must be present')
    }
  }
}

function validateRuleCandidates(file, mod) {
  const candidates = mod.verification.ruleCandidates
  if (mod.manifest.brand === 'rocom' && !Array.isArray(candidates)) {
    warn(file, 'RoCom should keep ruleCandidates because it is the first standardization sample')
    return
  }

  if (!Array.isArray(candidates)) return

  const requiredFields = [
    'id',
    'observedIn',
    'abstractMechanism',
    'appliesWhen',
    'evidenceRequired',
    'scriptCheck',
    'promotion'
  ]

  for (const candidate of candidates) {
    for (const field of requiredFields) {
      if (!candidate[field]) warn(file, `ruleCandidate ${candidate.id || '<unknown>'} missing ${field}`)
    }

    if (!Array.isArray(candidate.evidenceRequired) || candidate.evidenceRequired.length < 2) {
      warn(file, `ruleCandidate ${candidate.id || '<unknown>'} should list at least two evidence requirements`)
    }

    if (!candidate.promotion?.level) {
      warn(file, `ruleCandidate ${candidate.id || '<unknown>'} missing promotion.level`)
      continue
    }

    if (
      candidate.promotion.level === 'blocking' &&
      (candidate.promotion.verifiedBrands?.length || 0) < 2
    ) {
      warn(file, `ruleCandidate ${candidate.id} cannot be blocking until verified by at least two brands`)
    }
  }
}

if (!files.length) fail('migrations/*/brand-mod.json', 'no brand-mod files found')

for (const file of files) validate(file)

for (const warning of warnings) console.warn(warning)

console.log(`brand-mod summary: ${files.length} file(s) ok`)
