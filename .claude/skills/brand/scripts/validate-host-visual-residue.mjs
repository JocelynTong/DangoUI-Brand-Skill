#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const arg = (name, fallback = '') => { const at = args.indexOf(name); return at < 0 ? fallback : args[at + 1] || fallback }
const file = path.resolve(arg('--file'))
const root = path.resolve(arg('--root', process.cwd()))
if (!arg('--file')) {
  process.stderr.write('Usage: validate-host-visual-residue.mjs --file <review.json> [--root <root>]\n')
  process.exit(2)
}
const findings = []
const fail = (code, detail, producerId) => findings.push({ code, detail, ...(producerId ? { producerId } : {}) })
let review
try { review = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { fail('REVIEW_UNREADABLE', 'Review JSON cannot be read.'); review = {} }
if (review.schema !== 'host-visual-residue-review/v1' || !review.hostJob) fail('REVIEW_SCHEMA', 'Expected host-visual-residue-review/v1 with a host job.')
if (!Array.isArray(review.protectedProductFacts) || !review.protectedProductFacts.length || review.protectedProductFacts.some((item) => !item.id || !item.kind)) fail('PROTECTED_PRODUCT_FACTS_MISSING', 'Freeze protected host facts before judging appearance.')
if (!Array.isArray(review.visualProducers) || !review.visualProducers.length) fail('VISUAL_PRODUCER_INVENTORY_MISSING', 'Inventory visible first-viewport visual producers.')
const allowedClasses = ['business-semantic', 'structural-neutral', 'replaceable-theme-residue']
const allowedDispositions = ['preserve', 'replace', 'neutralize', 'omit']
for (const item of review.visualProducers || []) {
  if (!item.id || !item.selector || !item.property || !item.baselineValue || !allowedClasses.includes(item.classification) || !['low', 'medium', 'high'].includes(item.salience) || !allowedDispositions.includes(item.disposition)) {
    fail('VISUAL_PRODUCER_INCOMPLETE', 'Every producer needs selector, property, baseline, classification, salience and disposition.', item.id)
    continue
  }
  if (item.classification === 'replaceable-theme-residue' && item.disposition === 'preserve') fail('OLD_THEME_RESIDUE_PRESERVED', 'Replaceable theme residue may not be preserved.', item.id)
  if (item.classification === 'business-semantic' && item.disposition === 'preserve' && !item.businessSemanticReason) fail('BUSINESS_SEMANTIC_REASON_MISSING', 'Preserved business-semantic visuals need a semantic reason.', item.id)
  if (['replace', 'neutralize'].includes(item.disposition) && (!item.renderedValue || !item.basisRef)) fail('VISUAL_REPLACEMENT_UNTRACED', 'Replacement/neutralization needs a rendered value and evidence, policy or fallback reference.', item.id)
}
const rendered = review.renderedReview || {}
if (rendered.inspected !== true || !rendered.viewport || !['PASS', 'BLOCKED'].includes(rendered.verdict)) fail('RENDERED_REVIEW_MISSING', 'Inspect the final rendered viewport and record a verdict.')
if (rendered.verdict === 'PASS' && (review.visualProducers || []).some((item) => item.classification === 'replaceable-theme-residue' && item.disposition === 'preserve' && item.salience === 'high')) fail('HIGH_SALIENCE_RESIDUE_FALSE_PASS', 'A PASS cannot retain high-salience replaceable theme residue.')
if (rendered.verdict === 'PASS' && rendered.largestRetainedOldThemeRegion !== 'none') fail('RETAINED_OLD_THEME_REGION', 'A PASS must report no retained old-theme region, or use BLOCKED until it is justified and reclassified.')
if (review.artifact?.path || review.artifact?.sha256) {
  const artifact = path.resolve(root, review.artifact?.path || '')
  if (!artifact.startsWith(`${root}${path.sep}`) || !fs.existsSync(artifact)) fail('ARTIFACT_MISSING', 'The reviewed H5 artifact is missing or outside root.')
  else {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(artifact)).digest('hex')
    if (review.artifact.sha256 !== actual) fail('ARTIFACT_HASH_MISMATCH', 'The rendered review must bind the exact H5 artifact hash.')
  }
}
const result = { schema: 'host-visual-residue-gate/v1', ok: findings.length === 0, review: path.relative(root, file), findings }
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
if (findings.length) process.exitCode = 1
