#!/usr/bin/env node
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
// Evaluates a frozen expectation against browser observations; never infers visual approval.
export function validateHandoff(plan, observations) {
  const failures = [];
  if (!plan?.components?.length) failures.push('COMPONENT_EXPECTATIONS_MISSING');
  if (!Array.isArray(plan?.motions)) failures.push('MOTION_EXPECTATIONS_MISSING');
  for (const item of plan?.components || []) {
    const actual = observations?.components?.find(x => x.id === item.id);
    if (!actual || actual.role !== item.role) failures.push(`COMPONENT_ROLE:${item.id}`);
    for (const state of item.states || []) {
      if (actual?.states?.[state] !== 'pass') failures.push(`COMPONENT_STATE:${item.id}:${state}`);
    }
  }
  for (const item of plan?.motions || []) {
    const actual = observations?.motions?.find(x => x.id === item.id);
    for (const key of ['trigger', 'durationMs', 'iterations', 'reducedMotion']) {
      if (!actual || actual[key] !== item[key]) failures.push(`MOTION_${key}:${item.id}`);
    }
    if (!actual?.observedInBrowser) failures.push(`MOTION_NOT_OBSERVED:${item.id}`);
  }
  return { ok: failures.length === 0, failures, scope: 'handoff completeness, not aesthetic approval' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = validateHandoff(JSON.parse(fs.readFileSync(process.argv[2])), JSON.parse(fs.readFileSync(process.argv[3])));
    console.log(JSON.stringify(result, null, 2)); process.exitCode = result.ok ? 0 : 1;
  } catch (error) { console.error('HANDOFF_INPUT_INVALID:', error.message); process.exitCode = 1; }
}
