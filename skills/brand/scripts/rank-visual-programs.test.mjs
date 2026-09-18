#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-program-rank-'))
const script = path.resolve('skills/brand/scripts/rank-visual-programs.mjs')
const make = (id, hostClassification, modes, transition, action) => ({
  schema: 'visual-program/v1',
  hostClassification,
  experienceZones: modes.map((mode, index) => ({ id: `${id}-${index}`, mode, hostJob: `job-${index}`, viewportBudget: index ? 'continuous-flow' : 'compact', interactionFrequency: index ? 'repeated' : 'once-per-entry', brandMechanismRefs: [`asset:${id}`, `pattern:${transition}`] })),
  focalHierarchy: { primary: id, secondary: 'content', action },
  sceneGraph: [{ layer: 'environment', job: id, sourceRefs: [`asset:${id}`] }, { layer: 'business', job: 'work', sourceRefs: ['host:list'] }],
  contentTransition: { from: `${id}-0`, to: `${id}-1`, mechanism: transition, continuitySignal: id },
  motionIntent: { mode: 'productive', purpose: 'state feedback', reducedMotionFallback: 'instant' },
})
fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify(make('a', 'balanced', ['expressive', 'productive'], 'bridge', 'search')))
fs.writeFileSync(path.join(dir, 'b.json'), JSON.stringify(make('b', 'balanced', ['expressive', 'productive'], 'bridge', 'search')))
fs.writeFileSync(path.join(dir, 'c.json'), JSON.stringify(make('c', 'efficiency-first', ['blended', 'productive'], 'direct', 'filter')))

const run = spawnSync(process.execPath, [script, '--dir', dir, '--limit', '2'], { encoding: 'utf8' })
assert.equal(run.status, 0, run.stderr)
const report = JSON.parse(run.stdout)
assert.equal(report.shortlist.length, 2)
assert.equal(report.shortlist.some((item) => item.id === 'c'), true)
assert.equal(report.candidates.some((item) => item.risks.some((risk) => risk.startsWith('VISUAL_PROGRAM_SAME_STRATEGY'))), true)
console.log('rank-visual-programs tests passed')

