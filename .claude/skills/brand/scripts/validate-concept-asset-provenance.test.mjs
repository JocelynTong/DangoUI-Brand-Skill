import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'concept-provenance-'))
const validator = path.resolve('skills/brand/scripts/validate-concept-asset-provenance.mjs')
fs.mkdirSync(path.join(root, 'source'), { recursive: true })
fs.mkdirSync(path.join(root, 'generated'), { recursive: true })
fs.writeFileSync(path.join(root, 'source', 'hero.jpg'), 'official')
fs.writeFileSync(path.join(root, 'generated', 'lab.png'), 'invented')
const run = (manifest) => { const file = path.join(root, 'manifest.json'); fs.writeFileSync(file, JSON.stringify(manifest)); return spawnSync(process.execPath, [validator, '--manifest', file, '--strict'], { encoding: 'utf8' }) }
const valid = run({ schema: 'concept-asset-manifest/v1', assets: [{ id: 'hero', path: 'source/hero.jpg', role: 'campaign-scene', provenanceTier: 'evidence-source', sourceKind: 'original-site-asset' }] })
assert.equal(valid.status, 0, valid.stdout + valid.stderr)
const invalid = run({ schema: 'concept-asset-manifest/v1', assets: [{ id: 'lab', path: 'generated/lab.png', role: 'environment', provenanceTier: 'generated-proposal', sourceKind: 'generated-independent-asset' }] })
assert.notEqual(invalid.status, 0)
assert.match(invalid.stdout, /GENERATED_PROPOSAL_NOT_FORMAL_INPUT/)
assert.match(invalid.stdout, /GENERATED_DIRECTORY_NOT_EVIDENCE/)
console.log('concept asset provenance gate tests passed')
