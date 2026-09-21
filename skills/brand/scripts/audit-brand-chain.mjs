#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const args = process.argv.slice(2)
const value = (flag, fallback = '') => { const at = args.indexOf(flag); return at < 0 ? fallback : args[at + 1] || fallback }
const read = (file) => JSON.parse(fs.readFileSync(path.resolve(root, file), 'utf8'))
const base = value('--brand-root', 'public/brand-registry/v0.1/brands/pokemon-tcg-official/0.2.0')
const evidence = read(path.join(base, 'brand-evidence.json'))
const mod = read(path.join(base, 'brand-mod.json'))
const mapping = read(path.join(base, 'component-mapping.json'))
const pagePath = value('--page', 'src/KnowledgeRuntime.vue')
const html = fs.readFileSync(path.resolve(root, pagePath), 'utf8')
const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]).join('\n')
const requiredDimensions = value('--dimensions', 'color,typography,radius,spacing,shadow,action-color').split(',').map((item) => item.trim()).filter(Boolean)
const requiredComponents = value('--components', 'Search,Input,Tag,Button,Card').split(',').map((item) => item.trim()).filter(Boolean)
const findings = []
for (const dimension of requiredDimensions) {
  const source = evidence.dimensionCoverage?.[dimension]
  if (!source || !['observed', 'unresolved', 'not-observed', 'unavailable', 'out-of-scope'].includes(source.status) || (source.status === 'observed' && !source.claimIds?.length)) findings.push({ stage: 'evidence', owner: 'Evidence Agent', code: 'DIMENSION_DISPOSITION_MISSING', target: dimension })
  else if (source.status === 'unresolved') findings.push({ stage: 'evidence', owner: 'Evidence Agent', code: 'DIMENSION_SOURCE_UNRESOLVED', target: dimension })
  const decision = mod.mappingCoverage?.[dimension]
  if (!decision || !['mapped', 'style-only', 'unmapped', 'rejected'].includes(decision.status) || !decision.reason) findings.push({ stage: 'mapping', owner: 'Brand Interpreter', code: 'MAPPING_DISPOSITION_MISSING', target: dimension })
  else if (['unmapped', 'rejected'].includes(decision.status)) findings.push({ stage: 'mapping', owner: 'Brand Interpreter', code: 'REQUIRED_DIMENSION_UNMAPPED', target: dimension })
}
const mapped = Object.keys(mod.tokens?.mapped || {})
const native = (mapping.mappings || []).filter((item) => item.targetComponent && item.status?.includes('native-runtime-consumed'))
const nativeNames = new Set(native.map((item) => item.targetComponent))
for (const name of requiredComponents) if (!nativeNames.has(name)) findings.push({ stage: 'component', owner: 'Demo Designer / Component Mapper', code: 'NATIVE_COMPONENT_UNPROVEN', target: name })
const usedMapped = mapped.filter((name) => css.includes(`var(${name})`))
if (!usedMapped.length) findings.push({ stage: 'page', owner: 'Brand Application Designer', code: 'PAGE_DOES_NOT_CONSUME_MAPPED_TOKEN', target: pagePath })
const directColors = [...new Set(css.match(/#[0-9a-f]{3,8}\b/gi) || [])]
if (directColors.length) findings.push({ stage: 'page', owner: 'Brand Application Designer / Visual QA', code: 'PAGE_HAS_DIRECT_COLOR_LITERALS', target: `${directColors.length} distinct CSS colors` })
if (/src\/KnowledgeRuntime\.vue$/.test(pagePath)) findings.push({ stage: 'page', owner: 'Brand Application Designer / Visual QA', code: 'PAGE_IS_COMPONENT_TRIAL_NOT_HOST', target: pagePath })
else if (!/\bdu-(?:search|input|tag|button|card)\b|<Du(?:Search|Input|Tag|Button|Card)\b/.test(html)) findings.push({ stage: 'page', owner: 'Brand Application Designer / Visual QA', code: 'PAGE_IS_STATIC_NOT_COMPONENT_RUNTIME', target: pagePath })
const stages = Object.fromEntries(['evidence', 'mapping', 'component', 'page'].map((stage) => [stage, findings.some((finding) => finding.stage === stage) ? 'BLOCKED' : 'PASS']))
const report = { schema: 'brand-chain-qa/v0.1', status: Object.values(stages).every((status) => status === 'PASS') ? 'PASS' : 'BLOCKED', stages, counts: { mappedTokens: mapped.length, nativeComponents: nativeNames.size, directPageColors: directColors.length, usedMappedTokens: usedMapped.length }, findings }
console.log(JSON.stringify(report, null, 2))
if (args.includes('--strict') && report.status !== 'PASS') process.exitCode = 1
