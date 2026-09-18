#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

const args = process.argv.slice(2)
const value = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : '' }
const optionsOnly = args.includes('--options-only')
if (!value('--options') || (!optionsOnly && !value('--decision'))) {
  console.error('Usage: validate-wild-design-decision.mjs --options <options.json> [--options-only | --decision <decision.json>] --business-scope <scope.json> --brand-evidence <evidence.json> [--brand-mod <brand-mod.json>] [--design-direction <direction.json>] [--history <history.json>]')
  process.exit(2)
}
const optionsFile = path.resolve(value('--options'))
const decisionFile = value('--decision') ? path.resolve(value('--decision')) : ''
const directionFile = value('--design-direction') ? path.resolve(value('--design-direction')) : ''
const businessScopeFile = value('--business-scope') ? path.resolve(value('--business-scope')) : ''
const brandEvidenceFile = value('--brand-evidence') ? path.resolve(value('--brand-evidence')) : ''
const brandModFile = value('--brand-mod') ? path.resolve(value('--brand-mod')) : ''
const historyFile = value('--history') ? path.resolve(value('--history')) : ''
const failures = []
const fail = (code, message, context = {}) => failures.push({ code, message, ...context })
const read = (file, code) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch (e) { fail(code, e.message, { file }); return null } }
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const hashValue = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const optionSignature = (item) => ({
  visualNarrative: item.firstViewportVisualProof?.visualNarrative || '',
  compositionSignature: item.firstViewportVisualProof?.compositionSignature || {},
  assetStrategy: item.visualChoiceContract?.assetStrategy || '',
  materialLanguage: item.visualChoiceContract?.materialLanguage || '',
})
const options = read(optionsFile, 'WILD_DESIGN_OPTIONS_UNREADABLE')
const decision = decisionFile ? read(decisionFile, 'WILD_DESIGN_DECISION_UNREADABLE') : null
const brandEvidence = brandEvidenceFile && fs.existsSync(brandEvidenceFile) ? read(brandEvidenceFile, 'WILD_DESIGN_BRAND_EVIDENCE_UNREADABLE') : null
const brandMod = brandModFile && fs.existsSync(brandModFile) ? read(brandModFile, 'WILD_DESIGN_BRAND_MOD_UNREADABLE') : null
const brandPackageEvidenceText = JSON.stringify({ brandEvidence, brandMod })
const items = Array.isArray(options?.options) ? options.options : []
const visualDimensions = ['dominantColorRole', 'typographyCharacter', 'assetStrategy', 'materialLanguage', 'motionCharacter', 'imagePolicy']
if (!options?.sourceBrand || !options?.frozenBrandEvidenceSha256) fail('WILD_DESIGN_BRAND_BINDING_REQUIRED', 'Options must name the user-input brand and bind its exact brand-evidence SHA-256.')
if (!brandEvidenceFile) fail('WILD_DESIGN_BRAND_EVIDENCE_REQUIRED', '--brand-evidence is required.')
else if (!fs.existsSync(brandEvidenceFile) || options?.frozenBrandEvidenceSha256 !== sha(brandEvidenceFile)) fail('WILD_DESIGN_BRAND_EVIDENCE_MISMATCH', 'Options must bind the exact supplied brand evidence.')
if (!Array.isArray(options?.sharedLayoutContract) || !options.sharedLayoutContract.length) fail('WILD_DESIGN_SHARED_LAYOUT_REQUIRED', 'Freeze the shared business layout so layout changes cannot masquerade as style choices.')

const strictVisualPreview = options?.schema === 'wild-design-options/v2'
if (strictVisualPreview && (!brandModFile || !brandMod)) fail('WILD_DESIGN_BRAND_MOD_REQUIRED', 'v2 apply-host choices must bind the validated brand-mod containing reusable token, asset and layout contracts.')
else if (strictVisualPreview && options?.frozenBrandModSha256 !== sha(brandModFile)) fail('WILD_DESIGN_BRAND_MOD_MISMATCH', 'Options must bind the exact supplied brand-mod SHA-256.')
if (!['wild-design-options/v1', 'wild-design-options/v2'].includes(options?.schema)) fail('WILD_DESIGN_OPTIONS_SCHEMA_INVALID', 'Expected wild-design-options/v1 or wild-design-options/v2.')
if (!['design-host', 'apply-host'].includes(options?.workflow)) fail('WILD_DESIGN_WORKFLOW_INVALID', 'MVP supports design-host direction artifacts and legacy apply-host artifacts only.')
if (items.length < 2 || items.length > 3) fail('WILD_DESIGN_OPTION_COUNT_INVALID', 'Provide two or three options.')
const ids = new Set()
const byId = new Map()
let recommendations = 0
for (const item of items) {
  if (!item.id || ids.has(item.id)) fail('WILD_DESIGN_OPTION_ID_INVALID', 'Option ids must be unique.', { option: item.id })
  ids.add(item.id)
  byId.set(item.id, item)
  if (item.recommended) recommendations += 1
  if (!item.name || !item.sameBusinessScopeHash || !Array.isArray(item.previewEvidence) || !item.previewEvidence.length) fail('WILD_DESIGN_OPTION_INCOMPLETE', 'Each option needs name, sameBusinessScopeHash and previewEvidence.', { option: item.id })
  for (const key of ['informationDensity', 'visualAssets', 'pageStructure', 'motionIntensity']) if (!item.differences?.[key]) fail('WILD_DESIGN_DIFFERENCE_MISSING', `differences.${key} is required.`, { option: item.id })
  if (!item.directionContract || !Array.isArray(item.directionContract.layout) || !item.directionContract.layout.length) fail('WILD_DESIGN_DIRECTION_CONTRACT_MISSING', 'Each option needs an executable directionContract with the shared layout.', { option: item.id })
  if (!strictVisualPreview && JSON.stringify(item.directionContract?.layout || []) !== JSON.stringify(options?.sharedLayoutContract || [])) fail('WILD_DESIGN_LAYOUT_DRIFT', 'v1 style options must preserve the same frozen business layout.', { option: item.id })
  if (strictVisualPreview && JSON.stringify(item.directionContract?.businessCapabilities || []) !== JSON.stringify(options?.sharedLayoutContract || [])) fail('WILD_DESIGN_CAPABILITY_DRIFT', 'v2 options may change composition but must preserve the same frozen business capabilities.', { option: item.id })
  if (!Array.isArray(item.brandEvidenceRefs) || !item.brandEvidenceRefs.length) fail('WILD_DESIGN_BRAND_EVIDENCE_REFS_REQUIRED', 'Every option must cite approved evidence from the user-input brand.', { option: item.id })
  const consumption = item.designSystemConsumption
  if (!consumption || !['runtime', 'host-native-preview', 'host-grounded-preview', 'simulated-preview'].includes(consumption.mode)) fail('WILD_DESIGN_SYSTEM_CONSUMPTION_MODE_REQUIRED', 'Every option must declare whether it is a runtime implementation, a host-grounded selection preview, or an explicitly simulated concept.', { option: item.id })
  if (strictVisualPreview && consumption?.mode !== 'host-grounded-preview') fail('WILD_DESIGN_PRESELECTION_IMPLEMENTATION_FORBIDDEN', 'apply-host style selection must use an isolated host-grounded preview. Runtime/native-host implementations and detached simulated concepts are forbidden before the user selects a direction.', { option: item.id, mode: consumption?.mode })
  for (const track of ['tokens', 'components', 'assets', 'composition']) {
    const entry = consumption?.[track]
    if (!entry || !['consumed', 'simulated', 'not-applicable'].includes(entry.status) || !Array.isArray(entry.refs) || !entry.refs.length) fail('WILD_DESIGN_SYSTEM_TRACK_INCOMPLETE', `designSystemConsumption.${track} requires status and concrete refs.`, { option: item.id, track })
    if (consumption?.mode === 'runtime' && entry?.status === 'simulated') fail('WILD_DESIGN_RUNTIME_CLAIM_MISMATCH', 'A runtime preview may not describe a design-system track as simulated.', { option: item.id, track })
  }
  if (strictVisualPreview) {
    const mapping = consumption?.mappingPolicy
    if (mapping?.visualTarget !== 'preserve-selected-option') fail('WILD_DESIGN_MAPPING_VISUAL_TARGET_INVALID', 'Design-system mapping must preserve the selected visual option as the acceptance target.', { option: item.id })
    if (mapping?.componentRole !== 'behavior-and-api') fail('WILD_DESIGN_MAPPING_COMPONENT_ROLE_INVALID', 'DangoUI components provide behavior, semantics and API; their default appearance is not the visual target.', { option: item.id })
    if (mapping?.styleOnlyFallback !== true) fail('WILD_DESIGN_MAPPING_STYLE_ONLY_REQUIRED', 'Style-only recipes and brand assets must remain available for visual decisions that tokens or stock components cannot express.', { option: item.id })
    if (mapping?.defaultAppearanceAllowed !== false) fail('WILD_DESIGN_MAPPING_DEFAULT_FALLBACK_FORBIDDEN', 'A mapped preview may not silently fall back to stock DangoUI appearance when that dilutes the selected direction.', { option: item.id })
    const hostBinding = consumption?.hostBinding
    const baselineArtifacts = Array.isArray(hostBinding?.baselineArtifacts) ? hostBinding.baselineArtifacts : []
    if (!hostBinding || hostBinding.previewOrigin !== 'host-baseline-derived') fail('WILD_DESIGN_HOST_BASELINE_ORIGIN_REQUIRED', 'Selection previews must be derived from a frozen real-host baseline without implementing the options in host source.', { option: item.id })
    if (!String(hostBinding?.targetRoute || '').trim()) fail('WILD_DESIGN_HOST_TARGET_ROUTE_REQUIRED', 'Host-grounded previews must bind the real target route.', { option: item.id })
    if (!['live-host-baseline', 'captured-host-state'].includes(hostBinding?.businessDataSource)) fail('WILD_DESIGN_HOST_DATA_SOURCE_REQUIRED', 'Host-grounded previews must use a live baseline or captured host state, not invented demo content.', { option: item.id })
    if (!baselineArtifacts.length) fail('WILD_DESIGN_HOST_BASELINE_BINDING_REQUIRED', 'Host-grounded previews must bind at least one frozen host screenshot, DOM snapshot, or content manifest and its SHA-256.', { option: item.id })
    for (const source of baselineArtifacts) {
      const sourceFile = source?.path ? path.resolve(path.dirname(optionsFile), source.path) : ''
      if (!sourceFile || !fs.existsSync(sourceFile)) fail('WILD_DESIGN_HOST_BASELINE_MISSING', 'A bound frozen host baseline artifact does not exist.', { option: item.id, path: source?.path })
      else if (!source.sha256 || source.sha256 !== sha(sourceFile)) fail('WILD_DESIGN_HOST_BASELINE_HASH_MISMATCH', 'Host-grounded preview baseline bindings must match the frozen artifact hash.', { option: item.id, path: source?.path })
    }
    const isolation = consumption?.generationIsolation
    if (!isolation || isolation.hostFilesModified !== false || !isolation.hostSourceBeforeSha256 || isolation.hostSourceBeforeSha256 !== isolation.hostSourceAfterSha256) fail('WILD_DESIGN_HOST_MUTATED_BEFORE_SELECTION', 'Option generation must prove the host source tree hash stayed unchanged before and after candidate rendering.', { option: item.id })
  }
  if (consumption?.mode === 'runtime') {
    const proof = consumption.runtimeProof
    const entryFile = proof?.entryPath ? path.resolve(path.dirname(optionsFile), proof.entryPath) : ''
    if (proof?.package !== 'dangoui' || !entryFile || !fs.existsSync(entryFile)) fail('WILD_DESIGN_RUNTIME_PROOF_REQUIRED', 'A runtime preview must bind an existing entry file that imports DangoUI.', { option: item.id })
    else {
      const entrySource = fs.readFileSync(entryFile, 'utf8')
      if (!/(?:from\s*["']dangoui["']|import\s*["']dangoui\/)/.test(entrySource)) fail('WILD_DESIGN_DANGOUI_IMPORT_NOT_PROVEN', 'The runtime entry does not import DangoUI.', { option: item.id, entryPath: proof.entryPath })
      for (const component of proof.components || []) if (!entrySource.includes(component)) fail('WILD_DESIGN_DANGOUI_COMPONENT_NOT_RENDERED', 'A claimed DangoUI component is not referenced by the runtime entry.', { option: item.id, component })
      if (!Array.isArray(proof.tokens) || !proof.tokens.length) fail('WILD_DESIGN_DANGOUI_TOKEN_PROOF_REQUIRED', 'Runtime previews must name the DangoUI tokens they consume.', { option: item.id })
    }
  }
  for (const key of ['tokens', 'typography', 'components', 'materials', 'motion']) if (!item.styleDirectionContract?.[key]) fail('WILD_DESIGN_STYLE_DIMENSION_MISSING', `styleDirectionContract.${key} is required.`, { option: item.id })
  for (const key of visualDimensions) if (!item.visualChoiceContract?.[key]) fail('WILD_DESIGN_VISUAL_CHOICE_DIMENSION_MISSING', `visualChoiceContract.${key} is required so the user is choosing a visible style, not a layout variant.`, { option: item.id })
  if (!Array.isArray(item.visualChoiceContract?.forbiddenFallbacks) || !item.visualChoiceContract.forbiddenFallbacks.length) fail('WILD_DESIGN_FORBIDDEN_FALLBACKS_REQUIRED', 'Each option must freeze visible characteristics that later roles may not dilute.', { option: item.id })
  if (strictVisualPreview) {
    const closure = item.brandSystemClosure
    const tokenApplications = Array.isArray(closure?.tokenApplications) ? closure.tokenApplications : []
    const assetApplications = Array.isArray(closure?.assetApplications) ? closure.assetApplications : []
    const compositionApplications = Array.isArray(closure?.compositionApplications) ? closure.compositionApplications : []
    if (tokenApplications.length < 3) fail('WILD_DESIGN_TOKEN_APPLICATIONS_INSUFFICIENT', 'Each selectable direction must bind at least three source-brand token roles to visible selectors, CSS properties and rendered values.', { option: item.id })
    for (const binding of tokenApplications) {
      if (!binding.tokenRef || !binding.evidenceRef || !binding.renderedSelector || !binding.cssProperty || !binding.renderedValue) fail('WILD_DESIGN_TOKEN_APPLICATION_INCOMPLETE', 'Token applications require tokenRef, evidenceRef, selector, CSS property and rendered value.', { option: item.id })
      if (binding.evidenceRef && !brandPackageEvidenceText.includes(binding.evidenceRef)) fail('WILD_DESIGN_TOKEN_EVIDENCE_UNBOUND', 'A token application cites evidence that is absent from the frozen brand package.', { option: item.id, evidenceRef: binding.evidenceRef })
    }
    const identityAssets = assetApplications.filter((binding) => ['brand-identity', 'environment', 'campaign-scene', 'brand-texture'].includes(binding.role))
    if (!identityAssets.length) fail('WILD_DESIGN_SOURCE_BRAND_ASSET_REQUIRED', 'Host business thumbnails cannot establish brand identity. Each direction needs a source-brand identity/environment asset proven by frozen brand evidence.', { option: item.id })
    for (const binding of assetApplications) {
      if (!binding.assetRef || !binding.evidenceRef || !binding.renderedSelector || !binding.role || !binding.sourceSha256 || !Number.isFinite(Number(binding.firstViewportAreaRatio))) fail('WILD_DESIGN_ASSET_APPLICATION_INCOMPLETE', 'Asset applications require assetRef, evidenceRef, source hash, selector, role and measured first-viewport area.', { option: item.id })
      if (binding.sourceKind === 'host-owned-business-art' && ['brand-identity', 'environment', 'campaign-scene', 'brand-texture'].includes(binding.role)) fail('WILD_DESIGN_HOST_ASSET_AS_BRAND_IDENTITY', 'A host-owned business image may remain as content but cannot be counted as source-brand identity evidence.', { option: item.id, assetRef: binding.assetRef })
      if (binding.evidenceRef && !brandPackageEvidenceText.includes(binding.evidenceRef)) fail('WILD_DESIGN_ASSET_EVIDENCE_UNBOUND', 'An asset application cites evidence that is absent from the frozen brand package.', { option: item.id, evidenceRef: binding.evidenceRef })
      if (binding.assetRef && !brandPackageEvidenceText.includes(binding.assetRef)) fail('WILD_DESIGN_ASSET_NOT_IN_FROZEN_EVIDENCE', 'A source-brand asset must be listed in the frozen brand package; nearby host assets or invented decoration cannot substitute for it.', { option: item.id, assetRef: binding.assetRef })
    }
    if (compositionApplications.length < 1) fail('WILD_DESIGN_COMPOSITION_APPLICATION_REQUIRED', 'Each direction must bind a source composition pattern to a visible region and the assets participating in that composition.', { option: item.id })
    for (const binding of compositionApplications) {
      if (!binding.patternRef || !binding.evidenceRef || !binding.renderedRegion || !Array.isArray(binding.assetRefs) || !binding.assetRefs.length) fail('WILD_DESIGN_COMPOSITION_APPLICATION_INCOMPLETE', 'Composition applications require patternRef, evidenceRef, renderedRegion and participating assetRefs.', { option: item.id })
      if (binding.evidenceRef && !brandPackageEvidenceText.includes(binding.evidenceRef)) fail('WILD_DESIGN_COMPOSITION_EVIDENCE_UNBOUND', 'A composition application cites evidence that is absent from the frozen brand package.', { option: item.id, evidenceRef: binding.evidenceRef })
    }
    const coPresence = closure?.coPresence
    if (!coPresence || !coPresence.previewEvidencePath || !Array.isArray(coPresence.tokenRefs) || coPresence.tokenRefs.length < 3 || !Array.isArray(coPresence.assetRefs) || !coPresence.assetRefs.length || !Array.isArray(coPresence.patternRefs) || !coPresence.patternRefs.length) fail('WILD_DESIGN_BRAND_SYSTEM_COPRESENCE_REQUIRED', 'The same rendered preview must prove token, source-brand asset and composition pattern together; separate declarations cannot be combined into a pass.', { option: item.id })
    const proof = item.firstViewportVisualProof
    const dimensions = [...new Set(proof?.visibleDimensions || [])]
    const composition = proof?.compositionSignature
    const atmosphereLayers = [...new Set(proof?.atmosphereLayers || [])]
    const allowedDimensions = new Set(['asset', 'composition', 'material', 'typography', 'motion', 'color'])
    const dominantMedia = Array.isArray(proof?.dominantMedia) ? proof.dominantMedia : []
    const responsive = item.responsiveProof
    if (!proof?.visualNarrative?.trim()) fail('WILD_DESIGN_VISUAL_NARRATIVE_REQUIRED', 'Each v2 option needs a distinct visual narrative, not only a layout label.', { option: item.id })
    if (dimensions.length < 3 || dimensions.some((dimension) => !allowedDimensions.has(dimension))) fail('WILD_DESIGN_VISIBLE_DIMENSIONS_INSUFFICIENT', 'Each v2 option must visibly express at least three supported visual dimensions.', { option: item.id, visibleDimensions: dimensions })
    if (!dominantMedia.length) fail('WILD_DESIGN_DOMINANT_MEDIA_REQUIRED', 'Each v2 option needs a dominant first-viewport brand visual or coherent scene.', { option: item.id })
    if (!dominantMedia.some((media) => Number(media.firstViewportAreaRatio) > 0 && Number(media.firstViewportAreaRatio) <= 1)) fail('WILD_DESIGN_MEDIA_MASS_INVALID', 'Dominant media must record its measured first-viewport area so the host-specific visual decision can be reviewed.', { option: item.id })
    if (!composition || ['visualCenter', 'primaryActionPlacement', 'contentEntry', 'resultPresentation'].some((key) => !composition[key])) fail('WILD_DESIGN_COMPOSITION_SIGNATURE_REQUIRED', 'Each v2 option must declare the visible first-viewport composition landmarks.', { option: item.id })
    if (atmosphereLayers.length < 3) fail('WILD_DESIGN_ATMOSPHERE_INSUFFICIENT', 'A strong visual direction needs at least three coherent atmosphere layers such as environment, lighting, depth, texture or motion.', { option: item.id, atmosphereLayers })
    if (!responsive || !['mobile', 'desktop', 'responsive'].includes(responsive.targetFormFactor)) fail('WILD_DESIGN_FORM_FACTOR_REQUIRED', 'Each v2 option must bind the host form factor before composition.', { option: item.id })
    if (responsive?.targetFormFactor === 'mobile') {
      if (Number(responsive.viewportWidth) > 430 || Number(responsive.viewportWidth) < 320) fail('WILD_DESIGN_MOBILE_VIEWPORT_INVALID', 'Mobile options must be validated at a realistic 320–430px viewport.', { option: item.id })
      if (responsive.persistentSideRail !== false) fail('WILD_DESIGN_MOBILE_PERSISTENT_SIDEBAR_FORBIDDEN', 'A phone-first host may not use a persistent desktop side rail.', { option: item.id })
      if (Number(responsive.primaryContentWidthRatio) < 0.72) fail('WILD_DESIGN_MOBILE_CONTENT_TOO_NARROW', 'Primary mobile content must retain at least 72% of viewport width.', { option: item.id })
      if (Number(responsive.touchTargetMinPx) < 44) fail('WILD_DESIGN_MOBILE_TOUCH_TARGET_TOO_SMALL', 'Mobile controls require a declared 44px minimum touch target.', { option: item.id })
      if (responsive.horizontalOverflow !== false) fail('WILD_DESIGN_MOBILE_HORIZONTAL_OVERFLOW', 'Mobile preview must explicitly prove no unintended horizontal overflow.', { option: item.id })
      if (!['browse-list', 'tool-form', 'visual-landing', 'content-detail'].includes(responsive.pageType)) fail('WILD_DESIGN_MOBILE_PAGE_TYPE_REQUIRED', 'Mobile composition must bind the host page type before sizing Hero.', { option: item.id })
      const impression = responsive.hostFirstImpression
      const impressionEnums = {
        taskPriority: ['efficiency-first', 'balanced', 'immersion-first'],
        informationDensity: ['high', 'medium', 'low'],
        contentFlow: ['continuous-flow', 'sectioned', 'landing'],
        returnFrequency: ['frequent', 'occasional', 'first-visit'],
        firstActionUrgency: ['immediate', 'soon', 'exploratory']
      }
      if (!impression) fail('WILD_DESIGN_HOST_FIRST_IMPRESSION_REQUIRED', 'Mobile composition must classify the real host before choosing Hero height.', { option: item.id })
      else {
        for (const [field, allowed] of Object.entries(impressionEnums)) if (!allowed.includes(impression[field])) fail('WILD_DESIGN_HOST_FIRST_IMPRESSION_INVALID', `hostFirstImpression.${field} must be one of ${allowed.join(', ')}.`, { option: item.id, field, value: impression[field] })
        if (!Array.isArray(impression.existingMediaSlots)) fail('WILD_DESIGN_HOST_MEDIA_SLOTS_REQUIRED', 'hostFirstImpression.existingMediaSlots must record whether the host already provides media capacity.', { option: item.id })
        if (!String(impression.evidence || '').trim()) fail('WILD_DESIGN_HOST_IMPRESSION_EVIDENCE_REQUIRED', 'Host classification needs screenshot or structure evidence, not a page-type guess.', { option: item.id })
      }
      const heroDecision = responsive.heroDecision
      if (!heroDecision || !['none', 'compact', 'contained', 'immersive'].includes(heroDecision.mode)) fail('WILD_DESIGN_HERO_DECISION_REQUIRED', 'Mobile composition must record a host-specific Hero decision.', { option: item.id })
      if (!String(heroDecision?.rationale || '').trim()) fail('WILD_DESIGN_HERO_RATIONALE_REQUIRED', 'Hero height needs a rationale derived from hostFirstImpression.', { option: item.id })
      if (!Number.isFinite(Number(responsive.heroHeightRatio)) || Number(responsive.heroHeightRatio) < 0 || Number(responsive.heroHeightRatio) > 1) fail('WILD_DESIGN_HERO_RATIO_INVALID', 'heroHeightRatio must be a measured 0–1 value for this host decision.', { option: item.id })
      if (!Number.isFinite(Number(responsive.firstBusinessContentTopRatio)) || Number(responsive.firstBusinessContentTopRatio) < 0 || Number(responsive.firstBusinessContentTopRatio) > 1) fail('WILD_DESIGN_BUSINESS_CONTENT_RATIO_INVALID', 'firstBusinessContentTopRatio must be a measured 0–1 value for this host decision.', { option: item.id })
      if (impression?.contentFlow === 'continuous-flow' && responsive.contentContainerFlow !== 'document-flow') fail('WILD_DESIGN_CONTINUOUS_HOST_FIXED_CANVAS', 'A continuous-flow host must keep its business content in document flow instead of a fixed-height canvas.', { option: item.id })
    }
    for (const media of dominantMedia) {
      if (!media.assetRef || !media.evidenceRef || !media.renderedSelector || !media.role || !media.sourceKind) fail('WILD_DESIGN_DOMINANT_MEDIA_INCOMPLETE', 'Dominant media must bind asset, evidence, rendered selector, role and source kind.', { option: item.id })
      if (media.sourceKind === 'host-business-thumbnail') fail('WILD_DESIGN_HOST_THUMBNAIL_NOT_BRAND_HERO', 'A host result thumbnail cannot be the dominant brand visual.', { option: item.id, assetRef: media.assetRef })
    }
  }
  for (const evidence of item.previewEvidence || []) {
    const [relative, fragment] = String(evidence.path || '').split('#')
    const previewFile = path.resolve(path.dirname(optionsFile), relative)
    const previewExtension = path.extname(relative).toLowerCase()
    const mediumException = item.previewMediumException
    if (!relative || !fs.existsSync(previewFile)) fail('WILD_DESIGN_PREVIEW_MISSING', 'Preview evidence file does not exist.', { option: item.id, path: evidence.path })
    else if (fragment && !fs.readFileSync(previewFile, 'utf8').includes(`id="${fragment}"`)) fail('WILD_DESIGN_PREVIEW_FRAGMENT_MISSING', 'Preview fragment does not exist.', { option: item.id, fragment })
    else if (!evidence.sha256 || evidence.sha256 !== sha(previewFile)) fail('WILD_DESIGN_PREVIEW_BINDING_MISMATCH', 'Preview evidence must bind the exact preview file SHA-256.', { option: item.id, path: evidence.path })
    if (strictVisualPreview && options?.workflow === 'design-host' && previewExtension !== '.html' && mediumException?.approvedBy !== 'explicit-user') {
      fail('DESIGN_HOST_STATIC_H5_REQUIRED', 'design-host defaults to lightweight static H5. Non-HTML direction media requires an explicit user-approved exception.', { option: item.id, path: evidence.path })
    }
    if (strictVisualPreview && item.responsiveProof?.targetFormFactor === 'mobile' && fs.existsSync(previewFile) && path.extname(previewFile).toLowerCase() === '.html') {
      const renderedSource = readPreviewBundle(previewFile)
      const sideRailClasses = [...renderedSource.html.matchAll(/<aside\b[^>]*class=["']([^"']+)["'][^>]*>/gi)]
        .flatMap((match) => match[1].split(/\s+/))
      const persistentRail = sideRailClasses.find((className) => {
        const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const rule = renderedSource.css.match(new RegExp(`\\.${escaped}\\s*\\{([^}]*)\\}`, 'i'))?.[1] || ''
        return /position\s*:\s*(?:absolute|fixed|sticky)/i.test(rule)
          && /top\s*:\s*0/i.test(rule)
          && /bottom\s*:\s*0/i.test(rule)
          && /width\s*:\s*\d+(?:\.\d+)?(?:px|%|vw)/i.test(rule)
      })
      if (persistentRail) fail('WILD_DESIGN_RENDERED_MOBILE_SIDEBAR_DETECTED', 'Rendered mobile preview contains a persistent full-height side rail despite its responsive declaration.', { option: item.id, className: persistentRail })
    }
    if (strictVisualPreview) {
      if (evidence.kind !== 'rendered-host-grounded-preview') fail('WILD_DESIGN_RENDERED_HOST_PREVIEW_REQUIRED', 'v2 options require a rendered visual derived from the frozen host baseline, not a textual direction.', { option: item.id })
      if (!['.svg', '.png', '.jpg', '.jpeg', '.webp', '.html'].includes(previewExtension)) fail('WILD_DESIGN_VISUAL_PREVIEW_FILE_REQUIRED', 'v2 preview evidence must be a renderable visual file.', { option: item.id, path: evidence.path })
      if (!evidence.hostRoute || !evidence.viewport) fail('WILD_DESIGN_HOST_VIEWPORT_BINDING_REQUIRED', 'v2 previews must bind the real host route and viewport.', { option: item.id })
      if (evidence.previewOrigin !== 'host-baseline-derived') fail('WILD_DESIGN_PREVIEW_EVIDENCE_NOT_HOST_GROUNDED', 'v2 preview evidence must derive from the frozen host baseline rather than a detached generic demo or a preselected runtime implementation.', { option: item.id })
      if (consumption?.hostBinding?.targetRoute && evidence.hostRoute !== consumption.hostBinding.targetRoute) fail('WILD_DESIGN_HOST_ROUTE_BINDING_MISMATCH', 'Preview evidence route must match the bound host baseline route.', { option: item.id, hostRoute: evidence.hostRoute, targetRoute: consumption.hostBinding.targetRoute })
      if (evidence.presentationMode !== 'host-surface-only' || evidence.proposalChromeAbsent !== true) fail('WILD_DESIGN_PROPOSAL_CHROME_FORBIDDEN', 'Selectable previews must look like the future host page itself. Proposal titles, rationale panels, device galleries, stage labels and design-document chrome are forbidden.', { option: item.id })
      const requiredHostRegions = ['navigation', 'primary-task', 'business-switch', 'business-content']
      const hostRegions = new Set(evidence.hostSurfaceRegions || [])
      if (requiredHostRegions.some((region) => !hostRegions.has(region))) fail('WILD_DESIGN_HOST_SURFACE_INCOMPLETE', 'Each selectable preview must retain the real host navigation, primary task, business switch and business content instead of showing only a branded Hero or concept module.', { option: item.id, hostSurfaceRegions: [...hostRegions] })
      if (!Array.isArray(evidence.sourceVisualSignals) || evidence.sourceVisualSignals.length < 2) fail('WILD_DESIGN_VISIBLE_SOURCE_SIGNALS_REQUIRED', 'v2 previews require at least two visible source-brand signals.', { option: item.id })
      for (const signal of evidence.sourceVisualSignals || []) {
        if (!signal.evidenceRef || !signal.patternRef || !signal.visibleApplication) fail('WILD_DESIGN_SOURCE_SIGNAL_INCOMPLETE', 'Each source signal must bind evidence, an approved pattern, and its visible host application.', { option: item.id })
      }
      if (!Array.isArray(evidence.designSystemMappings?.tokens) || !evidence.designSystemMappings.tokens.length || !Array.isArray(evidence.designSystemMappings?.components) || !evidence.designSystemMappings.components.length) fail('WILD_DESIGN_PREVIEW_MAPPING_REQUIRED', 'v2 previews must show concrete token and component mappings before implementation.', { option: item.id })
    }
  }
}
if (strictVisualPreview && new Set(items.map((item) => JSON.stringify(item.directionContract?.layout || []))).size !== items.length) fail('WILD_DESIGN_COMPOSITIONS_NOT_DISTINCT', 'v2 options must use distinct composition skeletons; same-template reskins are invalid.')
if (strictVisualPreview && new Set(items.map((item) => item.firstViewportVisualProof?.visualNarrative || '')).size !== items.length) fail('WILD_DESIGN_VISUAL_NARRATIVES_NOT_DISTINCT', 'v2 options must use distinct asset-led visual narratives, not only different layouts.')
if (strictVisualPreview) {
  const compositionKeys = ['visualCenter', 'primaryActionPlacement', 'contentEntry', 'resultPresentation']
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i].firstViewportVisualProof?.compositionSignature || {}
      const b = items[j].firstViewportVisualProof?.compositionSignature || {}
      const differing = compositionKeys.filter((key) => a[key] !== b[key])
      if (differing.length < 3) fail('WILD_DESIGN_COMPOSITION_SIGNATURES_TOO_SIMILAR', 'Every pair of v2 options must differ in at least three first-viewport composition landmarks.', { options: [items[i].id, items[j].id], differingLandmarks: differing })
    }
  }
}
if (strictVisualPreview && historyFile) {
  const history = read(historyFile, 'WILD_DESIGN_HISTORY_UNREADABLE')
  const previous = Array.isArray(history?.options) ? history.options : []
  const compositionKeys = ['visualCenter', 'primaryActionPlacement', 'contentEntry', 'resultPresentation']
  for (const item of items) {
    const current = optionSignature(item)
    for (const old of previous) {
      const historic = old.signature || old
      const sameLandmarks = compositionKeys.filter((key) => current.compositionSignature?.[key] === historic.compositionSignature?.[key]).length
      const sameNarrative = current.visualNarrative === historic.visualNarrative
      const sameAssetMaterial = current.assetStrategy === historic.assetStrategy && current.materialLanguage === historic.materialLanguage
      if (sameNarrative || (sameLandmarks >= 3 && sameAssetMaterial)) fail('WILD_DESIGN_HISTORICAL_DUPLICATE', 'This option repeats a previously presented direction; regenerate a materially different candidate.', { option: item.id, previousOption: old.id || null, sameLandmarks })
    }
  }
}
if (new Set(items.map((item) => hashValue(item.styleDirectionContract))).size !== items.length) fail('WILD_DESIGN_STYLE_OPTIONS_NOT_DISTINCT', 'Every option must have a distinct style contract; layout-only variants are invalid.')
for (let i = 0; i < items.length; i += 1) {
  for (let j = i + 1; j < items.length; j += 1) {
    const differing = visualDimensions.filter((key) => items[i].visualChoiceContract?.[key] !== items[j].visualChoiceContract?.[key])
    if (differing.length < 3) fail('WILD_DESIGN_VISUAL_OPTIONS_NOT_DISTINCT', 'Every pair of options must visibly differ in at least three visual dimensions; layout-only choices are invalid.', { options: [items[i].id, items[j].id], differingDimensions: differing })
  }
}
if (recommendations !== 1) fail('WILD_DESIGN_RECOMMENDATION_INVALID', 'Exactly one option must be recommended.')
if (new Set(items.map((x) => x.sameBusinessScopeHash)).size > 1) fail('WILD_DESIGN_SCOPE_MISMATCH', 'All options must use the same business scope.')
if (!businessScopeFile) fail('WILD_DESIGN_BUSINESS_SCOPE_REQUIRED', '--business-scope is required.')
else if (!fs.existsSync(businessScopeFile) || items.some((item) => item.sameBusinessScopeHash !== sha(businessScopeFile))) fail('WILD_DESIGN_BUSINESS_SCOPE_BINDING_MISMATCH', 'Every option must bind the exact business scope SHA-256.')
if (optionsOnly) {
  console.log(JSON.stringify({ ok: !failures.length, phase: 'options-only', optionCount: items.length, failures }, null, 2))
  process.exit(failures.length ? 1 : 0)
}
if (decision?.schema !== 'wild-design-decision/v1') fail('WILD_DESIGN_DECISION_SCHEMA_INVALID', 'Expected wild-design-decision/v1.')
if (options && decision?.optionsSha256 !== sha(optionsFile)) fail('WILD_DESIGN_OPTIONS_BINDING_MISMATCH', 'Decision must bind the exact options SHA-256.')
const status = decision?.status
if (status === 'awaiting-user') fail('WILD_DESIGN_USER_DECISION_REQUIRED', 'Implementation is blocked until the user chooses or explicitly delegates the recommendation.')
else if (status === 'none-fit') fail('WILD_DESIGN_REWORK_REQUIRED', 'Regenerate directions after all options are rejected.')
else if (!['selected', 'mixed'].includes(status)) fail('WILD_DESIGN_STATUS_INVALID', 'Invalid decision status.')
const selected = Array.isArray(decision?.selectedOptionIds) ? decision.selectedOptionIds : []
if (status === 'selected' && selected.length !== 1) fail('WILD_DESIGN_SELECTION_INVALID', 'selected requires one option.')
if (status === 'mixed' && (selected.length < 2 || !decision?.mixInstructions?.trim())) fail('WILD_DESIGN_MIX_INVALID', 'mixed requires two options and mixInstructions.')
for (const id of selected) if (!ids.has(id)) fail('WILD_DESIGN_UNKNOWN_OPTION', 'Unknown selected option.', { option: id })
if (['selected', 'mixed'].includes(status) && !['explicit-user', 'user-skipped-use-recommended'].includes(decision?.selectionSource)) fail('WILD_DESIGN_SELECTION_SOURCE_INVALID', 'Selection must be user-authored or an explicit skip to the recommendation.')
const recommendedId = items.find((item) => item.recommended)?.id
if (decision?.selectionSource === 'user-skipped-use-recommended' && (status !== 'selected' || selected[0] !== recommendedId)) fail('WILD_DESIGN_RECOMMENDED_SELECTION_REQUIRED', 'Skip-to-recommended must select the recommended option.')
const fullSelectedContract = status === 'mixed'
  ? { options: selected.map((id) => byId.get(id)?.directionContract), mixInstructions: decision?.mixInstructions }
  : byId.get(selected[0])?.directionContract
const freezeScope = Array.isArray(decision?.freezeScope) ? decision.freezeScope : []
const selectedContract = freezeScope.length
  ? {
      freezeScope,
      options: selected.map((id) => ({
        id,
        ...(freezeScope.includes('businessCapabilities') ? { businessCapabilities: byId.get(id)?.directionContract?.businessCapabilities } : {}),
        ...(freezeScope.includes('layout') ? { layout: byId.get(id)?.directionContract?.layout } : {})
      })),
      mixInstructions: decision?.mixInstructions
    }
  : fullSelectedContract
const selectedContractSha256 = selectedContract ? hashValue(selectedContract) : ''
const fullSelectedVisualChoice = status === 'mixed'
  ? { options: selected.map((id) => byId.get(id)?.visualChoiceContract), mixInstructions: decision?.mixInstructions }
  : byId.get(selected[0])?.visualChoiceContract
const selectedVisualChoice = freezeScope.length
  ? { freezeScope, openScope: decision?.openScope || [], note: 'Visual assets and motion remain exploratory unless explicitly frozen.' }
  : fullSelectedVisualChoice
const selectedVisualChoiceSha256 = selectedVisualChoice ? hashValue(selectedVisualChoice) : ''
if (['selected', 'mixed'].includes(status) && !directionFile) fail('DESIGN_DIRECTION_REQUIRED', 'A selected Wild Design decision requires --design-direction before implementation.')
if (directionFile && ['selected', 'mixed'].includes(status)) {
  const direction = read(directionFile, 'DESIGN_DIRECTION_UNREADABLE')
  if (direction?.wildDesignDecision?.sha256 !== sha(decisionFile)) fail('DESIGN_DIRECTION_WILD_DECISION_MISMATCH', 'Design direction must bind the decision SHA-256.')
  if (JSON.stringify(direction?.wildDesignDecision?.selectedOptionIds || []) !== JSON.stringify(selected)) fail('DESIGN_DIRECTION_WILD_SELECTION_MISMATCH', 'Design direction must inherit selected options unchanged.')
  if (direction?.wildDesignDecision?.selectedContractSha256 !== selectedContractSha256) fail('DESIGN_DIRECTION_WILD_CONTRACT_MISMATCH', 'Design direction must bind the selected executable direction contract.')
  if (direction?.wildDesignDecision?.selectedVisualChoiceSha256 !== selectedVisualChoiceSha256) fail('DESIGN_DIRECTION_VISUAL_CHOICE_MISMATCH', 'Design direction must freeze the selected visual-choice invariants unchanged.')
}
console.log(JSON.stringify({ ok: !failures.length, optionCount: items.length, status, selectedOptionIds: selected, selectedContractSha256, selectedVisualChoiceSha256, failures }, null, 2))
process.exit(failures.length ? 1 : 0)

function readPreviewBundle(file) {
  const html = fs.readFileSync(file, 'utf8')
  let css = ''
  for (const match of html.matchAll(/<link\b[^>]*href=["']([^"']+\.css(?:\?[^"']*)?)["'][^>]*>/gi)) {
    const cssFile = path.resolve(path.dirname(file), match[1].split('?')[0])
    if (fs.existsSync(cssFile)) css += `\n${fs.readFileSync(cssFile, 'utf8')}`
  }
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) css += `\n${match[1]}`
  return { html, css }
}
