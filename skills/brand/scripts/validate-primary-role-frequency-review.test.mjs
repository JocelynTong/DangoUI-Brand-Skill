import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { validatePrimaryRoleFrequencyReview } from './validate-primary-role-frequency-review.mjs'

const review = JSON.parse(fs.readFileSync(path.resolve('migrations/pokemon-tcg-official/primary-action-frequency-review-2026-09-20.json'), 'utf8'))

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
  wrongPaintLayer.sources[1].styles[0].background = 'rgba(0, 0, 0, 0)'
  assert.ok(validatePrimaryRoleFrequencyReview(wrongPaintLayer).includes('FREQUENCY_TOTAL_MISMATCH'))
  const premature = structuredClone(review)
  premature.status = 'approved'
  assert.ok(validatePrimaryRoleFrequencyReview(premature).includes('GLOBAL_APPROVAL_UNPROVEN'))
})
