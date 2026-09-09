#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};
const brand = valueAfter('--brand');
const strict = args.includes('--strict');

if (!brand || !/^[a-z0-9][a-z0-9-]*$/.test(brand)) {
  console.error('Usage: node skills/brand/scripts/validate-dangoui-mapping.mjs --brand <brand> [--strict]');
  process.exit(2);
}

const root = process.cwd();
const migrationDir = path.join(root, 'migrations', brand);
const required = {
  dtcg: path.join(migrationDir, 'brand-profile.dtcg.json'),
  mod: path.join(migrationDir, 'brand-mod.json'),
  adapter: path.join(migrationDir, 'dangoui-adapter.json'),
  components: path.join(migrationDir, 'component-mapping.json'),
  runtime: path.join(migrationDir, 'mapping-runtime-proof.json'),
};
const checks = [];
const failures = [];
const add = (ok, code, message, detail = null) => {
  const item = { ok, code, message, ...(detail ? { detail } : {}) };
  checks.push(item);
  if (!ok) failures.push(item);
};
const readJson = (file, code) => {
  if (!fs.existsSync(file)) {
    add(false, code, `Missing ${path.relative(root, file)}`);
    return null;
  }
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    add(true, code, `${path.relative(root, file)} is readable JSON.`);
    return value;
  } catch (error) {
    add(false, code, `${path.relative(root, file)} is invalid JSON.`, error.message);
    return null;
  }
};

const data = Object.fromEntries(Object.entries(required).map(([key, file]) => [key, readJson(file, `MAPPING_${key.toUpperCase()}_MISSING`)]));

const leaves = [];
const walkDtcg = (node, tokenPath = []) => {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return;
  if ('$value' in node) {
    leaves.push({ path: tokenPath.join('.'), value: node.$value, extensions: node.$extensions || {} });
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (!key.startsWith('$')) walkDtcg(value, [...tokenPath, key]);
  }
};
walkDtcg(data.dtcg);

if (data.dtcg && data.adapter) {
  const mappings = Array.isArray(data.adapter.tokenMappings) ? data.adapter.tokenMappings : [];
  const bySource = new Map(mappings.map((entry) => [entry.sourceToken, entry]));
  const contractLeaves = leaves.filter((leaf) => leaf.extensions['echo.brand.target']);
  add(contractLeaves.length > 0, 'MAPPING_DTCG_EMPTY', 'DTCG contains at least one target-bearing token.');
  for (const leaf of contractLeaves) {
    const entry = bySource.get(leaf.path);
    const target = leaf.extensions['echo.brand.target'];
    add(Boolean(entry), 'MAPPING_ADAPTER_SOURCE_MISSING', `${leaf.path} has an adapter entry.`);
    if (!entry) continue;
    add(entry.targetToken === target, 'MAPPING_TARGET_DRIFT', `${leaf.path} keeps the same target through DTCG and adapter.`, { dtcg: target, adapter: entry.targetToken });
    add(Array.isArray(entry.evidenceRefs) && entry.evidenceRefs.length > 0, 'MAPPING_EVIDENCE_MISSING', `${leaf.path} records evidence refs.`);
    add(Array.isArray(entry.allowedRoles) && entry.allowedRoles.length > 0, 'MAPPING_ALLOWED_ROLE_MISSING', `${leaf.path} declares allowed runtime roles.`);
    add(Array.isArray(entry.consumerLocations) && entry.consumerLocations.length > 0, 'MAPPING_CONSUMER_MISSING', `${leaf.path} declares a runtime consumer.`);
    if (strict) add(String(entry.status || '').includes('runtime-consumed'), 'MAPPING_RUNTIME_UNPROVEN', `${leaf.path} is runtime-consumed in strict mode.`);
    const channel = leaf.extensions['echo.brand.channel'];
    if (channel === 'styleOnly') {
      add(entry.targetExists === false && entry.mappingType === 'style-only', 'MAPPING_STYLE_ONLY_BOUNDARY', `${leaf.path} remains style-only and does not impersonate DangoUI.`);
    } else if (channel === 'mapped') {
      add(entry.targetExists === true && entry.targetToken.startsWith('--du-'), 'MAPPING_NATIVE_TOKEN_BOUNDARY', `${leaf.path} maps only to an existing --du-* token.`);
    }
  }
}

if (data.components) {
  const mappings = Array.isArray(data.components.mappings) ? data.components.mappings : [];
  add(mappings.length > 0, 'MAPPING_COMPONENTS_EMPTY', 'Component mapping contains at least one explicit decision.');
  for (const mapping of mappings) {
    add(Boolean(mapping.sourcePattern && mapping.status && mapping.boundary), 'MAPPING_COMPONENT_BOUNDARY_MISSING', `${mapping.sourcePattern || 'unnamed mapping'} declares status and boundary.`);
    if (String(mapping.status).includes('native')) {
      add(Boolean(mapping.targetComponent && mapping.api?.sourcePath && (mapping.runtimeSelector || mapping.runtimeSelectors)), 'MAPPING_NATIVE_COMPONENT_UNPROVEN', `${mapping.sourcePattern} provides native source and runtime selector proof.`);
    }
    if (String(mapping.status).includes('style-only')) {
      add(!mapping.targetComponent || String(mapping.status).includes('native-specimens'), 'MAPPING_FAKE_COMPONENT', `${mapping.sourcePattern} does not present composition as a native component.`);
    }
  }
}

if (data.runtime) {
  const proofs = Array.isArray(data.runtime.proofs) ? data.runtime.proofs : [];
  add(proofs.length > 0, 'MAPPING_RUNTIME_PROOF_EMPTY', 'Runtime proof contains observable proofs.');
  for (const proof of proofs) {
    add(Boolean(proof.route && proof.selector && proof.status), 'MAPPING_RUNTIME_PROOF_INCOMPLETE', `${proof.id || 'unnamed proof'} declares route, selector and status.`);
    if (strict) add(!/pending|missing|unverified|fail/i.test(String(proof.status)), 'MAPPING_RUNTIME_PROOF_PENDING', `${proof.id || 'unnamed proof'} is not pending or failed.`);
  }
  if (strict) add(Number(data.runtime.summary?.pendingRuntimeWork) === 0, 'MAPPING_RUNTIME_WORK_PENDING', 'Runtime proof reports zero pending work.');
}

const qaCandidates = [
  path.join(migrationDir, 'mapping-qa-report.json'),
  path.join(migrationDir, 'mapping-qa-final-pass', 'mapping-qa-report.json'),
  path.join(migrationDir, 'mapping-qa-final', 'mapping-qa-report.json'),
];
const qaPath = qaCandidates.find((file) => fs.existsSync(file));
if (strict) {
  add(Boolean(qaPath), 'MAPPING_INDEPENDENT_QA_MISSING', 'Strict mode requires an independent mapping QA report.');
  if (qaPath) {
    const qa = readJson(qaPath, 'MAPPING_INDEPENDENT_QA_INVALID');
    add(String(qa?.verdict).toLowerCase() === 'pass' && Array.isArray(qa?.blockingFindings) && qa.blockingFindings.length === 0, 'MAPPING_INDEPENDENT_QA_FAILED', 'Independent mapping QA verdict is pass with no blockers.');
  }
}

const report = {
  schema: 'dangoui-mapping-gate/v1',
  brand,
  strict,
  ok: failures.length === 0,
  summary: { checks: checks.length, passed: checks.length - failures.length, failed: failures.length, dtcgTargetTokens: leaves.filter((leaf) => leaf.extensions['echo.brand.target']).length },
  checks,
  failures,
};
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 3);
