#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { validatePreviewGrant } from './parent-delivery-gate.mjs';

export function reusableIdentityAssets(brandMod, { workspaceRoot = '', brand = '' } = {}) {
  const assets = Array.isArray(brandMod?.assets) ? brandMod.assets : [];
  if (!workspaceRoot) return assets.filter((item) => item?.status !== 'rejected');
  const manifestFile = path.join(workspaceRoot, 'migrations', brand, 'execution-manifest.json');
  const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : null;
  const grant = validatePreviewGrant(workspaceRoot, manifest?.previewContinuation);
  if (grant?.error) throw new Error(grant.error);
  if (!grant) return assets.filter((item) => item?.status !== 'rejected');
  const ids = grant.partialBrandValidation.allowedUse?.supportedIds || [];
  return assets.filter((item, index) => item?.status !== 'rejected' && (ids.includes('assets') || ids.includes(`assets.${index}`)));
}

export function validateBrandRenderKit(kit, { evidence = null, brandIntent = null, brandMod = null, brandModSha256 = "", workspaceRoot = '', brand = '' } = {}) {
  const errors = [];
  const fail = (code) => errors.push(code);
  if (kit?.schema !== "brand-render-kit/v1") fail("BRAND_RENDER_KIT_SCHEMA_INVALID");
  if (!evidence || !Array.isArray(evidence?.claims)) fail("BRAND_RENDER_KIT_EVIDENCE_INPUT_REQUIRED");
  if (!brandIntent || !Array.isArray(brandIntent?.patterns)) fail("BRAND_RENDER_KIT_INTENT_INPUT_REQUIRED");
  if (!brandMod || typeof brandMod !== "object") fail("BRAND_RENDER_KIT_BRAND_MOD_INPUT_REQUIRED");
  if (!/^[a-f0-9]{64}$/i.test(kit?.brandSystemSha256 || "") || !/^[a-f0-9]{64}$/i.test(brandModSha256 || "")) fail("BRAND_RENDER_KIT_SYSTEM_HASH_REQUIRED");
  else if (kit.brandSystemSha256 !== brandModSha256) fail("BRAND_RENDER_KIT_BRAND_SYSTEM_HASH_MISMATCH");
  const expressive = Array.isArray(kit?.expressive?.mechanisms) ? kit.expressive.mechanisms : [];
  const productive = Array.isArray(kit?.productive?.rules) ? kit.productive.rules : [];
  const transition = Array.isArray(kit?.transition?.rules) ? kit.transition.rules : [];
  if (expressive.length < 3 || expressive.some((item) => !item?.id || !item?.evidenceRef || String(item?.visibleEffect || "").trim().length < 12)) fail("BRAND_RENDER_KIT_EXPRESSIVE_INCOMPLETE");
  if (productive.length < 3 || productive.some((item) => !item?.id || !item?.systemRef || String(item?.visibleApplication || "").trim().length < 12)) fail("BRAND_RENDER_KIT_PRODUCTIVE_INCOMPLETE");
  if (transition.length < 2 || transition.some((item) => !item?.id || !item?.peak || !item?.settled || String(item?.carryThrough || "").trim().length < 12)) fail("BRAND_RENDER_KIT_TRANSITION_INCOMPLETE");
  const evidenceClaims = new Map((Array.isArray(evidence?.claims) ? evidence.claims : []).filter((item) => item?.id && item.status !== "rejected").map((item) => [item.id, item]));
  const systemRefs = collectSystemRefs(brandIntent, brandMod);
  if (expressive.some((item) => item?.evidenceRef && !evidenceClaims.has(item.evidenceRef))) fail("BRAND_RENDER_KIT_EVIDENCE_REF_INVALID");
  if (expressive.some((item) => {
    const claim = evidenceClaims.get(item?.evidenceRef);
    return claim?.sourcePageId && item?.sourcePageRef !== claim.sourcePageId;
  })) fail("BRAND_RENDER_KIT_EVIDENCE_PAGE_MISMATCH");
  if (productive.some((item) => item?.systemRef && !systemRefs.has(item.systemRef))) fail("BRAND_RENDER_KIT_PRODUCTIVE_SYSTEM_REF_INVALID");
  const expressiveIds = new Set(expressive.map((item) => item.id));
  const productiveIds = new Set(productive.map((item) => item.id));
  const transitionIds = new Set(transition.map((item) => item.id));
  const directions = Array.isArray(kit?.directions) ? kit.directions : [];
  const evidencePageIds = new Set((Array.isArray(evidence?.claims) ? evidence.claims : []).map((item) => item?.sourcePageId).filter(Boolean));
  let scopedAssets = [];
  try { scopedAssets = reusableIdentityAssets(brandMod, { workspaceRoot, brand }); } catch (error) { fail(error.message); }
  const declaredAssetIds = new Set(scopedAssets.map((item) => item?.id).filter(Boolean));
  if (evidencePageIds.size > 1 && expressive.some((item) => !evidencePageIds.has(item?.sourcePageRef))) fail("BRAND_RENDER_KIT_EXPRESSIVE_SOURCE_PAGE_REQUIRED");
  if (directions.length !== 3 || new Set(directions.map((item) => item?.id)).size !== 3) fail("BRAND_RENDER_KIT_THREE_DIRECTIONS_REQUIRED");
  const worlds = new Set();
  for (const direction of directions) {
    const world = String(direction?.visualWorld || "").trim();
    if (world.length < 16) fail("BRAND_RENDER_KIT_VISUAL_WORLD_REQUIRED");
    if (world) worlds.add(world.toLowerCase());
    const expressiveRefs = Array.isArray(direction?.expressiveMechanismRefs) ? direction.expressiveMechanismRefs : [];
    const productiveRefs = Array.isArray(direction?.productiveRuleRefs) ? direction.productiveRuleRefs : [];
    const transitionRefs = Array.isArray(direction?.transitionRuleRefs) ? direction.transitionRuleRefs : [];
    if (expressiveRefs.length < 2 || expressiveRefs.some((id) => !expressiveIds.has(id))) fail("BRAND_RENDER_KIT_DIRECTION_EXPRESSIVE_REFS_INVALID");
    if (productiveRefs.length < 2 || productiveRefs.some((id) => !productiveIds.has(id))) fail("BRAND_RENDER_KIT_DIRECTION_PRODUCTIVE_REFS_INVALID");
    if (transitionRefs.length < 1 || transitionRefs.some((id) => !transitionIds.has(id))) fail("BRAND_RENDER_KIT_DIRECTION_TRANSITION_REFS_INVALID");
    const sourcePages = Array.isArray(direction?.expressiveSourcePageRefs) ? direction.expressiveSourcePageRefs : [];
    if (evidencePageIds.size > 1 && (!sourcePages.length || sourcePages.some((id) => !evidencePageIds.has(id)))) fail("BRAND_RENDER_KIT_DIRECTION_SOURCE_PAGE_REFS_INVALID");
    if (!Array.isArray(direction?.identityAssetIds) || direction.identityAssetIds.some((id) => !declaredAssetIds.has(id))) fail("BRAND_RENDER_KIT_DIRECTION_IDENTITY_ASSETS_INVALID");
  }
  if (worlds.size !== 3) fail("BRAND_RENDER_KIT_ART_WORLD_DISTANCE_REQUIRED");
  // More captured pages do not authorize mixing their visual systems. A host may
  // legitimately fit only one source purpose; actual direction diversity and
  // transfer scope still require independent visual review, not a page count.
  // Asset availability is not a requirement to use more assets. Source-backed
  // composition diversity is reviewed separately; asset IDs remain scope-checked above.
  return { ok: errors.length === 0, errors };
}

function collectSystemRefs(brandIntent, brandMod) {
  const refs = new Set();
  const addId = (item) => { if (item?.id) refs.add(item.id); };
  (Array.isArray(brandIntent?.patterns) ? brandIntent.patterns : []).forEach(addId);
  (Array.isArray(brandIntent?.semanticClaims) ? brandIntent.semanticClaims : []).forEach(addId);
  for (const variant of Array.isArray(brandMod?.componentVariants) ? brandMod.componentVariants : []) {
    addId(variant);
    if (variant?.approvedPatternId) refs.add(variant.approvedPatternId);
  }
  for (const [index, variant] of (Array.isArray(brandMod?.componentVariants) ? brandMod.componentVariants : []).entries()) if (variant?.id && variant.status !== "rejected") refs.add(`componentVariants.${index}`);
  for (const [index, asset] of (Array.isArray(brandMod?.assets) ? brandMod.assets : []).entries()) if (asset?.id && asset.status !== "rejected") refs.add(`assets.${index}`);
  (Array.isArray(brandMod?.slots) ? brandMod.slots : []).forEach(addId);
  for (const key of Object.keys(brandMod?.semanticRoles || {})) refs.add(key);
  for (const [channel, tokens] of Object.entries(brandMod?.tokens || {})) {
    if (!["mapped", "styleOnly"].includes(channel) || !tokens || typeof tokens !== "object") continue;
    for (const key of Object.keys(tokens)) {
      const normalized = key.replace(/^--/, "");
      refs.add(key);
      refs.add(normalized);
      refs.add(`${channel}.${normalized}`);
      refs.add(`tokens.${channel}.${normalized}`);
    }
  }
  for (const key of Object.keys(brandMod?.layoutRules || {})) refs.add(`layoutRules.${key}`);
  return refs;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isCli) {
  const index = process.argv.indexOf("--file");
  const evidenceIndex = process.argv.indexOf("--evidence");
  const brandModIndex = process.argv.indexOf("--brand-mod");
  const brandIntentIndex = process.argv.indexOf("--brand-intent");
  const file = index >= 0 ? process.argv[index + 1] : "";
  if (!file || !fs.existsSync(file)) {
    console.error(JSON.stringify({ ok: false, errors: ["BRAND_RENDER_KIT_FILE_REQUIRED"] }, null, 2));
    process.exit(2);
  }
  let kit;
  try { kit = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { console.error(JSON.stringify({ ok: false, errors: ["BRAND_RENDER_KIT_JSON_INVALID"] }, null, 2)); process.exit(2); }
  const readOptional = (index) => index >= 0 && fs.existsSync(process.argv[index + 1]) ? JSON.parse(fs.readFileSync(process.argv[index + 1], "utf8")) : null;
  const brandModFile = brandModIndex >= 0 ? process.argv[brandModIndex + 1] : "";
  const brandIntentFile = brandIntentIndex >= 0
    ? process.argv[brandIntentIndex + 1]
    : brandModFile
      ? path.join(path.dirname(brandModFile), "brand-intent.json")
      : "";
  const brandModRaw = brandModFile && fs.existsSync(brandModFile) ? fs.readFileSync(brandModFile, "utf8") : "";
  const result = validateBrandRenderKit(kit, {
    evidence: readOptional(evidenceIndex),
    brandIntent: brandIntentFile && fs.existsSync(brandIntentFile) ? JSON.parse(fs.readFileSync(brandIntentFile, "utf8")) : null,
    brandMod: brandModRaw ? JSON.parse(brandModRaw) : null,
    brandModSha256: brandModRaw ? crypto.createHash("sha256").update(brandModRaw).digest("hex") : "",
    workspaceRoot: brandModFile ? path.dirname(path.dirname(path.dirname(path.resolve(brandModFile)))) : '',
    brand: brandModFile ? path.basename(path.dirname(brandModFile)) : '',
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exit(1);
}
