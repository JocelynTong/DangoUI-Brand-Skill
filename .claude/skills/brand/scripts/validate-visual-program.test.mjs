#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-program-'))
const script = path.resolve('skills/brand/scripts/validate-visual-program.mjs')
const run = (name, value) => {
  const file = path.join(dir, name)
  fs.writeFileSync(file, JSON.stringify(value))
  return spawnSync(process.execPath, [script, '--file', file], { encoding: 'utf8' })
}

const valid = {
  schema: 'visual-program/v1',
  hostClassification: 'efficiency-first',
  experienceZones: [{ id: 'entry', mode: 'expressive', hostJob: 'establish context', viewportBudget: 'compact', brandMechanismRefs: ['composition:depth'], interactionFrequency: 'once-per-entry' }],
  focalHierarchy: { primary: 'arena subject', action: 'search' },
  sceneGraph: [
    { layer: 'environment', sourceRefs: ['asset:arena'], job: 'identity' },
    { layer: 'interface', sourceRefs: ['token:text'], job: 'task' }
  ],
  compositionSequence: ['identity-environment', 'task-bridge', 'business-stream'],
  contentEntryForm: 'edge-handoff',
  resultContainerForm: 'card-stack',
  contentTransition: { from: 'entry', to: 'results', mechanism: 'task-bridge', continuitySignal: 'shared edge' },
  motionIntent: { mode: 'productive', purpose: 'state feedback', reducedMotionFallback: 'static' }
}

assert.equal(run('valid.json', valid).status, 0)
const invalid = run('invalid.json', { schema: 'visual-program/v1', hostClassification: 'efficiency-first' })
assert.equal(invalid.status, 1)
assert.match(invalid.stdout, /VISUAL_PROGRAM_ZONES_REQUIRED/)
assert.match(invalid.stdout, /VISUAL_PROGRAM_FOCAL_CENTER_MISSING/)
console.log('validate-visual-program tests passed')
