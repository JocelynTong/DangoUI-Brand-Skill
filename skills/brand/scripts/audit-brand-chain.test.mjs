import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./audit-brand-chain.mjs', import.meta.url))
test('Pokémon component trial cannot masquerade as completed host skinning', () => {
  const run = spawnSync(process.execPath, [script, '--strict'], { encoding: 'utf8' })
  const report = JSON.parse(run.stdout)
  assert.equal(run.status, 1)
  assert.equal(report.status, 'BLOCKED')
  assert.equal(report.counts.mappedTokens, 4)
  assert.equal(report.counts.nativeComponents, 1)
  assert.ok(report.counts.usedMappedTokens > 0)
  for (const code of ['DIMENSION_DISPOSITION_MISSING', 'MAPPING_DISPOSITION_MISSING', 'NATIVE_COMPONENT_UNPROVEN', 'PAGE_HAS_DIRECT_COLOR_LITERALS', 'PAGE_IS_COMPONENT_TRIAL_NOT_HOST']) assert.ok(report.findings.some((item) => item.code === code), code)
})
