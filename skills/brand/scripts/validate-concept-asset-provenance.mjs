#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const args = process.argv.slice(2)
const value = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] || '' : '' }
const manifestFile = value('--manifest') ? path.resolve(value('--manifest')) : ''
const strict = args.includes('--strict')
const failures = []
const fail = (code, message, context = {}) => failures.push({ code, message, ...context })
if (!manifestFile || !fs.existsSync(manifestFile)) {
  console.log(JSON.stringify({ ok: false, failures: [{ code: 'CONCEPT_ASSET_MANIFEST_MISSING', message: 'A concept asset manifest is required before image generation.' }] }, null, 2))
  process.exit(1)
}
let manifest
try { manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) } catch (error) {
  console.log(JSON.stringify({ ok: false, failures: [{ code: 'CONCEPT_ASSET_MANIFEST_INVALID', message: error.message }] }, null, 2))
  process.exit(1)
}
if (manifest.schema !== 'concept-asset-manifest/v1') fail('CONCEPT_ASSET_SCHEMA_INVALID', 'Expected concept-asset-manifest/v1.')
const identityRoles = new Set(['brand-identity', 'environment', 'campaign-scene', 'brand-texture', 'material-field'])
const allowedTiers = new Set(['evidence-source', 'derived-approved', 'host-business'])
for (const asset of manifest.assets || []) {
  if (!asset.id || !asset.path || !asset.role || !asset.provenanceTier || !asset.sourceKind) {
    fail('CONCEPT_ASSET_ENTRY_INCOMPLETE', 'Every concept asset needs id, path, role, provenanceTier and sourceKind.', { asset: asset.id })
    continue
  }
  if (!allowedTiers.has(asset.provenanceTier)) fail('GENERATED_PROPOSAL_NOT_FORMAL_INPUT', 'generated-proposal may be explored but cannot enter a formal concept or Brand MOD.', { asset: asset.id, tier: asset.provenanceTier })
  if (/(^|[/\\])generated[/\\]/i.test(asset.path) && asset.provenanceTier !== 'derived-approved') fail('GENERATED_DIRECTORY_NOT_EVIDENCE', 'Files under generated/ are not evidence-source assets.', { asset: asset.id, path: asset.path })
  if (asset.provenanceTier === 'evidence-source' && !['original-site-asset', 'official-independent-asset', 'dom-css-reconstruction'].includes(asset.sourceKind)) fail('EVIDENCE_SOURCE_KIND_INVALID', 'Evidence-source assets must originate from the official site or a traced DOM/CSS reconstruction.', { asset: asset.id, sourceKind: asset.sourceKind })
  if (asset.provenanceTier === 'derived-approved' && (!Array.isArray(asset.parentEvidenceRefs) || !asset.parentEvidenceRefs.length || !asset.approvalRef)) fail('DERIVED_ASSET_APPROVAL_REQUIRED', 'Derived assets require parent evidence refs and an explicit approval record.', { asset: asset.id })
  if (asset.provenanceTier === 'host-business' && identityRoles.has(asset.role)) fail('HOST_BUSINESS_AS_BRAND_IDENTITY', 'Host business media cannot define brand identity, environment or material.', { asset: asset.id, role: asset.role })
  const local = path.resolve(path.dirname(manifestFile), asset.path)
  if (!fs.existsSync(local)) fail('CONCEPT_ASSET_FILE_MISSING', 'Concept asset file does not exist.', { asset: asset.id, path: asset.path })
  else if (asset.sha256 && crypto.createHash('sha256').update(fs.readFileSync(local)).digest('hex') !== asset.sha256) fail('CONCEPT_ASSET_HASH_MISMATCH', 'Concept asset hash does not match.', { asset: asset.id })
}
if (strict && !(manifest.assets || []).some((asset) => asset.provenanceTier === 'evidence-source' && identityRoles.has(asset.role))) fail('EVIDENCE_BACKED_IDENTITY_REQUIRED', 'A formal concept needs at least one evidence-backed identity/environment/material asset.')
console.log(JSON.stringify({ ok: failures.length === 0, assetCount: (manifest.assets || []).length, failures }, null, 2))
process.exit(failures.length ? 1 : 0)
