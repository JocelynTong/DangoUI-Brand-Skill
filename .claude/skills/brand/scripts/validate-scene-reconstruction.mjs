#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const sha = (value) => /^[a-f0-9]{64}$/i.test(String(value || ''))

export function validateSceneReconstruction(manifest, { root = process.cwd() } = {}) {
  const errors = []
  const fail = (code, detail = '') => errors.push(detail ? `${code}:${detail}` : code)
  const artifact = (value, code) => {
    if (!value?.path || !sha(value?.sha256)) return fail(code)
    const file = path.resolve(root, value.path)
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return fail(code, 'missing-file')
    if (hash(file) !== value.sha256) fail(code, 'hash-mismatch')
  }

  if (manifest?.schema !== 'scene-reconstruction/v1') fail('SCENE_RECONSTRUCTION_SCHEMA_INVALID')
  if (!manifest?.directionId || !manifest?.viewport?.width || !manifest?.viewport?.height) fail('SCENE_RECONSTRUCTION_TARGET_REQUIRED')
  const sceneWidth = Number(manifest?.sceneCanvas?.width)
  const sceneHeight = Number(manifest?.sceneCanvas?.height)
  if (!Number.isFinite(sceneWidth) || sceneWidth <= 0 || !Number.isFinite(sceneHeight) || sceneHeight <= 0) fail('SCENE_CANVAS_REQUIRED')
  artifact(manifest?.conceptFrame, 'SCENE_CONCEPT_FRAME_REQUIRED')
  artifact(manifest?.emptyScene, 'SCENE_EMPTY_PLATE_REQUIRED')
  artifact(manifest?.imagegenInput, 'SCENE_IMAGEGEN_INPUT_REQUIRED')

  const layers = manifest?.layers || {}
  if (layers.background?.source !== 'empty-scene') fail('SCENE_BACKGROUND_LAYER_REQUIRED')
  if (layers.dynamicContent?.source !== 'host-data') fail('SCENE_DYNAMIC_HOST_CONTENT_REQUIRED')
  if (!layers.foreground?.mode || !['mask', 'overlay', 'none'].includes(layers.foreground.mode)) fail('SCENE_FOREGROUND_LAYER_INVALID')
  if (layers.foreground?.mode === 'none' && String(layers.foreground?.reason || '').trim().length < 20) fail('SCENE_FOREGROUND_NONE_REASON_REQUIRED')
  if (!layers.contactShadow?.model || !layers.environmentLight?.model) fail('SCENE_LIGHTING_INTEGRATION_REQUIRED')

  const slots = Array.isArray(manifest?.slots) ? manifest.slots : []
  if (!slots.length) fail('SCENE_DYNAMIC_SLOTS_REQUIRED')
  if (new Set(slots.map((slot) => slot?.id)).size !== slots.length) fail('SCENE_DYNAMIC_SLOT_IDS_INVALID')
  for (const slot of slots) {
    if (!slot?.id || !slot?.businessBinding || !Number.isFinite(slot?.z)) fail('SCENE_DYNAMIC_SLOT_BINDING_REQUIRED', slot?.id || 'unknown')
    if (!Array.isArray(slot?.quad) || slot.quad.length !== 4 || slot.quad.some((point) => !Array.isArray(point) || point.length !== 2 || point.some((value) => !Number.isFinite(value)))) fail('SCENE_DYNAMIC_SLOT_QUAD_REQUIRED', slot?.id || 'unknown')
    else {
      const area = Math.abs(slot.quad.reduce((sum, point, index) => { const next = slot.quad[(index + 1) % 4]; return sum + point[0] * next[1] - next[0] * point[1] }, 0) / 2)
      if (area < 16) fail('SCENE_DYNAMIC_SLOT_DEGENERATE', slot.id)
      if (slot.quad.some(([x, y]) => x < 0 || y < 0 || x > sceneWidth || y > sceneHeight)) fail('SCENE_DYNAMIC_SLOT_OUT_OF_BOUNDS', slot.id)
    }
    if (!slot?.surface || !slot?.occlusion || !slot?.lightResponse) fail('SCENE_DYNAMIC_SLOT_INTEGRATION_REQUIRED', slot?.id || 'unknown')
  }

  if (!manifest?.productiveSurface?.hostBaselineSha256 || !sha(manifest.productiveSurface.hostBaselineSha256) || !manifest?.productiveSurface?.coreEntry || !Array.isArray(manifest?.productiveSurface?.visibleResultFields) || manifest.productiveSurface.visibleResultFields.length < 3) fail('SCENE_PRODUCTIVE_SURFACE_REQUIRED')
  const audit = manifest?.coordinateAudit || {}
  const anchors = Array.isArray(audit.anchors) ? audit.anchors : []
  if (!audit.sameCoordinateSystem || audit.recheckedAfterEmptyScene !== true || !audit.method || anchors.length < 3) fail('SCENE_COORDINATE_AUDIT_REQUIRED')
  else {
    const limit = Number(audit.maxDriftPx)
    if (!Number.isFinite(limit) || limit < 0) fail('SCENE_COORDINATE_DRIFT_LIMIT_REQUIRED')
    for (const anchor of anchors) {
      const a = anchor?.concept
      const b = anchor?.emptyScene
      if (!anchor?.id || !Array.isArray(a) || !Array.isArray(b) || a.length !== 2 || b.length !== 2 || [...a, ...b].some((value) => !Number.isFinite(value))) { fail('SCENE_COORDINATE_ANCHOR_INVALID', anchor?.id || 'unknown'); continue }
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) > limit) fail('SCENE_COORDINATE_DRIFT_EXCEEDED', anchor.id)
    }
  }
  return { ok: errors.length === 0, errors }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isCli) {
  const index = process.argv.indexOf('--file')
  const rootIndex = process.argv.indexOf('--root')
  const file = index >= 0 ? path.resolve(process.argv[index + 1] || '') : ''
  if (!file || !fs.existsSync(file)) {
    console.error(JSON.stringify({ ok: false, errors: ['SCENE_RECONSTRUCTION_FILE_REQUIRED'] }, null, 2))
    process.exit(2)
  }
  const result = validateSceneReconstruction(JSON.parse(fs.readFileSync(file, 'utf8')), { root: rootIndex >= 0 ? path.resolve(process.argv[rootIndex + 1]) : path.dirname(file) })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (!result.ok) process.exit(1)
}
