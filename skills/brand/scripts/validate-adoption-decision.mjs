#!/usr/bin/env node
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const types = new Set(['token', 'asset', 'component', 'composition'])
const scopes = ['observation', 'component', 'scenario', 'page', 'global']
const required = {
  token: ['semanticRole', 'stateSet', 'contrast', 'targetTokenMapping'],
  asset: ['sourceAndRights', 'subjectAndCrop', 'sceneFit', 'noFakeBusinessData'],
  component: ['behaviorAndStates', 'dangouiCapability', 'hostInteractionPreservation'],
  composition: ['contentHierarchy', 'taskPath', 'expressiveProductiveBoundary', 'responsiveBehavior']
}

export function validateAdoptionDecision(item) {
  const failures = []
  const fail = (code) => failures.push(code)
  if (item.schema !== 'brand-adoption-decision/v0.1' || !item.id || !types.has(item.subjectType)) fail('DECISION_SCHEMA')
  if (!item.subject || !item.sourcePurpose || !item.requestedRole || !Array.isArray(item.sourceRefs) || !item.sourceRefs.length) fail('DECISION_PROVENANCE')
  if (!scopes.includes(item.requestedScope) || !scopes.includes(item.grantedScope)) fail('DECISION_SCOPE')
  if (!['candidate', 'blocked', 'approved', 'deprecated'].includes(item.status)) fail('DECISION_STATUS')
  for (const key of ['provenance', 'sameRoleCrossPage', 'scopeFit', 'independentVisualQA']) if (!item.commonChecks?.[key]) fail(`DECISION_COMMON_${key}`)
  for (const key of required[item.subjectType] || []) if (!item.specificChecks?.[key]) fail(`DECISION_SPECIFIC_${key}`)
  if (item.status !== 'approved' && item.grantedScope !== 'observation') fail('DECISION_UNAPPROVED_REUSE')
  if (item.status === 'approved') {
    if (scopes.indexOf(item.grantedScope) > scopes.indexOf(item.requestedScope)) fail('DECISION_SCOPE_OVERREACH')
    if (!item.reviewer || !item.reviewedAt || !item.approvalEvidence?.length) fail('DECISION_APPROVAL_MISSING')
    if (Object.values(item.commonChecks || {}).some((value) => value !== 'pass')) fail('DECISION_COMMON_NOT_PASSED')
    if (Object.values(item.specificChecks || {}).some((value) => value !== 'pass')) fail('DECISION_SPECIFIC_NOT_PASSED')
    if (item.missingEvidence?.length) fail('DECISION_EVIDENCE_GAP')
    if (item.subjectType === 'token' && /primary|cta/i.test(item.requestedRole || '') && item.grantedScope === 'global') {
      const comparison = item.pageStateComparison || []
      const independent = new Set(comparison.map((page) => page.url))
      if (independent.size < 2 || !comparison.some((page) => page.identitySource === true)) fail('PRIMARY_COLOR_CROSS_PAGE_REQUIRED')
      if (comparison.some((page) => !page.role || !Array.isArray(page.states) || ['default', 'hover', 'focus'].some((state) => !page.states.includes(state)))) fail('PRIMARY_COLOR_ROLE_STATE_INCOMPLETE')
      if (new Set(comparison.map((page) => page.role)).size !== 1) fail('PRIMARY_COLOR_ROLE_MISMATCH')
      if (!item.policyRef || item.policyRef !== 'primary-color-and-cta') fail('PRIMARY_COLOR_POLICY_UNBOUND')
    }
  }
  return failures
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = process.argv[2]
  if (!file) { console.error('Usage: validate-adoption-decision.mjs <decision.json>'); process.exit(2) }
  const failures = validateAdoptionDecision(JSON.parse(fs.readFileSync(file, 'utf8')))
  console.log(JSON.stringify({ ok: failures.length === 0, failures }, null, 2))
  if (failures.length) process.exitCode = 1
}
