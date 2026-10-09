import assert from 'node:assert/strict'
import test from 'node:test'
import { validatePrimaryRoleFrequencyReview } from './validate-primary-role-frequency-review.mjs'

const review = {
  schema: 'brand-primary-role-frequency-review/v1', brand: 'fixture', status: 'candidate-not-approved',
  policyRef: 'primary-color-and-cta', methodRef: 'cross-page-token-promotion',
  sources: [
    { pageId: 'home', url: 'https://example.com/home', sourcePriority: 'identity', countedContentActions: 2, styles: [
      { role: 'primary-action', treatment: 'solid', background: 'rgb(0, 0, 0)', foreground: 'rgb(255, 255, 255)', count: 1 },
      { role: 'secondary-action', treatment: 'outline', background: 'rgb(255, 255, 255)', foreground: 'rgb(0, 0, 0)', count: 1 },
    ], footerUtilityActions: { count: 1, background: 'rgb(0, 0, 0)', foreground: 'rgb(255, 255, 255)' } },
    { pageId: 'database', url: 'https://example.com/database', sourcePriority: 'task', countedContentActions: 1, styles: [
      { role: 'search-action', treatment: 'solid', background: 'rgb(255, 120, 0)', foreground: 'rgb(0, 0, 0)', count: 1 },
    ], footerUtilityActions: { count: 0, background: 'rgb(255, 255, 255)', foreground: 'rgb(0, 0, 0)' } },
  ],
  frequencyTotals: { countedTcgContentActions: 3, blackFillWhiteText: 1, whiteFillBlackText: 1, neutralWhiteOrBlack: 2, saturatedFill: 1, footerUtilityActions: 1, blackFooterUtilityActions: 1 },
  samplingMethod: 'Count .button__bg paint layers; exclude footer utility actions from content-action totals.',
  identityObservation: { role: 'brand identity' },
  interpreterDecision: {
    brandIdentityPrimary: '#000000', primaryActionSystem: 'role-scoped', orangeDisposition: 'local candidate',
    interfaceDominantPalette: { basis: 'cross-page counts', colors: ['#000000', '#FFFFFF'] },
    lightSearchShellCandidate: { targetTokenBackground: '--du-bg-1', targetTokenForeground: '--du-text-1', scope: 'search shell only' },
    approvalBoundary: { currentScope: 'candidate', notApproved: 'global promotion', missingInThisCase: ['hover', 'focus', 'independent visual QA'] },
  },
  unresolved: ['state evidence and independent visual approval'],
}

test('cross-page role frequency review is complete but remains a candidate', () => {
  assert.deepEqual(validatePrimaryRoleFrequencyReview(review), [])
  assert.equal(review.policyRef, 'primary-color-and-cta')
  assert.equal(review.methodRef, 'cross-page-token-promotion')
  assert.equal(review.interpreterDecision.frequencyIsNotApproval, undefined)
  const unbound = structuredClone(review)
  delete unbound.policyRef
  assert.ok(validatePrimaryRoleFrequencyReview(unbound).includes('REUSABLE_DECISION_RULE_UNBOUND'))
  const drift = structuredClone(review)
  drift.sources[0].styles[0].count = 40
  assert.ok(validatePrimaryRoleFrequencyReview(drift).includes('PAGE_COUNT_MISMATCH'))
  const wrongPaintLayer = structuredClone(review)
  wrongPaintLayer.sources[0].styles[0].background = 'rgba(0, 0, 0, 0)'
  assert.ok(validatePrimaryRoleFrequencyReview(wrongPaintLayer).includes('FREQUENCY_TOTAL_MISMATCH'))
  const premature = structuredClone(review)
  premature.status = 'approved'
  assert.ok(validatePrimaryRoleFrequencyReview(premature).includes('GLOBAL_APPROVAL_UNPROVEN'))
})

const evidenceRef = { path: 'capture.json', sha256: 'a'.repeat(64) }
const region = { x: 12, y: 60, width: 200, height: 48 }
function candidate(brand = 'duolingo', background = 'rgb(88, 204, 2)') {
  const style = {
    role: 'signup-action', treatment: 'solid', background, foreground: 'rgb(255, 255, 255)', count: 2,
    observations: [{ id: 'signup', selector: '#start', paintSelector: '#start::before', textSelector: '#start span', region, state: 'default', evidenceRef }],
  }
  return {
    schema: 'brand-primary-role-frequency-review/v2', brand, status: 'candidate-not-approved', producer: 'interpreter',
    policyRef: 'primary-color-and-cta', methodRef: 'cross-page-token-promotion',
    sources: [{ pageId: 'entry', url: 'https://example.com/', sourcePriority: 'identity', evidenceRef,
      census: { observedControls: 4, countedControls: 2, aggregateOnlyControls: 1,
        exclusions: [{ role: 'utility', count: 1, reason: 'footer separate from signup denominator' }],
        unknowns: [{ role: 'language-picker', count: 1, reason: 'paint layer not retained' }] }, styles: [style] }],
    frequencyTotals: { observedControls: 4, countedControls: 2, excludedControls: 1, unknownControls: 1, aggregateOnlyControls: 1,
      byRoleAndTreatment: [{ role: style.role, treatment: style.treatment, background: style.background, foreground: style.foreground, count: 2 }] },
    sampling: { unit: 'visible semantic controls', paintLayerMethod: 'inspect actual painted pseudo element and text child', scope: 'retained homepage frames only' },
    identityObservation: { role: 'green owl identity, not action proof' },
    interpreterDecision: { brandIdentityDecision: 'identity carries green', primaryActionDecision: 'signup green locally observed', interfacePaletteDecision: 'white surfaces with green action', exceptions: [],
      mappingCandidates: [{ role: 'signup-action', targetToken: '--action-primary-bg', scope: 'homepage signup candidate only', rationale: 'same recorded job' }],
      approvalBoundary: { currentScope: 'page-local candidate', notApproved: ['global primary token'], missingInThisCase: ['independent page', 'state comparison', 'fresh QA'] } },
    unresolved: ['independent same-role source and states not observed'],
  }
}

function approved() {
  const value = candidate()
  const second = structuredClone(value.sources[0])
  second.pageId = 'signup'; second.url = 'https://example.com/signup'; second.sourcePriority = 'task'
  value.sources.push(second)
  for (const name of ['observedControls', 'countedControls', 'excludedControls', 'unknownControls', 'aggregateOnlyControls']) value.frequencyTotals[name] *= 2
  value.frequencyTotals.byRoleAndTreatment[0].count *= 2
  value.status = 'approved'
  value.unresolved = ['language-picker remains unapproved; unrelated to signup']
  value.interpreterDecision.approvalBoundary = { currentScope: 'global signup-action only', notApproved: ['language picker'], missingInThisCase: [] }
  const style = value.sources[0].styles[0]
  value.promotions = [{ role: style.role, treatment: style.treatment, background: style.background, foreground: style.foreground,
    scope: 'global', targetToken: '--action-primary-bg', rationale: 'two same-role contexts, retained states and QA',
    sourceUrls: value.sources.map((page) => page.url), conflictDisposition: 'no-unresolved-conflict', unresolved: [],
    stateEvidence: value.sources.flatMap((page) => ['default', 'hover', 'focus'].map((state) => ({
      url: page.url, observationId: 'signup', selector: '#start', state, role: style.role, treatment: style.treatment,
      background: state === 'hover' ? 'rgb(80, 180, 2)' : style.background, foreground: style.foreground,
      region, evidenceRef, contrastPassed: true,
    }))), visualQA: { approved: true, reviewer: 'fresh-qa', evidenceRef } }]
  return value
}

test('Duolingo single-page census is a bounded candidate without Pokémon fields', () => {
  assert.deepEqual(validatePrimaryRoleFrequencyReview(candidate()), [])
  assert.deepEqual(validatePrimaryRoleFrequencyReview(candidate('unrelated-purple-brand', '#6622AA')), [])
})

test('generic counts and retained proof gaps cannot be omitted or inflated', () => {
  for (const mutation of [
    (value) => value.sources[0].census.observedControls++,
    (value) => value.sources[0].census.aggregateOnlyControls = 0,
    (value) => value.sources[0].styles[0].count++,
  ]) {
    const value = candidate(); mutation(value)
    assert.ok(validatePrimaryRoleFrequencyReview(value).includes('PAGE_COUNT_MISMATCH'))
  }
  const wrong = candidate(); wrong.frequencyTotals.byRoleAndTreatment[0].background = '#000000'
  assert.ok(validatePrimaryRoleFrequencyReview(wrong).includes('FREQUENCY_TOTAL_MISMATCH'))
  const missing = candidate(); delete missing.sources[0].census.exclusions[0].reason
  assert.ok(validatePrimaryRoleFrequencyReview(missing).includes('SAMPLING_BOUNDARY_MISSING'))
  const unbound = candidate(); delete unbound.sources[0].styles[0].observations[0].paintSelector
  assert.ok(validatePrimaryRoleFrequencyReview(unbound).includes('CONTROL_PROOF_INCOMPLETE'))
})

test('global approval requires same-role independent pages, observed states, contrast and fresh QA', () => {
  assert.deepEqual(validatePrimaryRoleFrequencyReview(approved()), [])
  for (const mutation of [
    (value) => value.promotions[0].sourceUrls.pop(),
    (value) => value.promotions[0].stateEvidence.pop(),
    (value) => value.promotions[0].stateEvidence[1].role = 'search-action',
    (value) => value.promotions[0].stateEvidence[1].contrastPassed = false,
    (value) => value.promotions[0].visualQA.reviewer = value.producer,
    (value) => value.promotions[0].visualQA.evidenceRef = {},
    (value) => value.promotions[0].unresolved.push('same-role contradiction'),
    (value) => value.sources[1].styles[0].background = '#FF8800',
    (value) => value.sources[1].census.unknowns[0].role = 'signup-action',
  ]) {
    const value = approved(); mutation(value)
    assert.ok(validatePrimaryRoleFrequencyReview(value).includes('GLOBAL_APPROVAL_UNPROVEN'))
  }
})

test('candidate cannot claim global scope, approval, or discard missing evidence', () => {
  const value = candidate(); value.interpreterDecision.approvalBoundary.currentScope = 'global'
  assert.ok(validatePrimaryRoleFrequencyReview(value).includes('CANDIDATE_APPROVAL_BOUNDARY_INVALID'))
  const missing = candidate(); missing.unresolved = []
  assert.ok(validatePrimaryRoleFrequencyReview(missing).includes('CANDIDATE_APPROVAL_BOUNDARY_INVALID'))
  const premature = candidate(); premature.status = 'approved'
  assert.ok(validatePrimaryRoleFrequencyReview(premature).includes('GLOBAL_APPROVAL_UNPROVEN'))
})

test('malformed generic arrays produce findings instead of crashing', () => {
  for (const field of ['sources', 'frequencyTotals', 'interpreterDecision', 'unresolved']) {
    const value = candidate(); value[field] = null
    assert.ok(validatePrimaryRoleFrequencyReview(value).length > 0)
  }
})
