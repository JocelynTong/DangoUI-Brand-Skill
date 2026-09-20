#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateCaseRule, validateDecisionQuestion } from './validate-case-flywheel.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const bundledRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../knowledge-runtime')
const root = fs.existsSync(path.join(bundledRoot,'knowledge/v0.1/index.json')) ? bundledRoot : repositoryRoot
const indexPath = path.join(root, 'public/knowledge/v0.1/index.json')
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
const methodIndex = JSON.parse(fs.readFileSync(path.join(root, 'knowledge/v0.1/index.json'), 'utf8'))
const [command, id] = process.argv.slice(2)
const fail = (message) => { console.error(message); process.exit(2) }
const readRecord = (kind, wanted) => {
  const record = (methodIndex[kind] || []).find((item) => item.id === wanted)
  if (!record) fail(`Unknown ${kind.slice(0, -1)}: ${wanted}`)
  const file = path.resolve(root, record.path)
  if (!file.startsWith(`${path.join(root, 'knowledge/v0.1')}${path.sep}`)) fail(`Knowledge path escapes catalog: ${wanted}`)
  const guide = path.resolve(root, record.guide || '')
  if (!guide.startsWith(`${path.join(root, 'knowledge/v0.1')}${path.sep}`)) fail(`Knowledge guide escapes catalog: ${wanted}`)
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (kind === 'rules') {
    const cases = new Map((methodIndex.cases || []).map((entry) => [entry.id, JSON.parse(fs.readFileSync(path.join(root, entry.path), 'utf8'))]))
    const failures = validateCaseRule(data, cases)
    if (failures.length) fail(`Invalid decision rule ${wanted}: ${failures.join(', ')}`)
  }
  if (kind === 'questions') {
    const methods = new Set((methodIndex.methods || []).map((entry) => entry.id))
    const cases = new Map((methodIndex.cases || []).map((entry) => [entry.id, JSON.parse(fs.readFileSync(path.join(root, entry.path), 'utf8'))]))
    const rules = new Map((methodIndex.rules || []).map((entry) => [entry.id, JSON.parse(fs.readFileSync(path.join(root, entry.path), 'utf8'))]))
    const failures = validateDecisionQuestion(data, methods, cases, rules)
    if (failures.length) fail(`Invalid decision question ${wanted}: ${failures.join(', ')}`)
  }
  console.log(JSON.stringify({ ...data, humanGuide: fs.readFileSync(guide, 'utf8').trim() }, null, 2))
}
if (command === 'list') {
  console.log(JSON.stringify({ questions: (methodIndex.questions || []).map(({ id }) => id), patterns: methodIndex.patterns.map(({ id }) => id), methods: methodIndex.methods.map(({ id }) => id), rules: (methodIndex.rules || []).map(({ id }) => id), policies: methodIndex.policies.map(({ id }) => id), decisions: methodIndex.decisions.map(({ id }) => id), cases: methodIndex.cases.map(({ id }) => id), components: index.components, scenarios: index.scenarios.map(({ id }) => id), brandRecipes: (index.brandRecipes || []).map(({ id }) => id) }, null, 2))
} else if (command === 'question') {
  readRecord('questions', id)
} else if (command === 'rule') {
  readRecord('rules', id)
} else if (command === 'policy') {
  readRecord('policies', id)
} else if (command === 'decision') {
  readRecord('decisions', id)
} else if (command === 'pattern') {
  readRecord('patterns', id)
} else if (command === 'method') {
  readRecord('methods', id)
} else if (command === 'case') {
  readRecord('cases', id)
} else if (command === 'component') {
  if (!index.components.includes(id)) fail(`Unknown component: ${id}`)
  const source = JSON.parse(fs.readFileSync(path.join(root, index.componentSource), 'utf8'))
  const component = source.components.find((item) => item.name === id)
  if (!component) fail(`Component missing from canonical DangoUI source: ${id}`)
  console.log(JSON.stringify({ source: index.componentSource, component }, null, 2))
} else if (command === 'scenario') {
  const record = index.scenarios.find((item) => item.id === id)
  if (!record) fail(`Unknown scenario: ${id}`)
  console.log(fs.readFileSync(path.join(root, record.path), 'utf8').trim())
} else if (command === 'recipe') {
  const record = (index.brandRecipes || []).find((item) => item.id === id)
  if (!record) fail(`Unknown brand recipe: ${id}`)
  console.log(fs.readFileSync(path.join(root, record.path), 'utf8').trim())
} else {
  fail('Usage: query-design-knowledge.mjs list | question <id> | rule <id> | policy <id> | decision <id> | pattern <id> | method <id> | case <id> | component <name> | scenario <id> | recipe <id>')
}
