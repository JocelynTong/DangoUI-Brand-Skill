import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./audit-brand-chain.mjs', import.meta.url))
test('Pokémon component trial cannot masquerade as completed host skinning', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-chain-'))
  try {
    const fixture = path.join(temp, 'src', 'KnowledgeRuntime.vue')
    fs.mkdirSync(path.dirname(fixture), { recursive: true })
    fs.writeFileSync(fixture, '<template><DuButton>Trial</DuButton></template><style>.trial{background:var(--du-bg-1);color:#fff}</style>')
    const run = spawnSync(process.execPath, [script, '--page', fixture, '--strict'], { encoding: 'utf8' })
    const report = JSON.parse(run.stdout)
    assert.equal(run.status, 1)
    assert.equal(report.status, 'BLOCKED')
    assert.equal(report.counts.mappedTokens, 4)
    assert.equal(report.counts.nativeComponents, 1)
    assert.ok(report.counts.usedMappedTokens > 0)
    for (const code of ['DIMENSION_DISPOSITION_MISSING', 'MAPPING_DISPOSITION_MISSING', 'NATIVE_COMPONENT_UNPROVEN', 'PAGE_HAS_DIRECT_COLOR_LITERALS', 'PAGE_IS_COMPONENT_TRIAL_NOT_HOST']) assert.ok(report.findings.some((item) => item.code === code), code)
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
})
