import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const script = path.resolve('skills/brand/scripts/validate-learn-brand-handoff.mjs')
const dimensions = ['color', 'typography', 'radius', 'spacing', 'shadow', 'action-color']
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-handoff-'))
  const dir = path.join(root, 'migrations', 'fixture')
  fs.mkdirSync(dir, { recursive: true })
  const save = (name, data) => fs.writeFileSync(path.join(dir, name), `${JSON.stringify(data, null, 2)}\n`)
  save('goal-contract.json', { sealed: true, mode: 'learn-brand', evidencePolicy: { requiredVisualDimensions: dimensions } })
  const claims = dimensions.map((dimension) => ({ id: `claim-${dimension}`, status: 'observed', kind: dimension, salience: 'high' }))
  const dimensionCoverage = Object.fromEntries(dimensions.map((dimension) => [dimension, { status: 'observed', claimIds: [`claim-${dimension}`], sourceCount: 1 }]))
  save('brand-evidence.json', { claims, dimensionCoverage })
  const mappingCoverage = Object.fromEntries(dimensions.map((dimension) => [dimension, { status: 'mapped', sourceCount: 1, evidenceRefs: [`claim-${dimension}`], targetToken: `--du-${dimension}`, reason: 'Scoped control mapping', priorityReason: 'Task-critical and visibly prominent' }]))
  save('brand-intent.json', { mappingCoverage })
  const run = (stage) => { const result = spawnSync(process.execPath, [script, '--root', root, '--brand', 'fixture', '--stage', stage], { encoding: 'utf8' }); return { exit: result.status, report: JSON.parse(result.stdout) } }
  return { dir, save, claims, dimensionCoverage, mappingCoverage, run }
}

test('complete evidence and interpreter handoffs can pass', () => {
  const item = fixture()
  assert.equal(item.run('evidence').exit, 0)
  assert.equal(item.run('interpreter').exit, 0)
})

test('required observed component family passes only with traced Interpreter mapping', () => {
  const item = fixture()
  item.save('goal-contract.json', { sealed: true, mode: 'learn-brand', evidencePolicy: { requiredVisualDimensions: dimensions, requiredComponentFamilies: ['text-input'] } })
  const componentClaim = { id: 'claim-text-input', status: 'observed', kind: 'component-pattern' }
  item.save('brand-evidence.json', { claims: [...item.claims, componentClaim], dimensionCoverage: item.dimensionCoverage, componentCoverage: { 'text-input': { status: 'observed', claimIds: [componentClaim.id], sourceCount: 1 } } })
  item.save('brand-intent.json', { mappingCoverage: item.mappingCoverage, componentMappingCoverage: { 'text-input': { status: 'mapped', evidenceRefs: [componentClaim.id], targetComponent: 'Input.search' } } })
  assert.equal(item.run('evidence').exit, 0)
  assert.equal(item.run('interpreter').exit, 0)
})

test('required component family cannot remain unresolved', () => {
  const item = fixture()
  item.save('goal-contract.json', { sealed: true, mode: 'learn-brand', evidencePolicy: { requiredVisualDimensions: dimensions, requiredComponentFamilies: ['content-card'] } })
  item.save('brand-evidence.json', { claims: item.claims, dimensionCoverage: item.dimensionCoverage, componentCoverage: { 'content-card': { status: 'unresolved', claimIds: [], sourceCount: 0 } } })
  const report = item.run('evidence').report
  assert.ok(report.findings.some((entry) => entry.code === 'REQUIRED_COMPONENT_UNRESOLVED'))
})

test('observed component family cannot disappear before Interpreter mapping', () => {
  const item = fixture()
  const componentClaim = { id: 'claim-content-card', status: 'observed', kind: 'component-pattern' }
  item.save('brand-evidence.json', { claims: [...item.claims, componentClaim], dimensionCoverage: item.dimensionCoverage, componentCoverage: { 'content-card': { status: 'observed', claimIds: [componentClaim.id], sourceCount: 1 } } })
  item.save('brand-intent.json', { mappingCoverage: item.mappingCoverage })
  const report = item.run('interpreter').report
  assert.ok(report.findings.some((entry) => entry.code === 'COMPONENT_MAPPING_DISPOSITION_MISSING'))
})

test('optional unresolved component family may remain host-preserved with a reason', () => {
  const item = fixture()
  item.save('brand-evidence.json', { claims: item.claims, dimensionCoverage: item.dimensionCoverage, componentCoverage: { tabs: { status: 'unresolved', claimIds: [], sourceCount: 0 } } })
  item.save('brand-intent.json', { mappingCoverage: item.mappingCoverage, componentMappingCoverage: { tabs: { status: 'unmapped', evidenceRefs: [], fallback: 'preserve-host-semantic-neutral-visual', reason: 'No same-role evidence; preserve host tab semantics with neutral visuals.' } } })
  assert.equal(item.run('evidence').exit, 0)
  assert.equal(item.run('interpreter').exit, 0)
})

test('unmapped component cannot silently keep the previous theme skin', () => {
  const item = fixture()
  item.save('brand-evidence.json', { claims: item.claims, dimensionCoverage: item.dimensionCoverage, componentCoverage: { chips: { status: 'unresolved', claimIds: [], sourceCount: 0 } } })
  item.save('brand-intent.json', { mappingCoverage: item.mappingCoverage, componentMappingCoverage: { chips: { status: 'unmapped', evidenceRefs: [], reason: 'No same-role evidence.' } } })
  let report = item.run('interpreter').report
  assert.ok(report.findings.some((entry) => entry.code === 'COMPONENT_FALLBACK_MISSING'))
  item.save('brand-intent.json', { mappingCoverage: item.mappingCoverage, componentMappingCoverage: { chips: { status: 'unmapped', evidenceRefs: [], fallback: 'preserve-host-existing-visual', reason: 'Keep it.' } } })
  report = item.run('interpreter').report
  assert.ok(report.findings.some((entry) => entry.code === 'HOST_SKIN_RETENTION_UNJUSTIFIED'))
})

test('style from another component family cannot fill missing same-role evidence', () => {
  const item = fixture()
  const loginAction = { id: 'claim-login-primary', status: 'observed', kind: 'component-pattern', semanticRole: 'primary-action' }
  item.save('brand-evidence.json', { claims: [...item.claims, loginAction], dimensionCoverage: item.dimensionCoverage, componentCoverage: { chips: { status: 'unresolved', claimIds: [], sourceCount: 0 }, 'primary-action': { status: 'observed', claimIds: [loginAction.id], sourceCount: 1 } } })
  item.save('brand-intent.json', { mappingCoverage: item.mappingCoverage, componentMappingCoverage: {
    chips: { status: 'style-only', evidenceRefs: [loginAction.id], styleRecipe: 'Reuse login blue for selected chips.' },
    'primary-action': { status: 'mapped', evidenceRefs: [loginAction.id], targetComponent: 'Button.primary' }
  } })
  const report = item.run('interpreter').report
  assert.ok(report.findings.some((entry) => entry.code === 'COMPONENT_MAPPING_EVIDENCE_INVALID' && entry.dimension === 'component:chips'))
})

test('a newer Evidence or Intent cannot inherit an older frozen goal', () => {
  const item = fixture()
  item.save('goal-contract.json', { goalId: 'frozen-v1', brand: 'fixture', sealed: true, mode: 'learn-brand', evidencePolicy: { requiredVisualDimensions: dimensions } })
  item.save('brand-evidence.json', { goalId: 'evidence-v2', brand: 'fixture', claims: item.claims, dimensionCoverage: item.dimensionCoverage })
  item.save('brand-intent.json', { goalId: 'intent-v2', brand: 'fixture', mappingCoverage: item.mappingCoverage })
  assert.ok(item.run('evidence').report.findings.some((entry) => entry.code === 'GOAL_VERSION_MISMATCH'))
  assert.equal(item.run('interpreter').report.findings.filter((entry) => entry.code === 'GOAL_VERSION_MISMATCH').length, 2)
})

test('multiple goal files resolve to the goalId carried by current evidence', () => {
  const item = fixture()
  item.save('goal-contract.json', { goalId: 'frozen-v1', brand: 'fixture', sealed: true, mode: 'learn-brand', evidencePolicy: { requiredVisualDimensions: dimensions } })
  item.save('goal-contract-v2.json', { goalId: 'evidence-v2', brand: 'fixture', sealed: true, mode: 'learn-brand', evidencePolicy: { requiredVisualDimensions: dimensions } })
  item.save('brand-evidence.json', { goalId: 'evidence-v2', brand: 'fixture', claims: item.claims, dimensionCoverage: item.dimensionCoverage })
  const result = item.run('evidence')
  assert.equal(result.exit, 0)
  assert.equal(result.report.findings.some((entry) => entry.code === 'GOAL_VERSION_MISMATCH'), false)
})

test('scoped visible proof cannot pass on an aggregate count alone', () => {
  const item = fixture()
  item.save('goal-contract.json', { sealed: true, mode: 'learn-brand', evidencePolicy: { requiredVisualDimensions: dimensions, requireVisibleElementProof: true } })
  item.save('brand-evidence.json', { claims: item.claims, dimensionCoverage: item.dimensionCoverage })
  assert.ok(item.run('evidence').report.findings.some((entry) => entry.code === 'VISIBLE_ELEMENT_PROOF_MISSING'))
  const claims = item.claims.map((claim) => ({ ...claim, sourceUrl: 'https://example.com/', sourcePageId: 'home', sourceProof: { selector: 'a.button', visibleRect: [10, 10, 100, 40], paintedBackground: 'rgb(0, 0, 0)', paintedForeground: 'rgb(255, 255, 255)', state: 'default' } }))
  item.save('brand-evidence.json', { claims, dimensionCoverage: item.dimensionCoverage })
  assert.equal(item.run('evidence').exit, 0)
})

test('nine traceable claims cannot conceal missing visual dimensions', () => {
  const item = fixture()
  delete item.dimensionCoverage.radius
  item.save('brand-evidence.json', { claims: [...item.claims, ...item.claims.slice(0, 3)], dimensionCoverage: item.dimensionCoverage })
  const result = item.run('evidence')
  assert.equal(result.exit, 1)
  assert.ok(result.report.findings.some((entry) => entry.code === 'DIMENSION_DISPOSITION_MISSING' && entry.dimension === 'radius'))
  const interpreter = item.run('interpreter')
  assert.ok(interpreter.report.findings.some((entry) => entry.code === 'MAPPING_EVIDENCE_INVALID' && entry.dimension === 'radius'))
})

test('interpreter cannot pass four mappings while other dimensions are absent', () => {
  const item = fixture()
  delete item.mappingCoverage.shadow
  delete item.mappingCoverage['action-color']
  item.save('brand-intent.json', { mappingCoverage: item.mappingCoverage })
  const result = item.run('interpreter')
  assert.equal(result.exit, 1)
  assert.equal(result.report.findings.filter((entry) => entry.code === 'MAPPING_DISPOSITION_MISSING').length, 2)
})

test('source count and evidence reference must match upstream observed claims', () => {
  const item = fixture()
  item.mappingCoverage.color.sourceCount = 187
  item.mappingCoverage.color.evidenceRefs = ['unobserved-palette']
  item.save('brand-intent.json', { mappingCoverage: item.mappingCoverage })
  const result = item.run('interpreter')
  assert.equal(result.exit, 1)
  assert.ok(result.report.findings.some((entry) => entry.code === 'MAPPING_SOURCE_COUNT_MISMATCH'))
  assert.ok(result.report.findings.some((entry) => entry.code === 'MAPPING_EVIDENCE_INVALID'))
})

test('a token cannot become global from one task page without core-page comparison', () => {
  const item = fixture()
  item.save('goal-contract.json', { sealed: true, mode: 'learn-brand', evidencePolicy: { requiredVisualDimensions: dimensions }, referencePages: [{ id: 'home', core: true }, { id: 'card-database', core: true }] })
  const databaseClaim = { ...item.claims.find((claim) => claim.id === 'claim-action-color'), pageId: 'card-database' }
  item.save('brand-evidence.json', { claims: item.claims.filter((claim) => claim.id !== databaseClaim.id).concat(databaseClaim), dimensionCoverage: item.dimensionCoverage })
  item.save('brand-intent.json', { mappingCoverage: item.mappingCoverage })
  let report = item.run('interpreter').report
  assert.ok(report.findings.some((entry) => entry.code === 'TOKEN_CROSS_PAGE_REVIEW_MISSING' && entry.dimension === 'action-color'))
  item.mappingCoverage['action-color'].crossPageReview = { scope: 'global', conflictDisposition: 'aligned', rationale: 'Assumed from search', observations: [{ pageId: 'home', evidenceRefs: [databaseClaim.id] }, { pageId: 'card-database', evidenceRefs: [databaseClaim.id] }] }
  item.save('brand-intent.json', { mappingCoverage: item.mappingCoverage })
  report = item.run('interpreter').report
  assert.ok(report.findings.some((entry) => entry.code === 'TOKEN_PAGE_EVIDENCE_INVALID' && entry.dimension === 'action-color'))
  item.mappingCoverage['action-color'].crossPageReview.observations[0] = { pageId: 'home', unavailableReason: 'Home CTA was not captured' }
  item.save('brand-intent.json', { mappingCoverage: item.mappingCoverage })
  report = item.run('interpreter').report
  assert.ok(report.findings.some((entry) => entry.code === 'TOKEN_GLOBAL_SCOPE_UNPROVEN' && entry.dimension === 'action-color'))
})

test('two pages cannot approve orange globally when they compare different CTA jobs or only default state', () => {
  const item = fixture()
  item.save('goal-contract.json', { sealed: true, mode: 'learn-brand', evidencePolicy: { requiredVisualDimensions: dimensions }, referencePages: [{ id: 'home', core: true }, { id: 'card-database', core: true }] })
  const home = { id: 'home-action', status: 'observed', kind: 'action-color', sourcePageId: 'home', semanticRole: 'campaign-discovery', salience: 'high' }
  const database = { id: 'database-action', status: 'observed', kind: 'action-color', sourcePageId: 'card-database', semanticRole: 'database-search', salience: 'high' }
  item.dimensionCoverage['action-color'] = { status: 'observed', claimIds: [home.id, database.id], sourceCount: 2 }
  item.save('brand-evidence.json', { claims: item.claims.filter((claim) => claim.id !== 'claim-action-color').concat(home, database), dimensionCoverage: item.dimensionCoverage })
  item.mappingCoverage['action-color'] = {
    ...item.mappingCoverage['action-color'], sourceCount: 2, evidenceRefs: [home.id, database.id],
    crossPageReview: {
      scope: 'global', conflictDisposition: 'aligned', rationale: 'Both buttons are visible',
      policyRef: 'primary-color-and-cta', roleKind: 'primary-action', brandPrimaryRelation: 'unresolved',
      observations: [
        { pageId: 'home', evidenceRefs: [home.id], semanticRole: 'campaign-discovery', states: ['default'] },
        { pageId: 'card-database', evidenceRefs: [database.id], semanticRole: 'database-search', states: ['default'] }
      ]
    }
  }
  item.save('brand-intent.json', { mappingCoverage: item.mappingCoverage })
  const report = item.run('interpreter').report
  assert.equal(report.status, 'BLOCKED')
  assert.ok(report.findings.some((entry) => entry.code === 'PRIMARY_ACTION_ROLE_MISMATCH'))
  assert.ok(report.findings.some((entry) => entry.code === 'PRIMARY_ACTION_STATES_UNOBSERVED'))
  item.mappingCoverage['action-color'].crossPageReview.policyRef = undefined
  item.save('brand-intent.json', { mappingCoverage: item.mappingCoverage })
  assert.ok(item.run('interpreter').report.findings.some((entry) => entry.code === 'PRIMARY_COLOR_POLICY_UNBOUND'))
  const review = item.mappingCoverage['action-color'].crossPageReview
  review.policyRef = 'primary-color-and-cta'
  review.observations[0].semanticRole = 'database-search'
  for (const row of review.observations) row.states = ['default', 'hover', 'focus']
  item.save('brand-intent.json', { mappingCoverage: item.mappingCoverage })
  assert.ok(item.run('interpreter').report.findings.some((entry) => entry.code === 'TOKEN_SEMANTIC_ROLE_UNTRACED'))
  home.semanticRole = 'database-search'
  home.states = ['default', 'hover', 'focus']
  database.states = ['default', 'hover', 'focus']
  item.save('brand-evidence.json', { claims: item.claims.filter((claim) => claim.id !== 'claim-action-color').concat(home, database), dimensionCoverage: item.dimensionCoverage })
  assert.ok(item.run('interpreter').report.findings.some((entry) => entry.code === 'PRIMARY_ROLE_FREQUENCY_UNRECORDED'))
  for (const row of review.observations) Object.assign(row, { visibleControlCount: 1, excludedControlCount: 0, sourcePriority: row.pageId === 'home' ? 'identity-bearing home' : 'task page', salience: 'high' })
  item.save('brand-intent.json', { mappingCoverage: item.mappingCoverage })
  const supported = item.run('interpreter').report
  assert.equal(supported.findings.filter((entry) => entry.dimension === 'action-color').length, 0)
})
