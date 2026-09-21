#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

export function validateVisualAcceptance(record, html) {
  const findings = []
  const fail = (code) => findings.push(code)
  if (record?.schema !== 'brand-visual-acceptance/v1' || !record.task || !record.artifact) fail('ACCEPTANCE_SCHEMA')
  if (!['pass', 'partial', 'blocked'].includes(record?.status)) fail('ACCEPTANCE_STATUS')
  if (!record?.before?.label || !record?.before?.ref || !record?.after?.label || !record?.after?.ref || record.before.ref === record.after.ref) fail('BEFORE_AFTER_MISSING')
  if (!record?.sameRuntimeAndContent || !record?.changedSelector || !record?.change) fail('COMPARISON_SCOPE_MISSING')
  if (!record?.observedComputedSurface?.before || !record?.observedComputedSurface?.after || record.observedComputedSurface.before !== record.observedComputedSurface.after) fail('COMPARISON_SURFACE_MISMATCH')
  if (!record?.observedComputedBackground?.before || !record?.observedComputedBackground?.after || record.observedComputedBackground.before === record.observedComputedBackground.after) fail('COMPARISON_ACTION_CHANGE_UNPROVEN')
  if (!Array.isArray(record?.sourceRefs) || !record.sourceRefs.length || !Array.isArray(record?.limits) || !record.limits.length) fail('PROVENANCE_OR_LIMITS_MISSING')
  if (!html?.includes('data-acceptance-before') || !html?.includes('data-acceptance-after')) fail('VISUAL_PANELS_MISSING')
  const decoded = html?.replaceAll('&amp;', '&') || ''
  for (const side of ['before', 'after']) if (record?.[side]?.ref && !decoded.includes(`src="${record[side].ref}"`)) fail(`${side.toUpperCase()}_RENDER_REF_MISSING`)
  if (record?.status === 'blocked' && !/不是视觉设计通过|非换肤通过|not approved/i.test(decoded)) fail('BLOCKED_BOUNDARY_NOT_VISIBLE')
  return findings
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const file = process.argv[2]
  if (!file) { process.stderr.write('Usage: validate-visual-acceptance.mjs <acceptance.json>\n'); process.exit(2) }
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
  const root = path.resolve(path.dirname(file), '../..')
  const artifact = path.resolve(root, manifest.artifact)
  const html = artifact.startsWith(`${root}${path.sep}`) && fs.existsSync(artifact) ? fs.readFileSync(artifact, 'utf8') : ''
  const findings = validateVisualAcceptance(manifest, html)
  const status = findings.length ? 'INVALID_RECORD' : manifest.status === 'blocked' ? 'VALID_RECORD_VISUAL_BLOCKED' : manifest.status === 'partial' ? 'VALID_RECORD_PARTIAL' : 'VALID_RECORD_APPROVED'
  process.stdout.write(`${JSON.stringify({ status, artifact, findings }, null, 2)}\n`)
  if (findings.length) process.exitCode = 1
}
