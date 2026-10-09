import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { validateSceneReconstruction } from './validate-scene-reconstruction.mjs'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scene-reconstruction-'))
for (const name of ['concept.png', 'empty.png', 'imagegen-input.json']) fs.writeFileSync(path.join(root, name), name)
const artifact = (name) => ({ path: name, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex') })
const manifest = {
  schema: 'scene-reconstruction/v1', directionId: 'selected-a', viewport: { width: 375, height: 812 }, sceneCanvas: { width: 1024, height: 815 },
  conceptFrame: artifact('concept.png'), emptyScene: artifact('empty.png'), imagegenInput: artifact('imagegen-input.json'),
  layers: { background: { source: 'empty-scene' }, dynamicContent: { source: 'host-data' }, foreground: { mode: 'mask' }, contactShadow: { model: 'surface-aware' }, environmentLight: { model: 'scene-matched' } },
  slots: [{ id: 'hero-card', businessBinding: 'results[0].cover', z: 2, quad: [[0, 0], [100, 0], [100, 140], [0, 140]], surface: 'desk', occlusion: 'foreground-edge', lightResponse: 'warm-left' }],
  productiveSurface: { hostBaselineSha256: 'a'.repeat(64), coreEntry: 'search', visibleResultFields: ['title', 'author', 'category'] },
  coordinateAudit: { sameCoordinateSystem: true, recheckedAfterEmptyScene: true, method: 'three fixed environment landmarks', maxDriftPx: 3, anchors: [{ id: 'a', concept: [10, 10], emptyScene: [11, 10] }, { id: 'b', concept: [500, 20], emptyScene: [500, 21] }, { id: 'c', concept: [900, 700], emptyScene: [901, 701] }] },
}
assert.equal(validateSceneReconstruction(manifest, { root }).ok, true)
const broken = structuredClone(manifest)
delete broken.layers.environmentLight
broken.slots[0].quad = [[0, 0], [1, 1]]
const result = validateSceneReconstruction(broken, { root })
assert.equal(result.ok, false)
assert.ok(result.errors.includes('SCENE_LIGHTING_INTEGRATION_REQUIRED'))
assert.ok(result.errors.some((item) => item.startsWith('SCENE_DYNAMIC_SLOT_QUAD_REQUIRED')))
const drift = structuredClone(manifest)
drift.coordinateAudit.anchors[0].emptyScene = [50, 50]
assert.ok(validateSceneReconstruction(drift, { root }).errors.some((item) => item.startsWith('SCENE_COORDINATE_DRIFT_EXCEEDED')))
fs.rmSync(root, { recursive: true, force: true })
console.log('validate-scene-reconstruction tests passed')
