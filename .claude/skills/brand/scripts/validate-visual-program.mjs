#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const at = args.indexOf('--file')
const file = at >= 0 ? args[at + 1] : ''
const failures = []
const fail = (code, message, details = {}) => failures.push({ code, message, ...details })

if (!file) {
  console.error(JSON.stringify({ ok: false, gate: 'visual-program/v1', failures: [{ code: 'VISUAL_PROGRAM_FILE_REQUIRED' }] }, null, 2))
  process.exit(2)
}

let program
try {
  program = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'))
} catch (error) {
  console.error(JSON.stringify({ ok: false, gate: 'visual-program/v1', failures: [{ code: 'VISUAL_PROGRAM_UNREADABLE', message: error.message }] }, null, 2))
  process.exit(2)
}

if (program.schema !== 'visual-program/v1') fail('VISUAL_PROGRAM_SCHEMA_INVALID', 'Expected visual-program/v1.')
if (!['efficiency-first', 'balanced', 'immersion-first'].includes(program.hostClassification)) fail('VISUAL_PROGRAM_HOST_CLASSIFICATION_INVALID', 'Bind the program to a host classification.')

const zones = Array.isArray(program.experienceZones) ? program.experienceZones : []
if (!zones.length) fail('VISUAL_PROGRAM_ZONES_REQUIRED', 'At least one experience zone is required.')
for (const zone of zones) {
  if (!zone.id || !['productive', 'expressive', 'blended'].includes(zone.mode) || !zone.hostJob || !zone.viewportBudget || !zone.interactionFrequency) {
    fail('VISUAL_PROGRAM_ZONE_INCOMPLETE', 'Each zone needs id, mode, hostJob, viewportBudget and interactionFrequency.', { zone: zone.id || null })
  }
  if (!Array.isArray(zone.brandMechanismRefs) || !zone.brandMechanismRefs.length) fail('VISUAL_PROGRAM_ZONE_BRAND_MECHANISM_REQUIRED', 'Each zone needs evidence-backed brand mechanisms.', { zone: zone.id || null })
}

const focal = program.focalHierarchy || {}
if (!focal.primary || !focal.action) fail('VISUAL_PROGRAM_FOCAL_CENTER_MISSING', 'Declare one primary focal center and the primary action.')

const graph = Array.isArray(program.sceneGraph) ? program.sceneGraph : []
if (graph.length < 2 || graph.some((node) => !node.layer || !node.job || !Array.isArray(node.sourceRefs) || !node.sourceRefs.length)) fail('VISUAL_PROGRAM_SCENE_RELATIONSHIP_MISSING', 'Scene graph needs at least two sourced layers with explicit jobs.')

const transition = program.contentTransition || {}
if (!transition.from || !transition.to || !transition.mechanism || !transition.continuitySignal) fail('VISUAL_PROGRAM_TRANSITION_MISSING', 'Define how brand atmosphere hands off to business work.')

const motion = program.motionIntent || {}
if (!['none', 'productive', 'expressive'].includes(motion.mode) || !motion.purpose || !motion.reducedMotionFallback) fail('MOTION_WITHOUT_PURPOSE', 'Motion needs mode, purpose and reduced-motion fallback.')

console.log(JSON.stringify({ ok: failures.length === 0, gate: 'visual-program/v1', zoneCount: zones.length, failures }, null, 2))
process.exit(failures.length ? 1 : 0)
