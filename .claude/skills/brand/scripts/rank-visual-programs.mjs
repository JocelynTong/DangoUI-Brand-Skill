#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const value = (name, fallback = '') => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : fallback
}
const inputDir = path.resolve(value('--dir', '.'))
const outputFile = value('--output') ? path.resolve(value('--output')) : ''
const limit = Math.max(1, Number.parseInt(value('--limit', '3'), 10) || 3)

const files = fs.readdirSync(inputDir)
  .filter((file) => file.endsWith('.json'))
  .sort()

const normalize = (items) => [...new Set(items.filter(Boolean))].sort()
const signature = (program) => ({
  hostClassification: program.hostClassification,
  zoneModes: (program.experienceZones || []).map((zone) => zone.mode),
  zoneBudgets: (program.experienceZones || []).map((zone) => zone.viewportBudget),
  focalAction: program.focalHierarchy?.action,
  transition: program.contentTransition?.mechanism,
  sceneJobs: normalize((program.sceneGraph || []).map((node) => node.job)),
  motion: program.motionIntent?.mode,
  leadBrandAsset: normalize([
    ...(program.experienceZones || []).flatMap((zone) => zone.brandMechanismRefs || []),
    ...(program.sceneGraph || []).flatMap((node) => node.sourceRefs || []),
  ]).find((ref) => String(ref).startsWith('asset:')) || null,
})
const distance = (left, right) => {
  const keys = Object.keys(left)
  return keys.reduce((score, key) => {
    const a = JSON.stringify(left[key])
    const b = JSON.stringify(right[key])
    return score + (a === b ? 0 : 1)
  }, 0)
}

const candidates = files.map((file) => {
  const absolute = path.join(inputDir, file)
  const program = JSON.parse(fs.readFileSync(absolute, 'utf8'))
  const risks = []
  const zones = Array.isArray(program.experienceZones) ? program.experienceZones : []
  const repeatedExpressive = zones.some((zone) => zone.mode === 'expressive' && zone.interactionFrequency === 'repeated')
  if (repeatedExpressive) risks.push('EXPRESSIVE_REPEATED_TASK_RISK')
  if (!zones.some((zone) => zone.mode === 'productive')) risks.push('PRODUCTIVE_ZONE_MISSING')
  if (program.hostClassification === 'efficiency-first' && zones.some((zone) => zone.mode === 'expressive' && zone.viewportBudget === 'dominant')) {
    risks.push('PRODUCTIVE_FLOW_OBSCURED')
  }
  const sourceRefs = normalize([
    ...zones.flatMap((zone) => zone.brandMechanismRefs || []),
    ...(program.sceneGraph || []).flatMap((node) => node.sourceRefs || []),
  ])
  const brandRefs = sourceRefs.filter((ref) => !String(ref).startsWith('host:'))
  if (brandRefs.length < 2) risks.push('BRAND_EVIDENCE_TOO_THIN')
  return {
    id: path.basename(file, '.json'),
    file: absolute,
    program,
    signature: signature(program),
    brandRefCount: brandRefs.length,
    risks,
    baseScore: Math.max(0, 10 + Math.min(brandRefs.length, 4) - risks.length * 3),
  }
})

for (let i = 0; i < candidates.length; i += 1) {
  for (let j = i + 1; j < candidates.length; j += 1) {
    if (distance(candidates[i].signature, candidates[j].signature) < 3) {
      candidates[i].risks.push(`VISUAL_PROGRAM_SAME_STRATEGY:${candidates[j].id}`)
      candidates[j].risks.push(`VISUAL_PROGRAM_SAME_STRATEGY:${candidates[i].id}`)
      candidates[i].baseScore = Math.max(0, candidates[i].baseScore - 2)
      candidates[j].baseScore = Math.max(0, candidates[j].baseScore - 2)
    }
  }
}

const pool = [...candidates]
const selected = []
while (pool.length && selected.length < Math.min(limit, candidates.length)) {
  pool.sort((a, b) => {
    const noveltyA = selected.length ? Math.min(...selected.map((item) => distance(a.signature, item.signature))) : 0
    const noveltyB = selected.length ? Math.min(...selected.map((item) => distance(b.signature, item.signature))) : 0
    const priorityA = a.baseScore + noveltyA * 2
    const priorityB = b.baseScore + noveltyB * 2
    return priorityB - priorityA || b.baseScore - a.baseScore || a.id.localeCompare(b.id)
  })
  selected.push(pool.shift())
}

const result = {
  schema: 'visual-program-competition/v1',
  generatedAt: new Date().toISOString(),
  policy: {
    purpose: 'deterministic render preselection; not an aesthetic verdict',
    renderLimit: limit,
    ranking: 'base eligibility plus greedy strategy diversity',
  },
  candidateCount: candidates.length,
  shortlist: selected.map((candidate, index) => ({
    renderPriority: index + 1,
    id: candidate.id,
    baseScore: candidate.baseScore,
    risks: candidate.risks,
    strategySignature: candidate.signature,
  })),
  candidates: candidates.map((candidate) => ({
    id: candidate.id,
    baseScore: candidate.baseScore,
    brandRefCount: candidate.brandRefCount,
    risks: candidate.risks,
    strategySignature: candidate.signature,
  })),
}

if (outputFile) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true })
  fs.writeFileSync(outputFile, `${JSON.stringify(result, null, 2)}\n`)
}
console.log(JSON.stringify(result, null, 2))
