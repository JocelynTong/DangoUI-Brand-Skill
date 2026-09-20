import assert from 'node:assert/strict'
import test from 'node:test'
import { validateVisualAcceptance } from './validate-visual-acceptance.mjs'

const record = {
  schema: 'brand-visual-acceptance/v1', task: 'Search', artifact: 'public/review.html', status: 'blocked',
  before: { label: 'before', ref: '/before.html' }, after: { label: 'after', ref: '/after.html' },
  sameRuntimeAndContent: true, changedSelector: '.primary', change: 'Remove override',
  observedComputedSurface: { before: 'rgb(237, 237, 237)', after: 'rgb(237, 237, 237)' },
  observedComputedBackground: { before: 'rgb(124, 102, 255)', after: 'rgb(0, 0, 0)' },
  sourceRefs: ['https://example.com'], limits: ['Not approved']
}
const html = '<article data-acceptance-before><iframe src="/before.html"></iframe></article><article data-acceptance-after><iframe src="/after.html"></iframe>不是视觉设计通过</article>'

test('visual acceptance requires rendered before and after with blocked boundary', () => {
  assert.deepEqual(validateVisualAcceptance(record, html), [])
  assert.ok(validateVisualAcceptance(record, html.replace('src="/after.html"', 'src="/missing.html"')).includes('AFTER_RENDER_REF_MISSING'))
  assert.ok(validateVisualAcceptance(record, html.replace('不是视觉设计通过', '')).includes('BLOCKED_BOUNDARY_NOT_VISIBLE'))
  assert.ok(validateVisualAcceptance({ ...record, after: record.before }, html).includes('BEFORE_AFTER_MISSING'))
  assert.ok(validateVisualAcceptance({ ...record, observedComputedSurface: { before: 'white', after: 'black' } }, html).includes('COMPARISON_SURFACE_MISMATCH'))
})
