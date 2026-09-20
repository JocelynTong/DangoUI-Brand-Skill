import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { validateAdoptionDecision } from './validate-adoption-decision.mjs'
import { validateDecisionCase, validateCaseRule, validateDecisionQuestion } from './validate-case-flywheel.mjs'

const scripts = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(scripts, '../../..')
const validate = path.join(scripts, 'validate-design-knowledge.mjs')
const query = path.join(scripts, 'query-design-knowledge.mjs')
const brandMod = path.join(root, 'public/brand-registry/v0.1/brands/pokemon-tcg-official/0.2.0/brand-mod.json')
const run = (script, args = []) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })

test('catalog resolves canonical components and classified decision topics', () => {
  const audit = run(validate)
  assert.equal(audit.status, 0, audit.stderr || audit.stdout)
  const list = JSON.parse(run(query, ['list']).stdout)
  assert.ok(list.questions.includes('expressive-productive-allocation-question'))
  assert.ok(list.questions.includes('host-acceptance'))
  const question = JSON.parse(run(query, ['question', 'expressive-productive-allocation-question']).stdout)
  assert.deepEqual(question.caseRefs, ['pokemon-backup4-expressive-false-positive'])
  assert.match(question.humanGuide, /一个历史反例/)
  assert.deepEqual(list.patterns, ['search-filter-results'])
  assert.deepEqual(list.decisions, ['pokemon-database-search-orange'])
  assert.deepEqual(list.policies, ['primary-color-and-cta'])
  const policy = JSON.parse(run(query, ['policy', 'primary-color-and-cta']).stdout)
  assert.match(policy.humanGuide, /先比较，再命名/)
  assert.deepEqual(policy.decisionSequence.map((step) => step.id), ['separate-roles', 'compare-sources', 'name-system', 'bound-exceptions', 'map-and-approve'])
  assert.match(policy.humanGuide, /界面色系候选/)
  assert.match(policy.humanGuide, /局部检查和完整品牌检查必须并列显示/)
  assert.match(policy.evidenceHandoff.aggregateVsControl, /selector/)
  assert.match(policy.evidenceHandoff.scopeSeparation, /scoped PASS/)
  const decision = JSON.parse(run(query, ['decision', 'pokemon-database-search-orange']).stdout)
  assert.equal(decision.status, 'blocked')
  assert.equal(decision.grantedScope, 'observation')
  assert.match(decision.humanGuide, /阻断全局晋级/)
  const pattern = JSON.parse(run(query, ['pattern', 'search-filter-results']).stdout)
  assert.equal(pattern.status, 'pilot-candidate')
  assert.match(pattern.humanGuide, /任务 pattern/)
  assert.deepEqual(pattern.negativeCases, ['pokemon-database-orange-not-global-cta'])
  assert.deepEqual(list.scenarios, ['search-filter-results'])
  assert.ok(list.methods.includes('expressive-productive-allocation'))
  assert.ok(list.methods.includes('expressive-generation-and-reconstruction'))
  assert.ok(list.cases.includes('pokemon-backup4-expressive-false-positive'))
  assert.ok(list.cases.includes('pokemon-database-orange-not-global-cta'))
  assert.ok(list.cases.includes('pokemon-generated-deck-scenes'))
  assert.ok(list.rules.includes('expressive-continuity-in-real-content'))
  assert.ok(list.rules.includes('prefer-reconstructible-dynamic-scenes'))
  const classified = JSON.parse(fs.readFileSync(path.join(root, 'knowledge/v0.1/index.json'), 'utf8'))
  assert.deepEqual(classified.decisionTopics.map((topic) => topic.id), ['expressive-productive', 'brand-evidence-to-design', 'host-expressive-delivery'])
  const guide = fs.readFileSync(path.join(root, 'public/knowledge/guide.html'), 'utf8')
  assert.match(guide, /id="decision-directory"/)
  assert.match(guide, /href="#primary-color-and-cta"/)
  assert.match(guide, /id="primary-color-and-cta"/)
  assert.match(guide, /topic-section-host-expressive-delivery/)
  const allocation = JSON.parse(run(query, ['method', 'expressive-productive-allocation']).stdout)
  assert.equal(allocation.ownerRole, 'Host Strategist / Brand Application Designer / Design Director')
  assert.deepEqual(allocation.caseRefs, ['pokemon-backup4-expressive-false-positive'])
  assert.match(allocation.humanGuide, /交接机制/)
  assert.equal(JSON.parse(run(query, ['case', 'pokemon-backup4-expressive-false-positive']).stdout).reviewStatus, 'not-approved')
  assert.equal(JSON.parse(run(query, ['rule', 'expressive-continuity-in-real-content']).stdout).status, 'candidate')
  assert.equal(JSON.parse(run(query, ['method', 'source-selection']).stdout).ownerRole, 'Evidence Agent')
  assert.match(JSON.parse(run(query, ['method', 'source-selection']).stdout).humanGuide, /先决定看哪些页面/)
  assert.equal(JSON.parse(run(query, ['case', 'pokemon-database-orange-not-global-cta']).stdout).reviewStatus, 'not-approved')
  assert.equal(JSON.parse(run(query, ['case', 'pokemon-database-orange-not-global-cta']).stdout).sameCaseFollowUp.independentCase, false)
  assert.deepEqual(list.brandRecipes, ['pokemon-database-shape-roles'])
  const recipe = JSON.parse(run(query, ['recipe', 'pokemon-database-shape-roles']).stdout)
  assert.equal(recipe.status, 'visual-trial-not-approved')
  assert.equal(recipe.shapeRoles.find((role) => role.id === 'query-field').trialValue, '3px')
  assert.ok(JSON.parse(run(query, ['component', 'Search']).stdout).component)
})

test('global knowledge entry is independent of the current variant URL', () => {
  const app = fs.readFileSync(path.join(root, 'src/App.vue'), 'utf8')
  assert.match(app, /href="\/knowledge\/guide\.html"/)
  assert.doesNotMatch(app, /href="\.\/knowledge\/guide\.html"/)
})

test('role-matched action evidence stays scoped and visible in the before-after review', () => {
  const migration = path.join(root, 'migrations/pokemon-tcg-official')
  const evidence = JSON.parse(fs.readFileSync(path.join(migration, 'content-discovery-action-evidence-2026-09-20.json'), 'utf8'))
  const interpretation = JSON.parse(fs.readFileSync(path.join(migration, 'content-discovery-action-interpretation-2026-09-20.json'), 'utf8'))
  const html = fs.readFileSync(path.join(root, 'public/knowledge/token-debug.html'), 'utf8')
  assert.deepEqual(evidence.samples.map((sample) => sample.pageId), ['home', 'learn', 'product-guide'])
  assert.ok(evidence.samples.every((sample) => sample.matchCount === 1 && sample.state === 'default' && sample.paintedBackground === 'rgb(0, 0, 0)'))
  assert.equal(interpretation.status, 'ROLE_SCOPED_CANDIDATE_NOT_APPROVED')
  assert.ok(interpretation.decision.notPromotedTo.includes('database Search action treatment'))
  assert.match(html, /同一种按钮放在一起比/)
  assert.match(html, /搜索提交：仍未定/)
  assert.match(html, /data-acceptance-before/)
  assert.match(html, /data-acceptance-after/)
})

test('case flywheel preserves decision provenance and blocks one-case rule approval', () => {
  const caseRecord = JSON.parse(fs.readFileSync(path.join(root, 'knowledge/v0.1/cases/pokemon-backup4-expressive-false-positive.json'), 'utf8'))
  const rule = JSON.parse(fs.readFileSync(path.join(root, 'knowledge/v0.1/rules/expressive-continuity-in-real-content.json'), 'utf8'))
  const cases = new Map([[caseRecord.id, caseRecord]])
  const question = JSON.parse(fs.readFileSync(path.join(root, 'knowledge/v0.1/questions/expressive-productive-allocation.json'), 'utf8'))
  const methods = new Set(['expressive-productive-allocation'])
  const rules = new Map([[rule.id, rule]])
  assert.deepEqual(validateDecisionQuestion(question, methods, cases, rules), [])
  assert.ok(validateDecisionQuestion({ ...question, caseRefs: [caseRecord.id, caseRecord.id] }, methods, cases, rules).includes('DECISION_QUESTION_CASE_SCOPE_INVALID'))
  assert.ok(validateDecisionQuestion({ ...question, caseRefs: ['pokemon-database-orange-not-global-cta'] }, methods, cases, rules).includes('DECISION_QUESTION_CASE_SCOPE_INVALID'))
  cases.set('same-run-alternative', { ...caseRecord, id: 'same-run-alternative' })
  assert.ok(validateDecisionQuestion({ ...question, caseRefs: [caseRecord.id, 'same-run-alternative'] }, methods, cases, rules).includes('DECISION_QUESTION_CASE_INDEPENDENCE_INVALID'))
  assert.deepEqual(validateDecisionCase(caseRecord), [])
  assert.deepEqual(validateCaseRule(rule, cases), [])
  assert.ok(validateDecisionCase({ ...caseRecord, decisionTrace: { ...caseRecord.decisionTrace, alternatives: [] } }).includes('CASE_ALTERNATIVES_AND_TRADEOFFS_MISSING'))
  assert.ok(validateCaseRule({ ...rule, status: 'approved', reviewer: 'Design Director', reviewedAt: '2026-09-20' }, cases).includes('CASE_RULE_CROSS_CASE_VALIDATION_MISSING'))
  assert.ok(validateCaseRule({ ...rule, originCaseIds: ['unknown-case'] }, cases).includes('CASE_RULE_ORIGIN_UNPROVEN'))
  const approved = (id, contextKey) => ({ ...caseRecord, id, contextKey, reviewStatus: 'approved', decisionTrace: { ...caseRecord.decisionTrace, feedback: { ...caseRecord.decisionTrace.feedback, status: 'approved-aesthetic-outcome' } }, reviewEvidence: { independentQA: `qa-${id}`, userVisualApproval: `user-${id}` } })
  cases.set('positive-a', approved('positive-a', 'other-brand|host-a'))
  cases.set('positive-b', approved('positive-b', 'other-brand|host-b'))
  const approvedRule = { ...rule, status: 'approved', independentPositiveCaseIds: ['positive-a', 'positive-b'], reviewer: 'Design Director', reviewedAt: '2026-09-20', revisionHistory: [...rule.revisionHistory.slice(0, -1), { ...rule.revisionHistory.at(-1), status: 'approved' }] }
  assert.deepEqual(validateCaseRule(approvedRule, cases), [])
  cases.set('positive-b', approved('positive-b', 'other-brand|host-a'))
  assert.ok(validateCaseRule(approvedRule, cases).includes('CASE_RULE_CONTEXT_DIVERSITY_MISSING'))
})

test('adoption gate prevents a blocked local observation from becoming global', () => {
  const record = JSON.parse(fs.readFileSync(path.join(root, 'knowledge/v0.1/decisions/pokemon-database-search-orange.json'), 'utf8'))
  assert.deepEqual(validateAdoptionDecision(record), [])
  assert.ok(validateAdoptionDecision({ ...record, grantedScope: 'global' }).includes('DECISION_UNAPPROVED_REUSE'))
  assert.ok(validateAdoptionDecision({ ...record, status: 'approved', grantedScope: 'global' }).includes('DECISION_APPROVAL_MISSING'))
  assert.ok(validateAdoptionDecision({ ...record, subjectType: 'asset' }).includes('DECISION_SPECIFIC_sourceAndRights'))
  const proposedApproval = {
    ...record, status: 'approved', grantedScope: 'global', reviewer: 'Design Director', reviewedAt: '2026-09-20',
    pageStateComparison: [{ ...record.pageStateComparison.find((page) => page.role === 'database-search') }],
    approvalEvidence: ['fresh-visual-qa'], missingEvidence: [],
    commonChecks: Object.fromEntries(Object.keys(record.commonChecks).map((key) => [key, 'pass'])),
    specificChecks: Object.fromEntries(Object.keys(record.specificChecks).map((key) => [key, 'pass']))
  }
  assert.ok(validateAdoptionDecision(proposedApproval).includes('PRIMARY_COLOR_CROSS_PAGE_REQUIRED'))
  proposedApproval.pageStateComparison.push({ url: 'https://example.com/brand-home', context: 'identity', role: 'primary-action', states: ['default'], identitySource: true })
  assert.ok(validateAdoptionDecision(proposedApproval).includes('PRIMARY_COLOR_ROLE_MISMATCH'))
  proposedApproval.pageStateComparison[0].role = 'primary-action'
  assert.ok(validateAdoptionDecision(proposedApproval).includes('PRIMARY_COLOR_ROLE_STATE_INCOMPLETE'))
  for (const page of proposedApproval.pageStateComparison) page.states = ['default', 'hover', 'focus']
  assert.deepEqual(validateAdoptionDecision(proposedApproval), [])
})

test('pilot rejects missing binding, then accepts mapped token and required regions', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dango-knowledge-'))
  try {
    const planFile = path.join(dir, 'plan.json')
    const htmlFile = path.join(dir, 'direction.html')
    const plan = { options: [{ id: 'pilot', previewEvidence: { path: 'direction.html' } }] }
    fs.writeFileSync(planFile, JSON.stringify(plan))
    let audit = JSON.parse(run(validate, ['--plan', planFile, '--require-scenario', 'search-filter-results']).stdout)
    assert.ok(audit.failures.some((item) => item.code === 'SCENARIO_BINDING_REQUIRED'))

    plan.options[0].scenarioBinding = {
      id: 'search-filter-results', hostJob: '查找卡组', hostContext: '动态检索结果',
      componentRefs: ['Search', 'Input', 'Tag', 'Button', 'Card'],
      stateEvidence: ['initial', 'loading', 'results', 'empty', 'error']
    }
    fs.writeFileSync(planFile, JSON.stringify(plan))
    fs.writeFileSync(htmlFile, '<style>:root{--du-bg-1:#FFFFFF}.screen{background:var(--du-bg-1)}</style><div data-scenario-region="query"></div><div data-scenario-region="filters"></div><div data-scenario-region="feedback"></div><div data-scenario-region="results"></div>')
    audit = JSON.parse(run(validate, ['--plan', planFile, '--require-scenario', 'search-filter-results', '--brand-mod', brandMod]).stdout)
    assert.equal(audit.ok, true, JSON.stringify(audit.failures))

    fs.writeFileSync(htmlFile, fs.readFileSync(htmlFile, 'utf8').replace('var(--du-bg-1)', '#ffffff'))
    audit = JSON.parse(run(validate, ['--plan', planFile, '--require-scenario', 'search-filter-results', '--brand-mod', brandMod]).stdout)
    assert.ok(audit.failures.some((item) => item.code === 'SCENARIO_RAW_COLOR'))
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
