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
