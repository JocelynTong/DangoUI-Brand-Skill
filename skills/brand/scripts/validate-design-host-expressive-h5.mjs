#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const flag = (name) => { const i = args.indexOf(name); return i < 0 ? '' : args[i + 1] || '' }
const planFile = flag('--plan') ? path.resolve(flag('--plan')) : ''
if (!planFile) {
  console.error('Usage: validate-design-host-expressive-h5.mjs --plan <brand-application-plan.json>')
  process.exit(2)
}

const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'))
const failures = []
const allowedMechanisms = new Set(['asset', 'typography', 'shape', 'material', 'spatial', 'motion'])
const nonAsset = new Set(['typography', 'shape', 'material', 'spatial', 'motion'])
const compositionRoles = new Set(['navigation-shell', 'identity-environment', 'task-bridge', 'featured-content', 'business-stream'])
const layoutSignatures = []
const attr = (tag, name) => {
  const found = tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))
  return found?.[2]?.trim() || ''
}
const moments = (html) => [...html.matchAll(/<([a-z][\w:-]*)\b[^>]*>/gi)]
  .map(([tag]) => ({
    moment: attr(tag, 'data-brand-moment'),
    job: attr(tag, 'data-host-job'),
    source: attr(tag, 'data-brand-source'),
    mechanisms: attr(tag, 'data-brand-mechanisms').split(/[\s,]+/).filter(Boolean),
  }))
  .filter((item) => item.moment)

for (const option of plan.options || []) {
  if (option.disposition === 'rejected') continue
  const previewPath = option.previewEvidence?.path || ''
  const direct = path.resolve(path.dirname(planFile), previewPath)
  const file = fs.existsSync(direct) ? direct : path.resolve(path.dirname(planFile), '..', previewPath)
  if (path.extname(file).toLowerCase() !== '.html' || !fs.existsSync(file)) {
    failures.push({ code: 'EXPRESSIVE_H5_REQUIRED', option: option.id })
    continue
  }
  const html = fs.readFileSync(file, 'utf8')
  const nodes = moments(html)
  const roleNodes = [...html.matchAll(/<([a-z][\w:-]*)\b[^>]*>/gi)]
    .map(([tag]) => ({ role: attr(tag, 'data-composition-role'), entry: attr(tag, 'data-content-entry'), result: attr(tag, 'data-result-container'), dataMode: attr(tag, 'data-host-data-mode') }))
    .filter((item) => item.role)
  const expressive = nodes.filter((item) => item.moment === 'expressive')
  const productive = nodes.filter((item) => item.moment === 'productive')
  const problem = (code, detail) => failures.push({ code, option: option.id, detail })
  if (!expressive.length) problem('EXPRESSIVE_MOMENT_MISSING', 'No marked entry/exploration moment in the delivered H5.')
  if (!productive.length) problem('PRODUCTIVE_MOMENT_MISSING', 'No marked real-task region in the delivered H5.')
  for (const item of nodes) {
    if (!['expressive', 'productive'].includes(item.moment) || !item.job || !item.source || !item.mechanisms.length || item.mechanisms.some((name) => !allowedMechanisms.has(name))) {
      problem('EXPERIENCE_MOMENT_UNBOUND', 'Each H5 moment needs a host job, source reference and known mechanism.')
      break
    }
  }
  const expressiveNonAsset = new Set(expressive.flatMap((item) => item.mechanisms).filter((name) => nonAsset.has(name)))
  const productiveNonAsset = new Set(productive.flatMap((item) => item.mechanisms).filter((name) => nonAsset.has(name)))
  if (!expressiveNonAsset.size) problem('ASSET_ONLY_EXPRESSION', 'The expressive moment relies only on a brand asset.')
  if (!productiveNonAsset.size || ![...expressiveNonAsset].some((name) => productiveNonAsset.has(name))) {
    problem('POSTER_THEN_GENERIC', 'No non-image brand mechanism carries from the entry moment into productive content.')
  }
  const refs = new Set([
    ...(option.compositionRoles || []).flatMap((role) => role.evidenceRefs || []),
    ...(option.assetArtDirection?.assetAssignments || []).map((asset) => asset.assetRef),
  ])
  for (const item of nodes) if (item.source && !refs.has(item.source)) problem('MOMENT_SOURCE_UNBOUND', `H5 source ${item.source} is absent from the frozen option.`)
  if (roleNodes.some((item) => !compositionRoles.has(item.role)) || JSON.stringify(roleNodes.map((item) => item.role)) !== JSON.stringify((option.compositionRoles || []).map((item) => item.role))) {
    problem('H5_COMPOSITION_ROLE_DRIFT', 'The actual H5 section order must match the frozen composition roles.')
  }
  const business = roleNodes.find((item) => item.role === 'business-stream')
  if (!business?.entry || !business?.result) problem('H5_CONTENT_GRAMMAR_MISSING', 'The delivered business stream needs an observable content entry and result-container form.')
  const firstRole = roleNodes.map((item) => item.role).find((role) => role !== 'navigation-shell')
  layoutSignatures.push({ option: option.id, firstRole, entry: business?.entry, result: business?.result })
  const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]).join('\n')
  const colors = [...new Set((css.match(/#[0-9a-f]{3,8}\b/gi) || []).map((value) => value.toLowerCase()))]
  const declared = new Set((option.semanticColorApplications || []).filter((item) => item.source !== 'asset-intrinsic-only').map((item) => String(item.renderedValue || '').toLowerCase()))
  const unboundColors = colors.filter((color) => !declared.has(color) && !['#000', '#000000', '#fff', '#ffffff'].includes(color))
  if (unboundColors.length) problem('H5_COLOR_PROVENANCE_MISSING', `${unboundColors.length} CSS color literals are absent from the frozen color-application plan: ${unboundColors.slice(0, 6).join(', ')}${unboundColors.length > 6 ? ', …' : ''}.`)
  const data = option.businessContentEvidence
  if (data?.mode === 'schema-placeholder') {
    if (business?.dataMode !== 'schema-placeholder' || !/data-dynamic-placeholder\s*=/.test(html)) problem('DYNAMIC_CONTENT_PLACEHOLDER_MISSING', 'API-driven business content must visibly use neutral schema placeholders when no captured records are bound.')
  } else if (data?.mode === 'captured-host-state') {
    const source = path.resolve(path.dirname(planFile), data.path || '')
    if (!data.path || !data.sha256 || !fs.existsSync(source)) problem('CAPTURED_BUSINESS_CONTENT_UNBOUND', 'Captured business records need a readable hash-bound source.')
  }
}

for (let i = 0; i < layoutSignatures.length; i += 1) for (let j = i + 1; j < layoutSignatures.length; j += 1) {
  const a = layoutSignatures[i]
  const b = layoutSignatures[j]
  const changed = ['firstRole', 'entry', 'result'].filter((key) => a[key] && b[key] && a[key] !== b[key])
  if (changed.length < 3) failures.push({ code: 'H5_DIRECTION_GRAMMAR_TOO_SIMILAR', options: [a.option, b.option], detail: 'Three choices must differ in first scene role, business-content entry and result-container form—not just colors or copy.' })
}

console.log(JSON.stringify({ ok: failures.length === 0, medium: 'static-h5', status: failures.length ? 'blocked' : 'eligible-for-human-review', failures }, null, 2))
if (failures.length) process.exitCode = 1
