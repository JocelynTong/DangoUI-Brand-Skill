#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateAdoptionDecision } from './validate-adoption-decision.mjs'
import { validateCaseRule, validateDecisionQuestion } from './validate-case-flywheel.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const bundledRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../knowledge-runtime')
const root = fs.existsSync(path.join(bundledRoot,'knowledge/v0.1/index.json')) ? bundledRoot : repositoryRoot
const args = process.argv.slice(2)
const flag = (name) => { const at = args.indexOf(name); return at < 0 ? '' : args[at + 1] || '' }
const failures = []
const fail = (code, detail, option) => failures.push({ code, detail, ...(option ? { option } : {}) })
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
// Concise guides are valid: require a heading and substantive body, not padding.
const hasGuide = (file) => {
  const text = fs.readFileSync(file, 'utf8').trim()
  return /^#\s+\S.+\n/m.test(text) && text.split('\n').slice(1).some(line => line.trim() && !line.trim().startsWith('#'))
}
const index = read(path.join(root, 'public/knowledge/v0.1/index.json'))
const methodsIndex = read(path.join(root, 'knowledge/v0.1/index.json'))
if (methodsIndex.schema !== 'brand-knowledge-index/v0.1') fail('METHOD_INDEX_SCHEMA', 'Unexpected method catalog schema.')
for (const kind of ['patterns', 'methods', 'cases']) {
  const seen = new Set()
  for (const entry of methodsIndex[kind] || []) {
    const file = path.resolve(root, entry.path || '')
    if (seen.has(entry.id) || !file.startsWith(`${path.join(root, 'knowledge/v0.1')}${path.sep}`) || !fs.existsSync(file)) { fail('METHOD_ENTRY_PATH', entry.id || 'missing id'); continue }
    seen.add(entry.id)
    const guide = path.resolve(root, entry.guide || '')
    if (!guide.startsWith(`${path.join(root, 'knowledge/v0.1')}${path.sep}`) || !fs.existsSync(guide) || !hasGuide(guide)) fail('KNOWLEDGE_HUMAN_GUIDE_MISSING', entry.id)
    const item = read(file)
    if (item.id !== entry.id || item.schema !== `brand-knowledge-${kind.slice(0, -1)}/v0.1` || !item.status) fail('METHOD_ENTRY_SCHEMA', entry.id)
    if (kind === 'patterns' && (!item.userJob || !item.appliesWhen?.length || !item.notFor?.length || !item.sequence?.length || !item.requiredStates?.length || !item.expressiveSlots?.length || !item.productiveInvariants?.length || !item.negativeCases?.length)) fail('PATTERN_ENTRY_INCOMPLETE', entry.id)
    if (kind === 'patterns') {
      const scenario = (index.scenarios || []).find((candidate) => candidate.id === item.id)
      if (!scenario || scenario.path !== item.sourceScenario) fail('PATTERN_SCENARIO_UNRESOLVED', entry.id)
      for (const name of item.componentRefs || []) if (!(index.components || []).includes(name)) fail('PATTERN_COMPONENT_UNRESOLVED', `${entry.id}: ${name}`)
      for (const id of item.supportingMethods || []) if (!(methodsIndex.methods || []).some((candidate) => candidate.id === id)) fail('PATTERN_METHOD_UNRESOLVED', `${entry.id}: ${id}`)
      for (const id of item.negativeCases || []) if (!(methodsIndex.cases || []).some((candidate) => candidate.id === id)) fail('PATTERN_CASE_UNRESOLVED', `${entry.id}: ${id}`)
    }
    if (kind === 'methods' && (!item.ownerRole || !item.procedure?.length || !item.notFor?.length)) fail('METHOD_ENTRY_INCOMPLETE', entry.id)
    if (kind === 'methods') for (const id of item.ruleRefs || []) if (!(methodsIndex.rules || []).some((candidate) => candidate.id === id)) fail('METHOD_RULE_UNRESOLVED', `${entry.id}: ${id}`)
    if (kind === 'cases') {
      const persistedEvidence = item.observedSource?.url || (item.evidenceFiles?.length && item.evidenceFiles.every(file => { const resolved = path.resolve(root, file); return resolved.startsWith(root + path.sep) && fs.existsSync(resolved) }))
      const explicitlyUnpersisted = item.evidenceAvailability === 'not-persisted' && item.evidenceBoundary && /not-approved|awaiting|pending/.test(`${item.status || ''} ${item.reviewStatus || ''}`)
      if (!item.invalidInference || !item.safeConclusion || !(persistedEvidence || explicitlyUnpersisted) || !item.reviewStatus) fail('CASE_ENTRY_INCOMPLETE', entry.id)
    }
  }
}
const caseRecords = new Map((methodsIndex.cases || []).map((entry) => [entry.id, read(path.join(root, entry.path))]))
const methodIds = new Set((methodsIndex.methods || []).map((entry) => entry.id))
const ruleRecords = new Map((methodsIndex.rules || []).map((entry) => [entry.id, read(path.join(root, entry.path))]))
for (const entry of methodsIndex.questions || []) {
  const file = path.resolve(root, entry.path || '')
  const guide = path.resolve(root, entry.guide || '')
  if (!file.startsWith(`${path.join(root, 'knowledge/v0.1/questions')}${path.sep}`) || !fs.existsSync(file) || !guide.startsWith(`${path.join(root, 'knowledge/v0.1/questions')}${path.sep}`) || !fs.existsSync(guide)) { fail('DECISION_QUESTION_PATH', entry.id || 'missing id'); continue }
  if (!hasGuide(guide)) fail('DECISION_QUESTION_HUMAN_GUIDE_MISSING', entry.id)
  const question = read(file)
  if (question.id !== entry.id) fail('DECISION_QUESTION_ID', entry.id)
  for (const code of validateDecisionQuestion(question, methodIds, caseRecords, ruleRecords)) fail(code, entry.id)
}
for (const entry of methodsIndex.rules || []) {
  const file = path.resolve(root, entry.path || '')
  const guide = path.resolve(root, entry.guide || '')
  if (!file.startsWith(`${path.join(root, 'knowledge/v0.1/rules')}${path.sep}`) || !fs.existsSync(file) || !guide.startsWith(`${path.join(root, 'knowledge/v0.1/rules')}${path.sep}`) || !fs.existsSync(guide)) { fail('CASE_RULE_PATH', entry.id || 'missing id'); continue }
  const rule = read(file)
  if (rule.id !== entry.id) fail('CASE_RULE_ID', entry.id)
  if (!hasGuide(guide)) fail('CASE_RULE_HUMAN_GUIDE_MISSING', entry.id)
  for (const code of validateCaseRule(rule, caseRecords)) fail(code, entry.id)
}
for (const entry of methodsIndex.decisions || []) {
  const file = path.resolve(root, entry.path || '')
  const guide = path.resolve(root, entry.guide || '')
  if (!file.startsWith(`${path.join(root, 'knowledge/v0.1/decisions')}${path.sep}`) || !fs.existsSync(file)) { fail('DECISION_ENTRY_PATH', entry.id || 'missing id'); continue }
  if (!guide.startsWith(`${path.join(root, 'knowledge/v0.1/decisions')}${path.sep}`) || !fs.existsSync(guide) || !hasGuide(guide)) fail('DECISION_HUMAN_GUIDE_MISSING', entry.id)
  const decision = read(file)
  if (decision.id !== entry.id) fail('DECISION_ID', entry.id)
  for (const code of validateAdoptionDecision(decision)) fail(code, entry.id)
  if (decision.policyRef && !(methodsIndex.policies || []).some((candidate) => candidate.id === decision.policyRef)) fail('DECISION_POLICY_UNRESOLVED', entry.id)
}
for (const entry of methodsIndex.policies || []) {
  const file = path.resolve(root, entry.path || '')
  const guide = path.resolve(root, entry.guide || '')
  if (!file.startsWith(`${path.join(root, 'knowledge/v0.1/policies')}${path.sep}`) || !fs.existsSync(file)) { fail('POLICY_ENTRY_PATH', entry.id || 'missing id'); continue }
  if (!guide.startsWith(`${path.join(root, 'knowledge/v0.1/policies')}${path.sep}`) || !fs.existsSync(guide) || !hasGuide(guide)) fail('POLICY_HUMAN_GUIDE_MISSING', entry.id)
  const policy = read(file)
  if (policy.schema !== 'brand-decision-policy/v0.1' || policy.id !== entry.id || !policy.sourceStrategy?.minimumForGlobal || !policy.exceptionRule || !policy.fallback || !policy.caseRefs?.length) fail('POLICY_ENTRY_INCOMPLETE', entry.id)
  if (!Array.isArray(policy.decisionSequence) || policy.decisionSequence.length < 4 || new Set(policy.decisionSequence.map((step) => step.id)).size !== policy.decisionSequence.length || policy.decisionSequence.some((step) => !step.id || !step.title || !step.question || !step.rule || !step.output)) fail('POLICY_DECISION_SEQUENCE_INCOMPLETE', entry.id)
  for (const caseId of policy.caseRefs || []) if (!(methodsIndex.cases || []).some((candidate) => candidate.id === caseId)) fail('POLICY_CASE_UNRESOLVED', `${entry.id}: ${caseId}`)
}
const componentSource = read(path.join(root, index.componentSource))
const components = new Set(componentSource.components.map((item) => item.name))
const scenarios = new Map()
const recipes = new Map()

if (index.schema !== 'dangoui-knowledge-index/v0.1') fail('KNOWLEDGE_INDEX_SCHEMA', 'Unexpected knowledge index schema.')
for (const name of index.components || []) if (!components.has(name)) fail('KNOWLEDGE_COMPONENT_UNRESOLVED', name)
for (const entry of index.brandRecipes || []) {
  const file = path.resolve(root, entry.path || '')
  if (!file.startsWith(`${path.join(root, 'public/brand-registry')}${path.sep}`) || !fs.existsSync(file)) { fail('KNOWLEDGE_RECIPE_PATH', entry.id || 'missing id'); continue }
  const recipe = read(file)
  if (recipes.has(entry.id) || recipe.schema !== 'brand-role-style-recipes/v0.1') fail('KNOWLEDGE_RECIPE_SCHEMA', entry.id)
  if (!/^https:\/\//.test(recipe.source || '')) fail('KNOWLEDGE_RECIPE_SOURCE', entry.id)
  if (!Array.isArray(recipe.shapeRoles) || !recipe.shapeRoles.length) fail('KNOWLEDGE_RECIPE_EMPTY', entry.id)
  for (const role of recipe.shapeRoles || []) {
    if (!components.has(role.component) || !role.cssVariable?.startsWith('--style-') || !/^\d+(?:\.\d+)?px$/.test(role.trialValue || '') || !role.evidenceStatus) fail('KNOWLEDGE_RECIPE_ROLE', `${entry.id}: ${role.id}`)
  }
  recipes.set(entry.id, recipe)
}
for (const entry of index.scenarios || []) {
  const file = path.resolve(root, entry.path || '')
  if (!file.startsWith(`${path.join(root, 'public/knowledge')}${path.sep}`) || !fs.existsSync(file)) { fail('KNOWLEDGE_SCENARIO_PATH', entry.id || 'missing id'); continue }
  const scene = read(file)
  if (scene.id !== entry.id || scene.schema !== 'dangoui-scenario/v0.1' || scenarios.has(scene.id)) fail('KNOWLEDGE_SCENARIO_ID', entry.id)
  if (!['pilot-candidate', 'validated', 'approved'].includes(scene.status)) fail('KNOWLEDGE_SCENARIO_STATUS', entry.id)
  for (const key of ['userJob', 'suitableFor', 'notFor', 'requiredStates', 'requiredRegions', 'componentRefs', 'invariants', 'sourceCases']) {
    if (!scene[key] || (Array.isArray(scene[key]) && !scene[key].length)) fail('KNOWLEDGE_SCENARIO_INCOMPLETE', `${entry.id}: ${key}`)
  }
  for (const name of scene.componentRefs || []) if (!index.components.includes(name) || !components.has(name)) fail('KNOWLEDGE_SCENARIO_COMPONENT', `${entry.id}: ${name}`)
  for (const id of scene.brandRecipeRefs || []) if (!recipes.has(id)) fail('KNOWLEDGE_SCENARIO_RECIPE', `${entry.id}: ${id}`)
  if (!Array.isArray(scene.requiredComponentRefs) || !scene.requiredComponentRefs.length || scene.requiredComponentRefs.some((name) => !scene.componentRefs.includes(name))) fail('KNOWLEDGE_REQUIRED_COMPONENTS_INVALID', entry.id)
  const examples = scene.exampleRefs || {}
  for (const key of ['expressiveSource', 'productiveSource']) {
    if (!/^https:\/\//.test(examples[key] || '')) fail('KNOWLEDGE_EXAMPLE_SOURCE_MISSING', `${entry.id}: ${key}`)
  }
  if (!examples.approvedPatternId || !examples.existingRuntimeDemoRoute || !examples.componentExperimentRoute || examples.componentExperimentStatus !== 'runtime-consumed-not-visually-approved') fail('KNOWLEDGE_EXAMPLE_BOUNDARY_MISSING', entry.id)
  scenarios.set(entry.id, scene)
}

const planPath = flag('--plan')
const requiredId = flag('--require-scenario')
if (requiredId && !scenarios.has(requiredId)) fail('KNOWLEDGE_REQUIRED_SCENARIO_UNKNOWN', requiredId)
if (planPath) {
  const file = path.resolve(planPath)
  const plan = read(file)
  const brandModPath = flag('--brand-mod')
  const mod = brandModPath ? read(path.resolve(brandModPath)) : null
  for (const option of plan.options || []) {
    if (option.disposition === 'rejected') continue
    const binding = option.scenarioBinding
    if (!binding) { if (requiredId) fail('SCENARIO_BINDING_REQUIRED', requiredId, option.id); continue }
    const scene = scenarios.get(binding.id)
    if (!scene || (requiredId && binding.id !== requiredId)) { fail('SCENARIO_BINDING_UNKNOWN', binding.id || '', option.id); continue }
    if (scene.status !== 'approved' && binding.claimedStatus === 'approved') fail('SCENARIO_PREMATURE_APPROVAL', scene.id, option.id)
    if (!binding.hostJob || !binding.hostContext) fail('SCENARIO_HOST_CONTEXT_REQUIRED', scene.id, option.id)
    for (const name of scene.requiredComponentRefs) if (!(binding.componentRefs || []).includes(name)) fail('SCENARIO_COMPONENT_UNBOUND', name, option.id)
    for (const name of binding.componentRefs || []) if (!scene.componentRefs.includes(name)) fail('SCENARIO_COMPONENT_UNEXPECTED', name, option.id)
    for (const state of scene.requiredStates) if (!(binding.stateEvidence || []).includes(state)) fail('SCENARIO_STATE_UNBOUND', state, option.id)
    const preview = option.previewEvidence?.path || ''
    const direct = path.resolve(path.dirname(file), preview)
    const htmlFile = fs.existsSync(direct) ? direct : path.resolve(path.dirname(file), '..', preview)
    if (!preview || path.extname(htmlFile) !== '.html' || !fs.existsSync(htmlFile)) { fail('SCENARIO_H5_MISSING', preview, option.id); continue }
    const html = fs.readFileSync(htmlFile, 'utf8')
    const regionNames = [...html.matchAll(/data-scenario-region=["']([^"']+)["']/g)].map((match) => match[1])
    for (const region of scene.requiredRegions) if (!regionNames.includes(region)) fail('SCENARIO_RENDERED_REGION_MISSING', region, option.id)
    const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]).join('\n')
    const withoutDefinitions = styles.replace(/:root\s*\{[^}]*\}/g, '')
    if (/#[0-9a-f]{3,8}\b/i.test(withoutDefinitions)) fail('SCENARIO_RAW_COLOR', 'Use mapped CSS variables in H5 rules, not copied hex literals.', option.id)
    if (mod) {
      const mapped = mod.tokens?.mapped || {}
      const rootBlock = styles.match(/:root\s*\{([^}]*)\}/)?.[1] || ''
      for (const [name, token] of Object.entries(mapped)) {
        const used = styles.includes(`var(${name})`)
        if (!used) continue
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const actual = rootBlock.match(new RegExp(`${escaped}\\s*:\\s*(#[0-9a-f]{3,8})`, 'i'))?.[1]
        if (!actual || actual.toLowerCase() !== String(token.value).toLowerCase()) fail('SCENARIO_TOKEN_VALUE_DRIFT', name, option.id)
      }
      if (!Object.keys(mapped).some((name) => styles.includes(`var(${name})`))) fail('SCENARIO_TOKEN_NOT_CONSUMED', 'No mapped DangoUI variable is used.', option.id)
    }
  }
}

console.log(JSON.stringify({ ok: failures.length === 0, scenarioCount: scenarios.size, componentCount: index.components.length, brandRecipeCount: recipes.size, failures }, null, 2))
if (failures.length) process.exitCode = 1
