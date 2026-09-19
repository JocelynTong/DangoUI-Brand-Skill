#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : '' }
const planFile = value('--plan') ? path.resolve(value('--plan')) : ''
if (!planFile) {
  console.error('Usage: validate-brand-application-plan.mjs --plan <brand-application-plan.json>')
  process.exit(2)
}

const failures = []
const fail = (code, message, context = {}) => failures.push({ code, message, ...context })
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
let plan
try { plan = JSON.parse(fs.readFileSync(planFile, 'utf8')) } catch (error) {
  console.log(JSON.stringify({ ok: false, failures: [{ code: 'BRAND_APPLICATION_PLAN_UNREADABLE', message: error.message }] }, null, 2))
  process.exit(1)
}

let brandMod = null
let approvedPatterns = null
const brandBinding = plan.brandSystemBinding
if (!brandBinding?.brandModPath || !brandBinding?.brandModSha256) {
  fail('BRAND_SYSTEM_BINDING_REQUIRED', 'Bind the exact frozen brand-mod.json used by the direction plan.')
} else {
  const brandModFile = path.resolve(path.dirname(planFile), brandBinding.brandModPath)
  if (!fs.existsSync(brandModFile)) fail('BRAND_MOD_MISSING', 'The bound brand-mod.json does not exist.', { path: brandBinding.brandModPath })
  else if (sha(brandModFile) !== brandBinding.brandModSha256) fail('BRAND_MOD_HASH_MISMATCH', 'The frozen brand-mod hash does not match.', { path: brandBinding.brandModPath })
  else {
    try { brandMod = JSON.parse(fs.readFileSync(brandModFile, 'utf8')) } catch (error) {
      fail('BRAND_MOD_UNREADABLE', 'The bound brand-mod.json cannot be parsed.', { message: error.message })
    }
    const patternsPath = brandBinding.patternsPath || brandMod?.verification?.patterns
    if (!patternsPath || !brandBinding.patternsSha256) fail('BRAND_PATTERN_BINDING_REQUIRED', 'Bind the approved visual-pattern package and its hash.')
    else {
      const patternsFile = path.resolve(path.dirname(brandModFile), patternsPath)
      if (!fs.existsSync(patternsFile)) fail('BRAND_PATTERN_PACKAGE_MISSING', 'The approved visual-pattern package does not exist.', { path: patternsPath })
      else if (sha(patternsFile) !== brandBinding.patternsSha256) fail('BRAND_PATTERN_HASH_MISMATCH', 'The approved visual-pattern package hash does not match.', { path: patternsPath })
      else {
        try { approvedPatterns = JSON.parse(fs.readFileSync(patternsFile, 'utf8')) } catch (error) {
          fail('BRAND_PATTERN_PACKAGE_UNREADABLE', 'The approved visual-pattern package cannot be parsed.', { message: error.message })
        }
      }
    }
  }
}

const semanticRoles = brandMod?.semanticRoles || {}
const componentVariants = new Map((brandMod?.componentVariants || []).map((entry) => [entry.id, entry]))
const patterns = new Map((approvedPatterns?.patterns || []).map((entry) => [entry.id, entry]))
const brandAssets = new Map((brandMod?.assets || []).map((entry) => [entry.id, entry]))
const normalizedColor = (input) => String(input || '').trim().toLowerCase()
const expandedHex = (input) => {
  const value = normalizedColor(input)
  if (/^#[0-9a-f]{3}$/.test(value)) return `#${[...value.slice(1)].map((char) => char + char).join('')}`
  return value
}

const allowedRoles = new Set(['identity-environment', 'task-bridge', 'featured-content', 'business-stream', 'navigation-shell'])
const identityRoles = new Set(['brand-identity', 'environment', 'campaign-scene', 'brand-texture'])
const allowedSceneStrategies = new Set(['single-source-scene', 'validated-composite', 'material-field', 'type-led-field', 'no-identity-environment'])
const options = Array.isArray(plan.options) ? plan.options : []
const selectableOptions = options.filter((option) => option.disposition !== 'rejected')

if (plan.schema !== 'brand-application-plan/v1') fail('BRAND_APPLICATION_PLAN_SCHEMA_INVALID', 'Expected brand-application-plan/v1.')
if (!plan.hostBinding?.targetRoute || !plan.hostBinding?.viewport || !plan.hostBinding?.baselinePath || !plan.hostBinding?.baselineSha256) {
  fail('BRAND_APPLICATION_HOST_BINDING_REQUIRED', 'Bind the target route, viewport and frozen host baseline.')
} else {
  const baseline = path.resolve(path.dirname(planFile), plan.hostBinding.baselinePath)
  if (!fs.existsSync(baseline)) fail('BRAND_APPLICATION_HOST_BASELINE_MISSING', 'Frozen host baseline does not exist.', { path: plan.hostBinding.baselinePath })
  else if (sha(baseline) !== plan.hostBinding.baselineSha256) fail('BRAND_APPLICATION_HOST_BASELINE_HASH_MISMATCH', 'Frozen host baseline hash does not match.', { path: plan.hostBinding.baselinePath })
}
if (!['efficiency-first', 'balanced', 'immersion-first'].includes(plan.hostClassification)) fail('BRAND_APPLICATION_HOST_CLASSIFICATION_REQUIRED', 'Classify the host before allocating visual capacity.')
if (selectableOptions.length < 2 || selectableOptions.length > 3) fail('BRAND_APPLICATION_OPTION_COUNT_INVALID', 'Provide two or three selectable static H5 directions.')

const signatures = new Set()
for (const option of options) {
  const optionId = option.id || '(missing)'
  if (option.disposition === 'rejected') {
    if (!option.rejectionReason || !Array.isArray(option.rejectionCodes) || !option.rejectionCodes.length || !option.incidentRef) fail('REJECTED_DIRECTION_AUDIT_INCOMPLETE', 'Rejected directions must retain reason, failure codes and incident reference.', { option: optionId })
    continue
  }
  const roles = Array.isArray(option.compositionRoles) ? option.compositionRoles : []
  const roleNames = roles.map((entry) => entry.role)
  if (!option.id || !option.visualNarrative) fail('BRAND_APPLICATION_OPTION_IDENTITY_REQUIRED', 'Every option needs id and visualNarrative.', { option: optionId })
  if (!roles.length || new Set(roleNames).size !== roleNames.length || roleNames.some((role) => !allowedRoles.has(role))) fail('BRAND_APPLICATION_ROLE_SET_INVALID', 'Composition roles must be unique reusable grammar roles.', { option: optionId, roles: roleNames })
  if (!roleNames.includes('business-stream')) fail('BRAND_APPLICATION_BUSINESS_STREAM_REQUIRED', 'A host direction must show how repeatable business work continues.', { option: optionId })
  for (const role of roles) {
    if (!role.hostJob || !Array.isArray(role.brandMechanisms) || !role.brandMechanisms.length || !Array.isArray(role.evidenceRefs) || !role.evidenceRefs.length) fail('ROLE_WITHOUT_HOST_JOB', 'Every selected role needs a host job and evidence-backed brand mechanism.', { option: optionId, role: role.role })
    if (!role.designSystemBinding || !['mapped', 'style-only', 'capability-gap'].includes(role.designSystemBinding.status)) fail('BRAND_APPLICATION_ROLE_MAPPING_REQUIRED', 'Every selected role needs a DangoUI mapping status.', { option: optionId, role: role.role })
    if (!Array.isArray(role.semanticColorRefs) || !role.semanticColorRefs.length) fail('SEMANTIC_COLOR_CLOSURE_REQUIRED', 'Every rendered role must reference its declared semantic color applications.', { option: optionId, role: role.role })
    const ratio = Number(role.viewportBudget?.firstViewportAreaRatio)
    if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) fail('BRAND_APPLICATION_VIEWPORT_BUDGET_INVALID', 'Every role needs a measured first-viewport area ratio.', { option: optionId, role: role.role })
  }


  const colorApplications = Array.isArray(option.semanticColorApplications) ? option.semanticColorApplications : []
  const colorIds = new Set(colorApplications.map((entry) => entry.id).filter(Boolean))
  for (const role of roles) {
    for (const ref of role.semanticColorRefs || []) if (!colorIds.has(ref)) fail('SEMANTIC_COLOR_REF_UNRESOLVED', 'A role references an undeclared semantic color application.', { option: optionId, role: role.role, ref })
  }
  for (const application of colorApplications) {
    if (!application.id || !application.semanticRole || !application.renderedValue || !application.source || !application.scope) {
      fail('SEMANTIC_COLOR_APPLICATION_INCOMPLETE', 'Color applications require id, semanticRole, renderedValue, source and scope.', { option: optionId, id: application.id })
      continue
    }
    if (application.source === 'asset-intrinsic-only') {
      if (application.scope !== 'inside-asset-pixels') fail('ASSET_COLOR_PROMOTED_TO_UI_SEMANTIC', 'A color observed inside an asset cannot become UI chrome, state or emphasis.', { option: optionId, id: application.id, scope: application.scope })
      continue
    }
    if (application.source === 'brand-semantic-token') {
      const token = semanticRoles[application.tokenRef]
      if (!token || !['mapped', 'style-only'].includes(token.status) || token.value == null) {
        fail('SEMANTIC_COLOR_EVIDENCE_UNBOUND', 'The claimed brand semantic token is absent, unresolved or rejected.', { option: optionId, id: application.id, tokenRef: application.tokenRef })
        continue
      }
      if (normalizedColor(token.value) !== normalizedColor(application.renderedValue)) fail('SEMANTIC_COLOR_VALUE_MISMATCH', 'Rendered UI color differs from the frozen brand semantic token.', { option: optionId, id: application.id, tokenRef: application.tokenRef, expected: token.value, actual: application.renderedValue })
      continue
    }
    if (application.source === 'host-semantic-preserved') {
      if (!application.hostTokenRef) fail('HOST_SEMANTIC_COLOR_REF_REQUIRED', 'Preserved host colors must name the existing host token/variable.', { option: optionId, id: application.id })
      continue
    }
    if (application.source === 'brand-pattern-style') {
      const pattern = patterns.get(application.patternRef)
      const componentVariant = componentVariants.get(application.componentVariantRef)
      if (!pattern) fail('PATTERN_STYLE_REF_UNRESOLVED', 'Pattern-scoped color must resolve to the frozen approved-pattern package.', { option: optionId, id: application.id, patternRef: application.patternRef })
      if (!componentVariant || componentVariant.approvedPatternId !== application.patternRef) fail('PATTERN_STYLE_COMPONENT_BINDING_REQUIRED', 'Pattern-scoped color must resolve through a Brand MOD component/style-only recipe bound to the same pattern.', { option: optionId, id: application.id, componentVariantRef: application.componentVariantRef })
      if (!Array.isArray(application.evidenceRefs) || !application.evidenceRefs.length || (pattern && !application.evidenceRefs.some((ref) => (pattern.evidenceRefs || []).includes(ref)))) fail('PATTERN_STYLE_EVIDENCE_UNBOUND', 'Pattern-scoped color needs an evidence reference approved for that pattern.', { option: optionId, id: application.id })
      if (/global|sitewide|all-pages|entire-app/i.test(application.scope)) fail('COLOR_ROLE_EXPANSION_UNAUTHORIZED', 'Pattern-scoped color cannot be promoted to a global semantic role.', { option: optionId, id: application.id, scope: application.scope })
      continue
    }
    if (application.source === 'brand-asset-palette') {
      const asset = brandAssets.get(application.assetRef)
      if (!asset || !asset.sourceSha256 || asset.sourceSha256 !== application.assetSha256) fail('ASSET_PALETTE_PROVENANCE_UNBOUND', 'Decorative asset-palette color must bind an inventoried frozen asset and exact source hash.', { option: optionId, id: application.id, assetRef: application.assetRef })
      if (!/^decoration\.|^material\./.test(application.semanticRole) || /global|sitewide|action|button|control|state|status|text|navigation/i.test(application.scope)) fail('ASSET_PALETTE_SEMANTIC_PROMOTION', 'Asset-palette colors are decorative/material only and cannot style semantic controls, states, text, navigation or global surfaces.', { option: optionId, id: application.id, semanticRole: application.semanticRole, scope: application.scope })
      const prohibited = Array.isArray(application.prohibitedUses) ? application.prohibitedUses.join(' ') : ''
      if (!/action/i.test(prohibited) || !/state|status/i.test(prohibited) || !/global/i.test(prohibited)) fail('ASSET_PALETTE_BOUNDARY_REQUIRED', 'Asset-palette applications must explicitly prohibit action, state/status and global use.', { option: optionId, id: application.id })
      if (!application.extractionMethod) fail('ASSET_PALETTE_EXTRACTION_REQUIRED', 'Document how the decorative color was sampled or derived from the frozen asset.', { option: optionId, id: application.id })
      continue
    }
    fail('SEMANTIC_COLOR_SOURCE_INVALID', 'Color source must be brand-semantic-token, brand-pattern-style, brand-asset-palette, asset-intrinsic-only or host-semantic-preserved.', { option: optionId, id: application.id, source: application.source })
  }

  const direction = option.assetArtDirection
  if (!direction || !allowedSceneStrategies.has(direction.sceneStrategy)) fail('ASSET_ART_DIRECTION_STRATEGY_REQUIRED', 'Declare a coherent scene strategy for each option.', { option: optionId })
  const scene = direction?.sceneContract
  if (!scene?.focalHierarchy || !scene?.cropPolicy || !scene?.depthPlan || !scene?.lightingPlan || !scene?.textSafeZone) fail('ASSET_ART_DIRECTION_SCENE_INCOMPLETE', 'Scene contract requires focal hierarchy, crop, depth, lighting and text-safe-zone decisions.', { option: optionId })
  if (direction?.sceneStrategy === 'validated-composite' && (!Array.isArray(scene?.coherenceChecks) || !scene.coherenceChecks.includes('perspective') || !scene.coherenceChecks.includes('light-direction') || !scene.coherenceChecks.includes('motion-direction'))) fail('ASSET_COMPOSITE_COHERENCE_UNPROVEN', 'Validated composites must reconcile perspective, light direction and motion direction.', { option: optionId })
  const assets = Array.isArray(direction?.assetAssignments) ? direction.assetAssignments : []
  if (direction?.sceneStrategy !== 'no-identity-environment' && !assets.some((asset) => identityRoles.has(asset.role))) fail('ASSET_IDENTITY_ENVIRONMENT_REQUIRED', 'A visual environment strategy needs an evidence-backed identity/environment asset.', { option: optionId })
  for (const asset of assets) {
    if (!asset.assetRef || !asset.role || !asset.sourceKind || !asset.usage || !asset.crop || !asset.focalPoint || !asset.zPlane) fail('ASSET_ASSIGNMENT_INCOMPLETE', 'Asset assignments require identity, role, provenance, usage, crop, focal point and z-plane.', { option: optionId, assetRef: asset.assetRef })
    if (asset.sourceKind === 'host-owned-business-art' && identityRoles.has(asset.role)) fail('HOST_ASSET_AS_BRAND_IDENTITY', 'Host business content cannot be promoted to brand identity or environment.', { option: optionId, assetRef: asset.assetRef })
  }
  const transitions = Array.isArray(option.roleTransitions) ? option.roleTransitions : []
  if (roles.length > 1 && transitions.length < roles.length - 1) fail('BRAND_APPLICATION_ROLE_TRANSITION_MISSING', 'Describe how selected roles connect so the result is not a poster followed by a generic page.', { option: optionId })
  for (const transition of transitions) if (!transition.from || !transition.to || !transition.relationship || !transition.businessContinuity) fail('BRAND_APPLICATION_ROLE_TRANSITION_INCOMPLETE', 'Role transitions require endpoints, visual relationship and business continuity.', { option: optionId })

  const review = option.visualRichnessSelfReview
  if (!review || review.posterThenGeneric !== false || review.stickerCollage !== false || review.hostTaskVisible !== true || !review.unifiedAtmosphere?.environment || !review.unifiedAtmosphere?.lighting || !review.unifiedAtmosphere?.depth) fail('BRAND_APPLICATION_VISUAL_RICHNESS_FAILED', 'Self-review must prove a unified environment, lighting and depth while rejecting poster/generic splits and sticker collage.', { option: optionId })
  const reviewedAssetRoles = new Set(Array.isArray(review?.distinctAssetRoles) ? review.distinctAssetRoles : [])
  const assignedAssetRoles = new Set(assets.map((asset) => asset.role).filter(Boolean))
  if (!reviewedAssetRoles.size || [...reviewedAssetRoles].some((role) => !assignedAssetRoles.has(role))) fail('ASSET_ROLE_COMPOSITION_UNPROVEN', 'Visual self-review must name the distinct assigned roles used to compose identity, material and business content; asset count alone is not proof.', { option: optionId })
  if (review?.repeatedHeroAsTexture !== false) fail('REPEATED_HERO_AS_TEXTURE', 'A hero image cannot be repeated or faded across the page to stand in for a material system.', { option: optionId })
  const preview = option.previewEvidence
  if (!preview?.path || !preview?.sha256) fail('BRAND_APPLICATION_H5_EVIDENCE_REQUIRED', 'Every option needs a hash-bound static H5 preview.', { option: optionId })
  else {
    const directPreview = path.resolve(path.dirname(planFile), preview.path)
    const previewFile = fs.existsSync(directPreview) ? directPreview : path.resolve(path.dirname(planFile), '..', preview.path)
    const ext = path.extname(previewFile).toLowerCase()
    if (ext !== '.html') fail('DESIGN_HOST_STATIC_H5_REQUIRED', 'Design-host directions must be static H5; image previews are not accepted.', { option: optionId, path: preview.path })
    if (!fs.existsSync(previewFile)) fail('BRAND_APPLICATION_PREVIEW_MISSING', 'Direction preview does not exist.', { option: optionId, path: preview.path })
    else if (sha(previewFile) !== preview.sha256) fail('BRAND_APPLICATION_PREVIEW_HASH_MISMATCH', 'Direction preview hash does not match.', { option: optionId, path: preview.path })
  }
  const signature = JSON.stringify({ roles: roleNames, transitions: transitions.map((item) => item.relationship), narrative: option.visualNarrative, sceneStrategy: direction?.sceneStrategy })
  if (signatures.has(signature)) fail('SAME_GRAMMAR_RESKIN', 'Directions must not reuse the same composition grammar and narrative.', { option: optionId })
  signatures.add(signature)
}

if (!failures.some((item) => ['BRAND_APPLICATION_PREVIEW_MISSING', 'BRAND_APPLICATION_PREVIEW_HASH_MISMATCH', 'DESIGN_HOST_STATIC_H5_REQUIRED'].includes(item.code))) {
  const audit = spawnSync(process.execPath, [new URL('./validate-design-host-expressive-h5.mjs', import.meta.url).pathname, '--plan', planFile], { encoding: 'utf8' })
  if (audit.status !== 0) {
    try { failures.push(...JSON.parse(audit.stdout).failures) }
    catch { fail('EXPRESSIVE_H5_AUDIT_FAILED', audit.stderr || 'H5 audit did not return valid JSON.') }
  }
}
console.log(JSON.stringify({ ok: failures.length === 0, optionCount: selectableOptions.length, rejectedOptionCount: options.length - selectableOptions.length, expressiveStatus: failures.length ? 'blocked' : 'eligible-for-human-review', failures }, null, 2))
process.exit(failures.length ? 1 : 0)
