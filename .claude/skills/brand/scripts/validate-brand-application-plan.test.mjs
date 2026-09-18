#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-application-plan-'))
const validator = path.resolve('skills/brand/scripts/validate-brand-application-plan.mjs')
const digest = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
fs.writeFileSync(path.join(dir, 'host.json'), '{}')
fs.writeFileSync(path.join(dir, 'patterns.json'), JSON.stringify({ patterns: [{ id: 'campaign-stage', evidenceRefs: ['evidence:stage'] }] }))
fs.writeFileSync(path.join(dir, 'brand-mod.json'), JSON.stringify({ semanticRoles: { 'surface.page': { status: 'mapped', value: '#ffffff' } }, componentVariants: [{ id: 'campaign', approvedPatternId: 'campaign-stage' }], assets: [{ id: 'hero-art', sourceSha256: 'asset-sha' }], verification: { patterns: 'patterns.json' } }))
for (const id of ['a', 'b']) fs.writeFileSync(path.join(dir, `${id}.html`), `<!doctype html><title>${id}</title>`)
const role = (name, ratio) => ({ role: name, hostJob: `${name} job`, brandMechanisms: ['source-backed mechanism'], evidenceRefs: ['evidence:1'], designSystemBinding: { status: 'mapped', refs: ['token:1'] }, semanticColorRefs: ['page-surface'], viewportBudget: { firstViewportAreaRatio: ratio } })
const option = (id, roles, relationships, strategy = 'single-source-scene') => ({
  id,
  visualNarrative: `${id} narrative`,
  semanticColorApplications: [{ id: 'page-surface', semanticRole: 'surface', renderedValue: '#ffffff', source: 'brand-semantic-token', tokenRef: 'surface.page', scope: 'page-surface' }],
  compositionRoles: roles.map((name, index) => role(name, index ? .3 : .4)),
  assetArtDirection: {
    sceneStrategy: strategy,
    sceneContract: { focalHierarchy: ['subject', 'action', 'content'], cropPolicy: 'protect subject', depthPlan: 'foreground / subject / environment', lightingPlan: 'one coherent source', textSafeZone: 'upper-left' },
    assetAssignments: [{ assetRef: `asset:${id}`, role: 'environment', sourceKind: 'official-independent-asset', usage: 'identity field', crop: 'cover focal subject', focalPoint: '.5,.4', zPlane: 'environment' }]
  },
  roleTransitions: relationships.map((relationship, index) => ({ from: roles[index], to: roles[index + 1], relationship, businessContinuity: 'primary task remains visible' })),
  visualRichnessSelfReview: { posterThenGeneric: false, stickerCollage: false, hostTaskVisible: true, distinctAssetRoles: ['environment'], repeatedHeroAsTexture: false, unifiedAtmosphere: { environment: 'scene', lighting: 'shared source', depth: 'three planes' } },
  previewEvidence: { path: `${id}.html`, sha256: digest(path.join(dir, `${id}.html`)) }
})
const valid = {
  schema: 'brand-application-plan/v1',
  hostClassification: 'balanced',
  brandSystemBinding: { brandModPath: 'brand-mod.json', brandModSha256: digest(path.join(dir, 'brand-mod.json')), patternsPath: 'patterns.json', patternsSha256: digest(path.join(dir, 'patterns.json')) },
  hostBinding: { targetRoute: '/pages/home', viewport: { width: 390, height: 844 }, baselinePath: 'host.json', baselineSha256: digest(path.join(dir, 'host.json')) },
  options: [
    option('a', ['navigation-shell', 'identity-environment', 'task-bridge', 'business-stream'], ['overlay', 'edge-bridge', 'direct-handoff']),
    option('b', ['navigation-shell', 'task-bridge', 'featured-content', 'business-stream'], ['contained-transition', 'interleaving', 'persistent-shell'], 'material-field')
  ]
}
const file = path.join(dir, 'plan.json')
const run = (data) => { fs.writeFileSync(file, JSON.stringify(data)); return spawnSync(process.execPath, [validator, '--plan', file], { encoding: 'utf8' }) }
assert.equal(run(valid).status, 0)
fs.writeFileSync(path.join(dir, 'a.png'), 'image-a')
const imageDefault = structuredClone(valid)
imageDefault.options[0].previewEvidence = { path: 'a.png', sha256: digest(path.join(dir, 'a.png')) }
assert.match(run(imageDefault).stdout, /DESIGN_HOST_STATIC_H5_REQUIRED/)
const imageException = structuredClone(imageDefault)
imageException.previewMediumException = { approvedBy: 'explicit-user' }
assert.equal(run(imageException).status, 0)
const generic = structuredClone(valid)
generic.options[0].visualRichnessSelfReview.posterThenGeneric = true
assert.match(run(generic).stdout, /BRAND_APPLICATION_VISUAL_RICHNESS_FAILED/)
const missingAssetComposition = structuredClone(valid)
missingAssetComposition.options[0].visualRichnessSelfReview.distinctAssetRoles = []
assert.match(run(missingAssetComposition).stdout, /ASSET_ROLE_COMPOSITION_UNPROVEN/)
const repeatedHero = structuredClone(valid)
repeatedHero.options[0].visualRichnessSelfReview.repeatedHeroAsTexture = true
assert.match(run(repeatedHero).stdout, /REPEATED_HERO_AS_TEXTURE/)
const leaked = structuredClone(valid)
leaked.options[0].assetArtDirection.assetAssignments[0].sourceKind = 'host-owned-business-art'
assert.match(run(leaked).stdout, /HOST_ASSET_AS_BRAND_IDENTITY/)
const promoted = structuredClone(valid)
promoted.options[0].semanticColorApplications[0] = { id: 'page-surface', semanticRole: 'action', renderedValue: '#1268ff', source: 'asset-intrinsic-only', scope: 'button-and-panel' }
assert.match(run(promoted).stdout, /ASSET_COLOR_PROMOTED_TO_UI_SEMANTIC/)
const unsupported = structuredClone(valid)
unsupported.options[0].semanticColorApplications[0].tokenRef = 'action.primary.fill'
assert.match(run(unsupported).stdout, /SEMANTIC_COLOR_EVIDENCE_UNBOUND/)
const patternStyle = structuredClone(valid)
patternStyle.options[0].semanticColorApplications.push({ id: 'campaign-black', semanticRole: 'style-only.campaign-stage', renderedValue: '#131415', source: 'brand-pattern-style', scope: 'identity-environment', patternRef: 'campaign-stage', componentVariantRef: 'campaign', evidenceRefs: ['evidence:stage'] })
patternStyle.options[0].compositionRoles[0].semanticColorRefs.push('campaign-black')
assert.equal(run(patternStyle).status, 0)
const globalizedPattern = structuredClone(patternStyle)
globalizedPattern.options[0].semanticColorApplications.at(-1).scope = 'sitewide background'
assert.match(run(globalizedPattern).stdout, /COLOR_ROLE_EXPANSION_UNAUTHORIZED/)
const decorativePalette = structuredClone(valid)
decorativePalette.options[0].semanticColorApplications.push({ id: 'energy-yellow', semanticRole: 'decoration.energy', renderedValue: '#ffcb05', source: 'brand-asset-palette', scope: 'featured-content decorative band', assetRef: 'hero-art', assetSha256: 'asset-sha', extractionMethod: 'sampled from frozen hero art', prohibitedUses: ['action', 'state/status', 'global'] })
decorativePalette.options[0].compositionRoles[0].semanticColorRefs.push('energy-yellow')
assert.equal(run(decorativePalette).status, 0)
const promotedPalette = structuredClone(decorativePalette)
promotedPalette.options[0].semanticColorApplications.at(-1).scope = 'navigation action state'
assert.match(run(promotedPalette).stdout, /ASSET_PALETTE_SEMANTIC_PROMOTION/)
const auditedRejection = structuredClone(valid)
auditedRejection.options.push({ id: 'c', disposition: 'rejected', rejectionReason: 'asset color escaped into UI semantics', rejectionCodes: ['ASSET_COLOR_PROMOTED_TO_UI_SEMANTIC'], incidentRef: 'incident-retro.json' })
assert.equal(run(auditedRejection).status, 0)
const same = structuredClone(valid)
same.options[1] = structuredClone(same.options[0])
same.options[1].id = 'b'
same.options[1].previewEvidence = { path: 'b.html', sha256: digest(path.join(dir, 'b.html')) }
assert.match(run(same).stdout, /SAME_GRAMMAR_RESKIN/)
console.log('validate-brand-application-plan tests passed')
