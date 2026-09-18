#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const value = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : '' }
const optionsFile = value('--options') ? path.resolve(value('--options')) : ''
const historyFile = value('--history') ? path.resolve(value('--history')) : ''
if (!optionsFile || !historyFile) {
  console.error('Usage: record-wild-design-history.mjs --options <options.json> --history <history.json>')
  process.exit(2)
}
const options = JSON.parse(fs.readFileSync(optionsFile, 'utf8'))
const existing = fs.existsSync(historyFile) ? JSON.parse(fs.readFileSync(historyFile, 'utf8')) : { schema: 'wild-design-history/v1', generations: [], options: [] }
const generationId = options.generationId || `${Date.now()}`
existing.generations = [...new Set([...(existing.generations || []), generationId])]
for (const item of options.options || []) {
  const signature = {
    visualNarrative: item.firstViewportVisualProof?.visualNarrative || '',
    compositionSignature: item.firstViewportVisualProof?.compositionSignature || {},
    assetStrategy: item.visualChoiceContract?.assetStrategy || '',
    materialLanguage: item.visualChoiceContract?.materialLanguage || '',
  }
  if (!(existing.options || []).some((old) => old.generationId === generationId && old.id === item.id)) existing.options.push({ generationId, id: item.id, signature })
}
fs.mkdirSync(path.dirname(historyFile), { recursive: true })
fs.writeFileSync(historyFile, `${JSON.stringify(existing, null, 2)}\n`)
console.log(JSON.stringify({ ok: true, generationId, optionCount: options.options?.length || 0, history: historyFile }, null, 2))
