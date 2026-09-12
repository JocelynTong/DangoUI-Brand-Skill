#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

const args = process.argv.slice(2)
const value = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : '' }
if (!value('--options') || !value('--decision')) {
  console.error('Usage: validate-wild-design-decision.mjs --options <options.json> --decision <decision.json> --business-scope <scope.json> [--design-direction <direction.json>]')
  process.exit(2)
}
const optionsFile = path.resolve(value('--options'))
const decisionFile = path.resolve(value('--decision'))
const directionFile = value('--design-direction') ? path.resolve(value('--design-direction')) : ''
const businessScopeFile = value('--business-scope') ? path.resolve(value('--business-scope')) : ''
const brandEvidenceFile = value('--brand-evidence') ? path.resolve(value('--brand-evidence')) : ''
const failures = []
const fail = (code, message, context = {}) => failures.push({ code, message, ...context })
const read = (file, code) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch (e) { fail(code, e.message, { file }); return null } }
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const hashValue = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const options = read(optionsFile, 'WILD_DESIGN_OPTIONS_UNREADABLE')
const decision = read(decisionFile, 'WILD_DESIGN_DECISION_UNREADABLE')
const items = Array.isArray(options?.options) ? options.options : []
const visualDimensions = ['dominantColorRole', 'typographyCharacter', 'assetStrategy', 'materialLanguage', 'motionCharacter', 'imagePolicy']
if (!options?.sourceBrand || !options?.frozenBrandEvidenceSha256) fail('WILD_DESIGN_BRAND_BINDING_REQUIRED', 'Options must name the user-input brand and bind its exact brand-evidence SHA-256.')
if (!brandEvidenceFile) fail('WILD_DESIGN_BRAND_EVIDENCE_REQUIRED', '--brand-evidence is required.')
else if (!fs.existsSync(brandEvidenceFile) || options?.frozenBrandEvidenceSha256 !== sha(brandEvidenceFile)) fail('WILD_DESIGN_BRAND_EVIDENCE_MISMATCH', 'Options must bind the exact supplied brand evidence.')
if (!Array.isArray(options?.sharedLayoutContract) || !options.sharedLayoutContract.length) fail('WILD_DESIGN_SHARED_LAYOUT_REQUIRED', 'Freeze the shared business layout so layout changes cannot masquerade as style choices.')

if (options?.schema !== 'wild-design-options/v1') fail('WILD_DESIGN_OPTIONS_SCHEMA_INVALID', 'Expected wild-design-options/v1.')
if (options?.workflow !== 'apply-host') fail('WILD_DESIGN_WORKFLOW_INVALID', 'MVP supports apply-host only.')
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
  if (JSON.stringify(item.directionContract?.layout || []) !== JSON.stringify(options?.sharedLayoutContract || [])) fail('WILD_DESIGN_LAYOUT_DRIFT', 'All style options must preserve the same frozen business layout.', { option: item.id })
  if (!Array.isArray(item.brandEvidenceRefs) || !item.brandEvidenceRefs.length) fail('WILD_DESIGN_BRAND_EVIDENCE_REFS_REQUIRED', 'Every option must cite approved evidence from the user-input brand.', { option: item.id })
  const consumption = item.designSystemConsumption
  if (!consumption || !['runtime', 'simulated-preview'].includes(consumption.mode)) fail('WILD_DESIGN_SYSTEM_CONSUMPTION_MODE_REQUIRED', 'Every option must declare whether the preview consumes the real design-system runtime or is an explicitly simulated preview.', { option: item.id })
  for (const track of ['tokens', 'components', 'assets', 'composition']) {
    const entry = consumption?.[track]
    if (!entry || !['consumed', 'simulated', 'not-applicable'].includes(entry.status) || !Array.isArray(entry.refs) || !entry.refs.length) fail('WILD_DESIGN_SYSTEM_TRACK_INCOMPLETE', `designSystemConsumption.${track} requires status and concrete refs.`, { option: item.id, track })
    if (consumption?.mode === 'runtime' && entry?.status === 'simulated') fail('WILD_DESIGN_RUNTIME_CLAIM_MISMATCH', 'A runtime preview may not describe a design-system track as simulated.', { option: item.id, track })
  }
  for (const key of ['tokens', 'typography', 'components', 'materials', 'motion']) if (!item.styleDirectionContract?.[key]) fail('WILD_DESIGN_STYLE_DIMENSION_MISSING', `styleDirectionContract.${key} is required.`, { option: item.id })
  for (const key of visualDimensions) if (!item.visualChoiceContract?.[key]) fail('WILD_DESIGN_VISUAL_CHOICE_DIMENSION_MISSING', `visualChoiceContract.${key} is required so the user is choosing a visible style, not a layout variant.`, { option: item.id })
  if (!Array.isArray(item.visualChoiceContract?.forbiddenFallbacks) || !item.visualChoiceContract.forbiddenFallbacks.length) fail('WILD_DESIGN_FORBIDDEN_FALLBACKS_REQUIRED', 'Each option must freeze visible characteristics that later roles may not dilute.', { option: item.id })
  for (const evidence of item.previewEvidence || []) {
    const [relative, fragment] = String(evidence.path || '').split('#')
    const previewFile = path.resolve(path.dirname(optionsFile), relative)
    if (!relative || !fs.existsSync(previewFile)) fail('WILD_DESIGN_PREVIEW_MISSING', 'Preview evidence file does not exist.', { option: item.id, path: evidence.path })
    else if (fragment && !fs.readFileSync(previewFile, 'utf8').includes(`id="${fragment}"`)) fail('WILD_DESIGN_PREVIEW_FRAGMENT_MISSING', 'Preview fragment does not exist.', { option: item.id, fragment })
    else if (!evidence.sha256 || evidence.sha256 !== sha(previewFile)) fail('WILD_DESIGN_PREVIEW_BINDING_MISMATCH', 'Preview evidence must bind the exact preview file SHA-256.', { option: item.id, path: evidence.path })
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
const selectedContract = status === 'mixed'
  ? { options: selected.map((id) => byId.get(id)?.directionContract), mixInstructions: decision?.mixInstructions }
  : byId.get(selected[0])?.directionContract
const selectedContractSha256 = selectedContract ? hashValue(selectedContract) : ''
const selectedVisualChoice = status === 'mixed'
  ? { options: selected.map((id) => byId.get(id)?.visualChoiceContract), mixInstructions: decision?.mixInstructions }
  : byId.get(selected[0])?.visualChoiceContract
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
