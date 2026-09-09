import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const args = process.argv.slice(2)
const strict = args.includes('--strict')
const write = args.includes('--write')
const brandFilter = readArg('--brand')
const registryFile = path.resolve(root, 'public/brand-previews/registry.json')
const reports = []
const errors = []

function readArg(name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : null
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function normalizeColor(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function includesAny(value, terms) {
  return terms.some((term) => value.includes(term))
}

function collectText(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(collectText).join(' ')
  if (typeof value === 'object') return Object.values(value).map(collectText).join(' ')
  return ''
}

function issue(list, severity, code, message, evidence = {}) {
  list.push({ severity, code, message, evidence })
}

function tokenValue(preview, name) {
  return preview?.preset?.tokens?.find((token) => token?.name === name)?.value
}

function categoryColors(evidence) {
  const palette = evidence?.cssEvidence?.categoryPalette
  if (!palette || typeof palette !== 'object') return new Set()
  return new Set(Object.values(palette).map(normalizeColor).filter(Boolean))
}

function assetRoles(evidence, preview) {
  const roles = new Set()
  for (const asset of arrayFromMaybe(evidence?.assets)) {
    if (asset?.role) roles.add(asset.role)
  }
  for (const asset of arrayFromMaybe(evidence?.assetEvidence)) {
    if (asset?.role) roles.add(asset.role)
  }
  for (const asset of Object.values(preview?.preset?.assets || {})) {
    if (asset?.role) roles.add(asset.role)
  }
  return roles
}

function arrayFromMaybe(value) {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') return Object.values(value)
  return []
}

function collectPreviewAssetRefs(value, refs = []) {
  if (typeof value === 'string') {
    refs.push(value)
    return refs
  }
  if (Array.isArray(value)) {
    for (const item of value) collectPreviewAssetRefs(item, refs)
    return refs
  }
  if (value && typeof value === 'object') {
    for (const key of ['src', 'url', 'image', 'logo', 'background', 'backgroundImage']) {
      if (typeof value[key] === 'string') refs.push(value[key])
    }
    for (const item of Object.values(value)) collectPreviewAssetRefs(item, refs)
  }
  return refs
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

function pageRoles(preview) {
  return new Set((preview?.pages || []).flatMap((page) => page?.components || []))
}

function buildReport(entry) {
  const previewFile = path.resolve(root, 'public', entry.path.replace(/^\/+/, ''))
  const preview = readJson(previewFile)
  const migrationRoot = path.resolve(root, entry.migrationRoot || `migrations/${entry.id}`)
  const evidence = readJson(path.resolve(migrationRoot, 'brand-evidence.json')) || {}
  const inventory = readJson(path.resolve(migrationRoot, 'asset-inventory.json')) || {}
  const renderedInventory = readJson(path.resolve(migrationRoot, 'rendered-asset-inventory.json')) || {}
  const mod = readJson(path.resolve(migrationRoot, 'brand-mod.json')) || {}
  const comparison = readJson(path.resolve(migrationRoot, 'visual-comparison-report.json'))
  const goalContract = readJson(path.resolve(migrationRoot, 'goal-contract.json'))
  const fidelityReport = readJson(path.resolve(migrationRoot, 'fidelity-report.json'))
  const requiresLearningProof = goalContract?.goalType === 'brand-learning-capability-test'
  const issues = []

  if (!preview) {
    issue(issues, 'blocking', 'missing-preview-json', `Cannot read preview JSON at ${entry.path}`)
    return { brand: entry.id, level: 'protocol-blocked', issues }
  }

  if (goalContract && fidelityReport?.status !== 'fidelity-pass') {
    issue(
      issues,
      'blocking',
      'fidelity-gate-not-passed',
      'A frozen goal exists, so visual-quality-ready requires the machine-computed Blind QA fidelity gate to pass.',
      { status: fidelityReport?.status || 'missing', hardFailures: fidelityReport?.hardFailures || [] }
    )
  }
  if (requiresLearningProof && fidelityReport?.learningProof?.status !== 'learning-proof-pass') {
    issue(
      issues,
      'blocking',
      'learning-proof-gate-not-passed',
      'A learning-capability Demo is ready only when Evidence Fidelity, Structural Fidelity, and Generative Proof all pass independently.',
      { learningProof: fidelityReport?.learningProof || { status: 'missing' } }
    )
  }

  const primary = normalizeColor(tokenValue(preview, '--du-primary-color'))
  const text = collectText({ evidence, preview, mod }).toLowerCase()
  const primaryText = collectText({
    token: preview.preset?.tokens?.filter((token) => token?.name === '--du-primary-color'),
    signals: preview.preset?.signals?.filter((signal) => collectText(signal).includes('--du-primary-color')),
    colorRecipe: preview.styleRecipeDetails?.color
  }).toLowerCase()
  const semanticColors = categoryColors(evidence)
  const hasCategorySemantics = semanticColors.size >= 3 || includesAny(text, ['categorypalette', 'taxonomy', 'semantic category', '分类', '品类'])
  const hasActionEvidence = includesAny(primaryText, ['cta', 'button', 'action', 'primary action', '主操作', '按钮', '行动'])
  const primaryLooksSemantic = includesAny(primaryText, ['semantic', 'category', 'taxonomy', 'news', 'game', 'app', 'card', '分類', '分类', '品类'])

  if (primary && semanticColors.has(primary) && hasCategorySemantics && !hasActionEvidence) {
    issue(
      issues,
      'warning',
      'primary-color-looks-like-category-color',
      '--du-primary-color appears to come from a taxonomy/category color, not from a primary action or brand mark.',
      { primary, categoryPalette: evidence.cssEvidence?.categoryPalette || null }
    )
  }

  if (primary && primaryLooksSemantic && !hasActionEvidence) {
    issue(
      issues,
      'warning',
      'primary-color-evidence-is-semantic-not-action',
      '--du-primary-color is justified as a semantic/category color; primary action color needs CTA/button/logo computed evidence.',
      { primary, primaryEvidence: primaryText.slice(0, 600) }
    )
  }

  if (evidence?.sourceEvidence?.primaryCta && !hasActionEvidence) {
    issue(
      issues,
      'warning',
      'primary-cta-not-used-as-color-evidence',
      'Evidence has a primary CTA, but the preview does not justify --du-primary-color from CTA/button computed style.',
      { primaryCta: evidence.sourceEvidence.primaryCta, primary }
    )
  }

  const roles = assetRoles(evidence, preview)
  const requiredWhenPresent = ['hero-background', 'logo']
  for (const role of requiredWhenPresent) {
    const evidenceHasRole = (evidence.assets || []).some((asset) => asset?.role === role)
    const previewHasRole = Object.values(preview.preset?.assets || {}).some((asset) => asset?.role === role)
    if (evidenceHasRole && !previewHasRole) {
      issue(issues, 'blocking', `missing-${role}-preview-asset`, `Evidence contains ${role}, but preview assets do not expose it.`)
    }
  }

  if (roles.size >= 4 && (preview.pages || []).length < 3) {
    issue(
      issues,
      'warning',
      'asset-rich-source-has-too-few-pages',
      'Source has a rich asset vocabulary; standard demo should expose at least three page templates before business apply.',
      { assetRoles: Array.from(roles), pages: preview.pages?.length || 0 }
    )
  }

  const pages = pageRoles(preview)
  for (const role of ['HeroHeader', 'Image', 'Button']) {
    if (!pages.has(role)) {
      issue(issues, 'warning', `missing-${role.toLowerCase()}-component-role`, `Preview pages do not show ${role}, so visual transfer cannot be inspected.`)
    }
  }

  const missingForDemoGate = inventory.missingForDemoGate || []
  if (missingForDemoGate.length) {
    issue(
      issues,
      'warning',
      'asset-inventory-has-demo-gate-gaps',
      'Asset inventory still lists required evidence before the demo can be treated as visually verified.',
      { missingForDemoGate }
    )
  }

  const comparisonText = collectText(comparison).toLowerCase()
  if (!comparison) {
    issue(
      issues,
      'warning',
      'missing-visual-comparison-report',
      'Missing visual-comparison-report.json; browser/schema gates prove rendering, but not whether the demo looks like the source site.'
    )
  } else {
    const sourceScreenshots = arrayFromMaybe(comparison.sourceScreenshots)
    const comparisons = arrayFromMaybe(comparison.comparisons || comparison.checkedPages || comparison.pages)
    if (sourceScreenshots.length < 2) {
      issue(
        issues,
        'warning',
        'insufficient-source-screenshot-comparison',
        'Visual comparison should include at least two source screenshots or source page crops before the demo is considered visually ready.',
        { sourceScreenshots: sourceScreenshots.length }
      )
    }
    if (comparisons.length < 2) {
      issue(
        issues,
        'warning',
        'insufficient-demo-source-comparisons',
        'Visual comparison should compare at least two source/demo page pairs and record matched patterns plus gaps.',
        { comparisons: comparisons.length }
      )
    }
    const placeholderComparisons = comparisons.filter((item) => {
      const authenticity = String(item?.assetAuthenticity || item?.assetStatus || '').toLowerCase()
      if (includesAny(authenticity, ['placeholder', 'fake', 'not-official', 'not-source', 'non-source', '待替换', '占位'])) {
        return true
      }
      const nextFix = String(item?.nextFix || '').toLowerCase()
      return includesAny(nextFix, ['replace placeholder', 'replace fake', '替换占位'])
    })
    if (placeholderComparisons.length) {
      issue(
        issues,
        'warning',
        'visual-comparison-identifies-placeholder-assets',
        'Visual comparison says the preview still uses placeholder or non-source assets; keep the preview as draft.',
        { comparisons: placeholderComparisons.length }
      )
    }
  }

  const previewAssetRefs = unique(collectPreviewAssetRefs({
    presetAssets: preview.preset?.assets,
    sectionAssets: preview.pages?.map((page) => page.sections?.map((section) => section.assets || {})),
  }))
  const localBrandAssets = previewAssetRefs.filter((asset) => asset.startsWith(`/assets/brand-assets/${entry.id}/`))
  const renderedText = collectText(renderedInventory).toLowerCase()
  const previewAssetMetadataText = collectText(preview.preset?.assets).toLowerCase()
  const unprovenLocalAssets = localBrandAssets.filter((asset) => !renderedText.includes(path.basename(asset).toLowerCase()))
  if (unprovenLocalAssets.length && !includesAny(previewAssetMetadataText, ['downloaded source asset', 'official source asset', 'source-localized'])) {
    issue(
      issues,
      'warning',
      'local-demo-assets-not-proven-as-source-assets',
      'Preview uses local brand assets that are not proven to be downloaded/localized source assets. They may be placeholders and cannot make the demo visually ready.',
      { assets: unprovenLocalAssets.slice(0, 8) }
    )
  }

  const mustVerifyText = collectText(preview.mustVerifyBeforeApply).toLowerCase()
  if (!includesAny(mustVerifyText, ['screenshot', 'computed', '截图', '渲染', 'crop', '比例'])) {
    issue(
      issues,
      'warning',
      'missing-rendered-verification-items',
      'mustVerifyBeforeApply should include rendered screenshot/computed checks, not only data/schema checks.'
    )
  }

  const hasDecorativeAsset = Array.from(roles).some((role) => role.includes('decorative')) || roles.has('loading-animation')
  const motionRecipeText = collectText(preview.styleRecipeDetails?.motion).toLowerCase()
  if (hasDecorativeAsset && !motionRecipeText) {
    issue(
      issues,
      'warning',
      'decorative-motion-not-modeled',
      'Evidence contains decorative or animated assets, but preview has no motion/decoration recipe.'
    )
  }

  const warningCount = issues.filter((item) => item.severity === 'warning').length
  const blockingCount = issues.filter((item) => item.severity === 'blocking').length
  const level = blockingCount
    ? 'protocol-blocked'
    : warningCount
      ? 'draft-visual-preview'
      : requiresLearningProof
        ? 'learning-proof-ready'
        : 'visual-quality-ready'

  return {
    brand: entry.id,
    displayName: entry.displayName,
    sourceUrl: entry.sourceUrl,
    level,
    primaryColor: primary || null,
    assetRoles: Array.from(roles).sort(),
    pageCount: preview.pages?.length || 0,
    issues
  }
}

function writeReport(report) {
  const file = path.resolve(root, 'migrations', report.brand, 'visual-quality-report.json')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`)
}

function main() {
  const registry = readJson(registryFile)
  if (!registry?.brands?.length) {
    errors.push('public/brand-previews/registry.json must contain brands[]')
    return finish()
  }

  const entries = registry.brands.filter((entry) => !brandFilter || entry.id === brandFilter)
  if (brandFilter && entries.length === 0) {
    errors.push(`brand ${brandFilter} not found in preview registry`)
    return finish()
  }

  for (const entry of entries) {
    const report = buildReport(entry)
    reports.push(report)
    if (write) writeReport(report)
  }

  finish()
}

function finish() {
  for (const error of errors) console.error(`brand-quality validation failed: ${error}`)

  for (const report of reports) {
    console.log(`brand-quality ${report.brand}: ${report.level}`)
    for (const item of report.issues) {
      const prefix = item.severity === 'blocking' ? '  blocking' : '  warning'
      console.log(`${prefix}: ${item.code} - ${item.message}`)
    }
    if (!report.issues.length) console.log('  ok: no visual quality gaps detected')
  }

  const blocking = reports.flatMap((report) => report.issues).some((item) => item.severity === 'blocking')
  const warnings = reports.flatMap((report) => report.issues).some((item) => item.severity === 'warning')
  if (errors.length || blocking || (strict && warnings)) process.exit(1)
}

main()
