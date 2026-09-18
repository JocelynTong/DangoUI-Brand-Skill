#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const at = args.indexOf('--report')
const reportFile = at >= 0 ? path.resolve(args[at + 1] || '') : ''
const fail = (message, details = {}) => { console.log(JSON.stringify({ ok: false, message, ...details }, null, 2)); process.exit(1) }
if (!reportFile || !fs.existsSync(reportFile)) fail('VISUAL_RETENTION_REPORT_MISSING')
let report
try { report = JSON.parse(fs.readFileSync(reportFile, 'utf8')) } catch { fail('VISUAL_RETENTION_REPORT_INVALID') }
if (report.schema !== 'visual-retention-report/v1') fail('VISUAL_RETENTION_SCHEMA_INVALID')
const minimum = Number(report.threshold?.minimumPassedDimensions || 5)
const required = report.threshold?.requiredDimensions || ['primaryComposition', 'coreAssets', 'brandMaterial']
const results = []
for (const direction of report.directions || []) {
  if (direction.evaluationSkipped === true) {
    const valid = direction.conceptProvenanceStatus === 'fail' && direction.status === 'blocked' && direction.visibility === 'internal-audit-only'
    results.push({ id: direction.id, evaluationSkipped: true, reason: 'concept-provenance-failed', expected: 'blocked', declared: direction.status, valid })
    continue
  }
  const dimensions = direction.dimensions || {}
  const passed = Object.values(dimensions).filter((value) => value === 'pass').length
  const missingRequired = required.filter((name) => dimensions[name] !== 'pass')
  const provenancePassed = direction.conceptProvenanceStatus === 'pass'
  const expected = provenancePassed && passed >= minimum && !missingRequired.length ? 'pass' : 'blocked'
  const valid = direction.status === expected && Number(direction.passedDimensions) === passed
  results.push({ id: direction.id, conceptProvenanceStatus: direction.conceptProvenanceStatus || 'missing', passedDimensions: passed, minimum, missingRequired, expected, declared: direction.status, valid })
}
const ok = results.length >= 2 && results.every((item) => item.valid) && results.some((item) => item.expected === 'pass')
console.log(JSON.stringify({ ok, results }, null, 2))
process.exit(ok ? 0 : 1)
