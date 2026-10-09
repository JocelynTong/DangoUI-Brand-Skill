import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const script = path.resolve('skills/brand/scripts/validate-host-visual-residue.mjs')
const make = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'host-residue-'))
  const file = path.join(root, 'review.json')
  const data = {
    schema: 'host-visual-residue-review/v1', hostJob: 'search records',
    protectedProductFacts: [{ id: 'records', kind: 'real-data' }],
    visualProducers: [{ id: 'selected', selector: '.chip.active', property: 'color', baselineValue: '#7459e8', classification: 'replaceable-theme-residue', salience: 'high', disposition: 'neutralize', renderedValue: '#3c3c3c', basisRef: 'fallback:neutral' }],
    renderedReview: { inspected: true, viewport: '390x844', largestRetainedOldThemeRegion: 'none', verdict: 'PASS' }
  }
  const run = () => { fs.writeFileSync(file, JSON.stringify(data)); const result = spawnSync(process.execPath, [script, '--file', file, '--root', root], { encoding: 'utf8' }); return { exit: result.status, report: JSON.parse(result.stdout) } }
  return { data, run }
}

test('neutralized theme residue with rendered review passes', () => {
  const item = make()
  assert.equal(item.run().exit, 0)
})

test('preserving replaceable old-theme appearance is blocked', () => {
  const item = make()
  item.data.visualProducers[0].disposition = 'preserve'
  const report = item.run().report
  assert.ok(report.findings.some((entry) => entry.code === 'OLD_THEME_RESIDUE_PRESERVED'))
  assert.ok(report.findings.some((entry) => entry.code === 'HIGH_SALIENCE_RESIDUE_FALSE_PASS'))
})

test('business-semantic appearance can be preserved only with a reason', () => {
  const item = make()
  Object.assign(item.data.visualProducers[0], { classification: 'business-semantic', disposition: 'preserve' })
  delete item.data.visualProducers[0].businessSemanticReason
  assert.ok(item.run().report.findings.some((entry) => entry.code === 'BUSINESS_SEMANTIC_REASON_MISSING'))
  item.data.visualProducers[0].businessSemanticReason = 'Red communicates a frozen error status.'
  assert.equal(item.run().exit, 0)
})
