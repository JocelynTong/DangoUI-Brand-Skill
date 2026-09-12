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
fs.writeFileSync(brandEvidenceFile, JSON.stringify({ brand: 'fixture-brand', evidence: ['campaign', 'catalog'] }))
const brandEvidenceHash = createHash('sha256').update(fs.readFileSync(brandEvidenceFile)).digest('hex')
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
  const call = [validator, '--options', optionsFile, '--decision', decisionFile, '--business-scope', scopeFile, '--brand-evidence', brandEvidenceFile]
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
console.log('validate-wild-design-decision tests passed')
