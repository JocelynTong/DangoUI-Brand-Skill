#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wild-design-'))
const validator = path.resolve('skills/brand/scripts/validate-wild-design-decision.mjs')
const scopeFile = path.join(dir, 'business-scope.json')
fs.writeFileSync(scopeFile, JSON.stringify({ route: '/plaza', controls: ['search', 'filters'] }))
const scopeHash = createHash('sha256').update(fs.readFileSync(scopeFile)).digest('hex')
const brandEvidenceFile = path.join(dir, 'brand-evidence.json')
fs.writeFileSync(brandEvidenceFile, JSON.stringify({ brand: 'fixture-brand', evidence: ['campaign', 'catalog', 'evidence:campaign', 'evidence:catalog', 'token:surface', 'token:action', 'token:text', 'asset:catalog', 'asset:immersive', 'pattern:layered-stage'] }))
const brandEvidenceHash = createHash('sha256').update(fs.readFileSync(brandEvidenceFile)).digest('hex')
const brandModFile = path.join(dir, 'brand-mod.json')
fs.writeFileSync(brandModFile, JSON.stringify({ schema: 'fixture/v1', tokens: ['token:surface', 'token:action', 'token:text'], assets: ['asset:catalog', 'asset:immersive'], layoutRules: ['pattern:layered-stage'] }))
const brandModHash = createHash('sha256').update(fs.readFileSync(brandModFile)).digest('hex')
const option = (id, recommended = false) => {
  const preview = path.join(dir, `${id}.svg`)
  fs.writeFileSync(preview, `<svg><g id="${id}"/></svg>`)
  const previewHash = createHash('sha256').update(fs.readFileSync(preview)).digest('hex')
  return { id, name: id, recommended, sameBusinessScopeHash: scopeHash, brandEvidenceRefs: [id], previewEvidence: [{ path: `${id}.svg#${id}`, viewport: '390x844', sha256: previewHash }], designSystemConsumption: { mode: 'simulated-preview', tokens: { status: 'simulated', refs: [`token:${id}`] }, components: { status: 'simulated', refs: [`component:${id}`] }, assets: { status: 'simulated', refs: [`asset:${id}`] }, composition: { status: 'simulated', refs: [`pattern:${id}`] } }, differences: { informationDensity: 'medium', visualAssets: id, pageStructure: 'shared', motionIntensity: 'low' }, styleDirectionContract: { tokens: id, typography: id, components: id, materials: id, motion: id }, visualChoiceContract: { dominantColorRole: `${id}-field`, typographyCharacter: `${id}-type`, assetStrategy: `${id}-asset`, materialLanguage: `${id}-material`, motionCharacter: 'restrained', imagePolicy: 'complete-content', forbiddenFallbacks: ['do not reduce the dominant visual field to an accent'] }, directionContract: { layout: ['hero', 'search', 'list'], style: id } }
}
const optionsFile = path.join(dir, 'options.json')
fs.writeFileSync(optionsFile, JSON.stringify({ schema: 'wild-design-options/v1', workflow: 'apply-host', sourceBrand: 'fixture-brand', frozenBrandEvidenceSha256: brandEvidenceHash, sharedLayoutContract: ['hero', 'search', 'list'], options: [option('catalog', true), option('immersive')] }))
const optionsSha256 = createHash('sha256').update(fs.readFileSync(optionsFile)).digest('hex')
const run = (decision, bind = false) => {
  const decisionFile = path.join(dir, `decision-${Math.random()}.json`)
  fs.writeFileSync(decisionFile, JSON.stringify(decision))
  const call = [validator, '--options', optionsFile, '--decision', decisionFile, '--business-scope', scopeFile, '--brand-evidence', brandEvidenceFile, '--brand-mod', brandModFile]
  if (bind) {
    const directionFile = path.join(dir, `direction-${Math.random()}.json`)
    const selectedItems = JSON.parse(fs.readFileSync(optionsFile)).options.filter((item) => decision.selectedOptionIds.includes(item.id))
    const contract = decision.status === 'mixed' ? { options: selectedItems.map((item) => item.directionContract), mixInstructions: decision.mixInstructions } : selectedItems[0].directionContract
    const visual = decision.status === 'mixed' ? { options: selectedItems.map((item) => item.visualChoiceContract), mixInstructions: decision.mixInstructions } : selectedItems[0].visualChoiceContract
    fs.writeFileSync(directionFile, JSON.stringify({ wildDesignDecision: { sha256: createHash('sha256').update(fs.readFileSync(decisionFile)).digest('hex'), selectedOptionIds: decision.selectedOptionIds, selectedContractSha256: createHash('sha256').update(JSON.stringify(contract)).digest('hex'), selectedVisualChoiceSha256: createHash('sha256').update(JSON.stringify(visual)).digest('hex') } }))
    call.push('--design-direction', directionFile)
  }
  return spawnSync(process.execPath, call, { encoding: 'utf8' })
}
const selected = { schema: 'wild-design-decision/v1', optionsSha256, status: 'selected', selectedOptionIds: ['catalog'], selectionSource: 'explicit-user' }
assert.equal(run(selected, true).status, 0)
assert.notEqual(run(selected, false).status, 0)
assert.notEqual(run({ ...selected, status: 'awaiting-user', selectedOptionIds: [] }).status, 0)
assert.notEqual(run({ ...selected, status: 'none-fit', selectedOptionIds: [] }).status, 0)
assert.notEqual(run({ ...selected, optionsSha256: 'b'.repeat(64) }).status, 0)
assert.notEqual(run({ ...selected, status: 'mixed', selectedOptionIds: ['catalog', 'immersive'] }).status, 0)
assert.equal(run({ ...selected, status: 'mixed', selectedOptionIds: ['catalog', 'immersive'], mixInstructions: 'Catalog density with immersive hero.' }, true).status, 0)
const layoutOnly = JSON.parse(fs.readFileSync(optionsFile))
layoutOnly.options[1].visualChoiceContract = { ...layoutOnly.options[0].visualChoiceContract, forbiddenFallbacks: ['same visual, different layout'] }
fs.writeFileSync(optionsFile, JSON.stringify(layoutOnly))
assert.notEqual(run({ ...selected, optionsSha256: createHash('sha256').update(fs.readFileSync(optionsFile)).digest('hex') }, true).status, 0)
fs.writeFileSync(optionsFile, JSON.stringify({ ...layoutOnly, options: [option('catalog', true), option('immersive')] }))
const optionsWithoutConsumption = JSON.parse(fs.readFileSync(optionsFile))
delete optionsWithoutConsumption.options[0].designSystemConsumption
fs.writeFileSync(optionsFile, JSON.stringify(optionsWithoutConsumption))
assert.notEqual(run({ ...selected, optionsSha256: createHash('sha256').update(fs.readFileSync(optionsFile)).digest('hex') }, true).status, 0)
fs.writeFileSync(optionsFile, JSON.stringify({ ...optionsWithoutConsumption, options: [option('catalog', true), option('immersive')] }))
fs.writeFileSync(path.join(dir, 'catalog.svg'), '<svg><g id="catalog"/><text>changed</text></svg>')
assert.notEqual(run(selected, true).status, 0)

const strictOptions = { ...JSON.parse(fs.readFileSync(optionsFile)), schema: 'wild-design-options/v2', frozenBrandModSha256: brandModHash, options: [option('catalog', true), option('immersive')] }
const hostSourceFile = path.join(dir, 'host-page.vue')
fs.writeFileSync(hostSourceFile, '<template><view>{{ decks }}</view></template>')
const hostSourceHash = createHash('sha256').update(fs.readFileSync(hostSourceFile)).digest('hex')
fs.writeFileSync(optionsFile, JSON.stringify(strictOptions))
let strictResult = run({ ...selected, optionsSha256: createHash('sha256').update(fs.readFileSync(optionsFile)).digest('hex') }, true)
assert.notEqual(strictResult.status, 0)
assert.match(strictResult.stdout, /WILD_DESIGN_RENDERED_HOST_PREVIEW_REQUIRED/)
for (const item of strictOptions.options) {
  item.previewEvidence[0] = {
    ...item.previewEvidence[0],
    kind: 'rendered-host-grounded-preview',
    hostRoute: '/pages/plaza/index',
    previewOrigin: 'host-baseline-derived',
    presentationMode: 'host-surface-only',
    proposalChromeAbsent: true,
    hostSurfaceRegions: ['navigation', 'primary-task', 'business-switch', 'business-content'],
    sourceVisualSignals: [
      { evidenceRef: 'evidence:campaign', patternRef: 'pattern:layered-stage', visibleApplication: 'hero background' },
      { evidenceRef: 'evidence:catalog', patternRef: 'pattern:search-organism', visibleApplication: 'search surface' }
    ],
    designSystemMappings: { tokens: ['color.surface.brand'], components: ['Button', 'Card'] }
  }
  item.directionContract.businessCapabilities = strictOptions.sharedLayoutContract
  item.directionContract.layout = [`${item.id}-hero`, `${item.id}-content`, `${item.id}-results`]
  item.firstViewportVisualProof = {
    visualNarrative: `${item.id} source-backed campaign scene`,
    visibleDimensions: ['asset', 'composition', 'material'],
    atmosphereLayers: ['environment', 'lighting', 'depth'],
    compositionSignature: item.id === 'catalog'
      ? { visualCenter: 'full-bleed-scene', primaryActionPlacement: 'bottom-overlay', contentEntry: 'bottom-sheet', resultPresentation: 'vertical-cards' }
      : { visualCenter: 'asymmetric-card-stage', primaryActionPlacement: 'side-control', contentEntry: 'horizontal-rail', resultPresentation: 'mosaic-grid' },
    dominantMedia: [{ assetRef: `asset:${item.id}`, evidenceRef: 'evidence:campaign', renderedSelector: `#${item.id}`, role: 'hero-scene', sourceKind: 'official-independent-asset', firstViewportAreaRatio: 0.42 }]
  }
  item.brandSystemClosure = {
    tokenApplications: [
      { tokenRef: 'token:surface', evidenceRef: 'evidence:campaign', renderedSelector: `#${item.id}`, cssProperty: 'background-color', renderedValue: '#102040' },
      { tokenRef: 'token:action', evidenceRef: 'evidence:campaign', renderedSelector: `#${item.id} button`, cssProperty: 'background-color', renderedValue: '#ffcc00' },
      { tokenRef: 'token:text', evidenceRef: 'evidence:catalog', renderedSelector: `#${item.id} h1`, cssProperty: 'color', renderedValue: '#ffffff' }
    ],
    assetApplications: [{ assetRef: `asset:${item.id}`, evidenceRef: 'evidence:campaign', sourceSha256: 'a'.repeat(64), sourceKind: 'official-independent-asset', renderedSelector: `#${item.id} .hero`, role: 'campaign-scene', firstViewportAreaRatio: 0.42 }],
    compositionApplications: [{ patternRef: 'pattern:layered-stage', evidenceRef: 'evidence:campaign', renderedRegion: `#${item.id} .hero`, assetRefs: [`asset:${item.id}`] }],
    coPresence: { previewEvidencePath: `${item.id}.svg#${item.id}`, tokenRefs: ['token:surface', 'token:action', 'token:text'], assetRefs: [`asset:${item.id}`], patternRefs: ['pattern:layered-stage'] }
  }
  item.responsiveProof = { targetFormFactor: 'mobile', pageType: 'browse-list', viewportWidth: 390, persistentSideRail: false, primaryContentWidthRatio: 0.9, touchTargetMinPx: 44, horizontalOverflow: false, heroHeightRatio: 0.33, firstBusinessContentTopRatio: 0.4, contentContainerFlow: 'document-flow', hostFirstImpression: { taskPriority: 'efficiency-first', informationDensity: 'high', contentFlow: 'continuous-flow', returnFrequency: 'frequent', firstActionUrgency: 'immediate', existingMediaSlots: ['existing-header'], evidence: 'default route screenshot and DOM show search followed by a continuous deck list' }, heroDecision: { mode: 'compact', rationale: 'Frequent search-led tool home keeps the immersive scene compact and reveals the deck flow early.' } }
  item.designSystemConsumption.mappingPolicy = { visualTarget: 'preserve-selected-option', componentRole: 'behavior-and-api', styleOnlyFallback: true, defaultAppearanceAllowed: false }
  item.designSystemConsumption.mode = 'host-grounded-preview'
  item.designSystemConsumption.hostBinding = { previewOrigin: 'host-baseline-derived', targetRoute: '/pages/plaza/index', businessDataSource: 'captured-host-state', baselineArtifacts: [{ path: 'host-page.vue', sha256: hostSourceHash }] }
  item.designSystemConsumption.generationIsolation = { hostFilesModified: false, hostSourceBeforeSha256: hostSourceHash, hostSourceAfterSha256: hostSourceHash }
  for (const track of ['tokens', 'components', 'assets', 'composition']) item.designSystemConsumption[track].status = 'consumed'
}
fs.writeFileSync(optionsFile, JSON.stringify(strictOptions))
strictResult = run({ ...selected, optionsSha256: createHash('sha256').update(fs.readFileSync(optionsFile)).digest('hex') }, true)
assert.equal(strictResult.status, 0)
const missingClosure = structuredClone(strictOptions)
delete missingClosure.options[0].brandSystemClosure
fs.writeFileSync(optionsFile, JSON.stringify(missingClosure))
const missingClosureResult = spawnSync(process.execPath, [validator, '--options', optionsFile, '--options-only', '--business-scope', scopeFile, '--brand-evidence', brandEvidenceFile], { encoding: 'utf8' })
assert.notEqual(missingClosureResult.status, 0)
assert.match(missingClosureResult.stdout, /WILD_DESIGN_TOKEN_APPLICATIONS_INSUFFICIENT/)
assert.match(missingClosureResult.stdout, /WILD_DESIGN_SOURCE_BRAND_ASSET_REQUIRED/)
assert.match(missingClosureResult.stdout, /WILD_DESIGN_COMPOSITION_APPLICATION_REQUIRED/)
const hostAssetIdentity = structuredClone(strictOptions)
hostAssetIdentity.options[0].brandSystemClosure.assetApplications[0].sourceKind = 'host-owned-business-art'
fs.writeFileSync(optionsFile, JSON.stringify(hostAssetIdentity))
const hostAssetResult = spawnSync(process.execPath, [validator, '--options', optionsFile, '--options-only', '--business-scope', scopeFile, '--brand-evidence', brandEvidenceFile], { encoding: 'utf8' })
assert.notEqual(hostAssetResult.status, 0)
assert.match(hostAssetResult.stdout, /WILD_DESIGN_HOST_ASSET_AS_BRAND_IDENTITY/)
fs.writeFileSync(optionsFile, JSON.stringify(strictOptions))
const detachedPreview = structuredClone(strictOptions)
detachedPreview.options[0].designSystemConsumption.mode = 'simulated-preview'
delete detachedPreview.options[0].designSystemConsumption.hostBinding
detachedPreview.options[0].previewEvidence[0].previewOrigin = 'detached-design-document'
fs.writeFileSync(optionsFile, JSON.stringify(detachedPreview))
const detachedResult = spawnSync(process.execPath, [validator, '--options', optionsFile, '--options-only', '--business-scope', scopeFile, '--brand-evidence', brandEvidenceFile], { encoding: 'utf8' })
assert.notEqual(detachedResult.status, 0)
assert.match(detachedResult.stdout, /WILD_DESIGN_PRESELECTION_IMPLEMENTATION_FORBIDDEN/)
assert.match(detachedResult.stdout, /WILD_DESIGN_PREVIEW_EVIDENCE_NOT_HOST_GROUNDED/)
const falseRuntime = structuredClone(strictOptions)
falseRuntime.options[0].designSystemConsumption.mode = 'runtime'
for (const track of ['tokens', 'components', 'assets', 'composition']) falseRuntime.options[0].designSystemConsumption[track].status = 'consumed'
falseRuntime.options[0].designSystemConsumption.runtimeProof = { package: 'dangoui', entryPath: 'fake-runtime.js', components: ['DuButton'], tokens: ['--du-primary-solid-bg'] }
fs.writeFileSync(path.join(dir, 'fake-runtime.js'), 'export const preview = "plain html"')
fs.writeFileSync(optionsFile, JSON.stringify(falseRuntime))
let runtimeResult = spawnSync(process.execPath, [validator, '--options', optionsFile, '--options-only', '--business-scope', scopeFile, '--brand-evidence', brandEvidenceFile], { encoding: 'utf8' })
assert.notEqual(runtimeResult.status, 0)
assert.match(runtimeResult.stdout, /WILD_DESIGN_PRESELECTION_IMPLEMENTATION_FORBIDDEN/)
fs.writeFileSync(path.join(dir, 'fake-runtime.js'), 'import { DuButton } from "dangoui"; const token = "--du-primary-solid-bg"; export { DuButton, token }')
runtimeResult = spawnSync(process.execPath, [validator, '--options', optionsFile, '--options-only', '--business-scope', scopeFile, '--brand-evidence', brandEvidenceFile], { encoding: 'utf8' })
assert.notEqual(runtimeResult.status, 0)
assert.match(runtimeResult.stdout, /WILD_DESIGN_PRESELECTION_IMPLEMENTATION_FORBIDDEN/)
const historyFile = path.join(dir, 'history.json')
fs.writeFileSync(historyFile, JSON.stringify({ schema: 'wild-design-history/v1', options: [{ id: 'old-catalog', signature: { visualNarrative: strictOptions.options[0].firstViewportVisualProof.visualNarrative, compositionSignature: strictOptions.options[0].firstViewportVisualProof.compositionSignature, assetStrategy: strictOptions.options[0].visualChoiceContract.assetStrategy, materialLanguage: strictOptions.options[0].visualChoiceContract.materialLanguage } }] }))
const repeatedResult = spawnSync(process.execPath, [validator, '--options', optionsFile, '--options-only', '--business-scope', scopeFile, '--brand-evidence', brandEvidenceFile, '--history', historyFile], { encoding: 'utf8' })
assert.notEqual(repeatedResult.status, 0)
assert.match(repeatedResult.stdout, /WILD_DESIGN_HISTORICAL_DUPLICATE/)
fs.writeFileSync(optionsFile, JSON.stringify(strictOptions))
const optionsOnly = spawnSync(process.execPath, [validator, '--options', optionsFile, '--options-only', '--business-scope', scopeFile, '--brand-evidence', brandEvidenceFile, '--brand-mod', brandModFile], { encoding: 'utf8' })
assert.equal(optionsOnly.status, 0)
const railHtml = path.join(dir, 'mobile-rail.html')
fs.writeFileSync(path.join(dir, 'mobile-rail.css'), '.desk-rail{position:absolute;left:0;top:0;bottom:0;width:62px}')
fs.writeFileSync(railHtml, '<link rel="stylesheet" href="mobile-rail.css"><aside class="desk-rail"></aside>')
const renderedRail = structuredClone(strictOptions)
renderedRail.options[0].previewEvidence[0] = { ...renderedRail.options[0].previewEvidence[0], path: 'mobile-rail.html', sha256: createHash('sha256').update(fs.readFileSync(railHtml)).digest('hex') }
fs.writeFileSync(optionsFile, JSON.stringify(renderedRail))
const renderedRailResult = spawnSync(process.execPath, [validator, '--options', optionsFile, '--options-only', '--business-scope', scopeFile, '--brand-evidence', brandEvidenceFile], { encoding: 'utf8' })
assert.notEqual(renderedRailResult.status, 0)
assert.match(renderedRailResult.stdout, /WILD_DESIGN_RENDERED_MOBILE_SIDEBAR_DETECTED/)
const desktopSqueezed = structuredClone(strictOptions)
desktopSqueezed.options[0].responsiveProof = { ...desktopSqueezed.options[0].responsiveProof, persistentSideRail: true, primaryContentWidthRatio: 0.58 }
fs.writeFileSync(optionsFile, JSON.stringify(desktopSqueezed))
const squeezedResult = spawnSync(process.execPath, [validator, '--options', optionsFile, '--options-only', '--business-scope', scopeFile, '--brand-evidence', brandEvidenceFile], { encoding: 'utf8' })
assert.notEqual(squeezedResult.status, 0)
assert.match(squeezedResult.stdout, /WILD_DESIGN_MOBILE_PERSISTENT_SIDEBAR_FORBIDDEN/)
const unclassifiedHost = structuredClone(strictOptions)
delete unclassifiedHost.options[0].responsiveProof.hostFirstImpression
delete unclassifiedHost.options[0].responsiveProof.heroDecision
fs.writeFileSync(optionsFile, JSON.stringify(unclassifiedHost))
const unclassifiedResult = spawnSync(process.execPath, [validator, '--options', optionsFile, '--options-only', '--business-scope', scopeFile, '--brand-evidence', brandEvidenceFile], { encoding: 'utf8' })
assert.notEqual(unclassifiedResult.status, 0)
assert.match(unclassifiedResult.stdout, /WILD_DESIGN_HOST_FIRST_IMPRESSION_REQUIRED/)
assert.match(unclassifiedResult.stdout, /WILD_DESIGN_HERO_DECISION_REQUIRED/)
const fixedCanvasHost = structuredClone(strictOptions)
fixedCanvasHost.options[0].responsiveProof.contentContainerFlow = 'fixed-canvas'
fs.writeFileSync(optionsFile, JSON.stringify(fixedCanvasHost))
const fixedCanvasResult = spawnSync(process.execPath, [validator, '--options', optionsFile, '--options-only', '--business-scope', scopeFile, '--brand-evidence', brandEvidenceFile], { encoding: 'utf8' })
assert.notEqual(fixedCanvasResult.status, 0)
assert.match(fixedCanvasResult.stdout, /WILD_DESIGN_CONTINUOUS_HOST_FIXED_CANVAS/)
const weakVisualOptions = structuredClone(strictOptions)
delete weakVisualOptions.options[0].firstViewportVisualProof
fs.writeFileSync(optionsFile, JSON.stringify(weakVisualOptions))
const weakOptionsOnly = spawnSync(process.execPath, [validator, '--options', optionsFile, '--options-only', '--business-scope', scopeFile, '--brand-evidence', brandEvidenceFile], { encoding: 'utf8' })
assert.notEqual(weakOptionsOnly.status, 0)
assert.match(weakOptionsOnly.stdout, /WILD_DESIGN_DOMINANT_MEDIA_REQUIRED/)
console.log('validate-wild-design-decision tests passed')
