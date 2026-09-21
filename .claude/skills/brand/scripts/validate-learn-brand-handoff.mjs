#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const arg = (name, fallback = '') => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1] || fallback }
const root = path.resolve(arg('--root', process.cwd()))
const brand = arg('--brand')
const stage = arg('--stage')
if (!brand || !['evidence', 'interpreter'].includes(stage)) {
  process.stderr.write('Usage: validate-learn-brand-handoff.mjs --brand <brand> --stage <evidence|interpreter> [--root <root>] [--goal-file <path>] [--evidence-file <path>] [--intent-file <path>]\n')
  process.exit(2)
}
const migration = path.join(root, 'migrations', brand)
const read = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null } }
const goal = read(path.resolve(root, arg('--goal-file', path.join(migration, 'goal-contract.json'))))
const evidence = read(path.resolve(root, arg('--evidence-file', path.join(migration, 'brand-evidence.json'))))
const intent = stage === 'interpreter' ? read(path.resolve(root, arg('--intent-file', path.join(migration, 'brand-intent.json')))) : null
const dimensions = goal?.evidencePolicy?.requiredVisualDimensions || ['color', 'typography', 'radius', 'spacing', 'shadow', 'action-color']
const findings = []
const add = (code, dimension, detail) => findings.push({ code, dimension, detail })
if (!goal) add('GOAL_MISSING', null, 'Frozen goal contract is unreadable.')
if (!evidence) add('EVIDENCE_MISSING', null, 'brand-evidence.json is unreadable.')
if (stage === 'interpreter' && !intent) add('INTENT_MISSING', null, 'brand-intent.json is unreadable.')
if (goal?.goalId && evidence?.goalId && goal.goalId !== evidence.goalId) add('GOAL_VERSION_MISMATCH', null, `Evidence ${evidence.goalId} does not match frozen goal ${goal.goalId}.`)
if (stage === 'interpreter' && goal?.goalId && intent?.goalId && goal.goalId !== intent.goalId) add('GOAL_VERSION_MISMATCH', null, `Interpreter ${intent.goalId} does not match frozen goal ${goal.goalId}.`)
if (goal?.brand && goal.brand !== brand || evidence?.brand && evidence.brand !== brand || intent?.brand && intent.brand !== brand) add('BRAND_MISMATCH', null, 'Goal, Evidence and Interpreter must describe the selected brand.')
if (!Array.isArray(dimensions) || dimensions.length === 0 || new Set(dimensions).size !== dimensions.length) add('DIMENSIONS_INVALID', null, 'Required visual dimensions must be a nonempty, unique array.')
const claims = new Map((evidence?.claims || []).filter((item) => item?.id && item.status === 'observed').map((item) => [item.id, item]))
const corePages = (goal?.referencePages || []).filter((item) => item.core !== false).map((item) => item.id)
const coverage = []
for (const dimension of Array.isArray(dimensions) ? dimensions : []) {
  const source = evidence?.dimensionCoverage?.[dimension]
  const ids = source?.claimIds || []
  const validIds = Array.isArray(ids) ? ids.filter((id) => claims.has(id)) : []
  if (!source || !['observed', 'unresolved', 'not-observed', 'unavailable', 'out-of-scope'].includes(source.status)) add('DIMENSION_DISPOSITION_MISSING', dimension, 'Evidence must record a supported status for this dimension.')
  else if (source.status !== 'observed' && source.status !== 'out-of-scope') add('REQUIRED_DIMENSION_UNRESOLVED', dimension, `Evidence status is ${source.status}; a passing handoff cannot claim this dimension is complete.`)
  else if (source.status === 'out-of-scope' && !source.reason) add('OUT_OF_SCOPE_REASON_MISSING', dimension, 'The frozen goal exclusion needs a reason.')
  if (source?.status === 'observed' && (!Array.isArray(ids) || !ids.length || validIds.length !== ids.length)) add('DIMENSION_CLAIMS_INVALID', dimension, 'All claimIds must resolve to observed claims; at least one is required.')
  if (source?.status === 'observed' && goal?.evidencePolicy?.requireVisibleElementProof === true) {
    for (const id of validIds) {
      const claim = claims.get(id)
      const proof = claim?.sourceProof
      if (!claim?.sourceUrl || !claim?.sourcePageId || !proof?.selector || !Array.isArray(proof?.visibleRect) || proof.visibleRect.length !== 4 || proof.visibleRect[2] <= 0 || proof.visibleRect[3] <= 0 || !proof.paintedBackground || !proof.paintedForeground || !proof.state) {
        add('VISIBLE_ELEMENT_PROOF_MISSING', dimension, `${id} needs a source URL, page, DOM selector, nonempty visible rect, painted colors and observed state.`)
      }
    }
  }
  if (source?.status === 'observed' && (!Number.isInteger(source.sourceCount) || source.sourceCount !== ids.length)) add('SOURCE_COUNT_MISMATCH', dimension, 'sourceCount must equal the number of referenced observed claims, not a palette or CSS declaration count.')
  const salience = validIds.filter((id) => claims.get(id)?.salience === 'high' || claims.get(id)?.highSalience === true).length
  const goalRefs = (evidence?.goalCoverage || []).filter((item) => item?.evidenceRefs?.some((id) => validIds.includes(id))).map((item) => item.goalRef)
  coverage.push({ dimension, status: source?.status || 'missing', sourceCount: validIds.length, highSalienceCount: salience, goalRefs })
  if (stage !== 'interpreter' || source?.status === 'out-of-scope') continue
  const decision = intent?.mappingCoverage?.[dimension]
  if (!decision || !['mapped', 'style-only', 'unmapped', 'rejected'].includes(decision.status)) { add('MAPPING_DISPOSITION_MISSING', dimension, 'Interpreter must classify this dimension.'); continue }
  if (!decision.reason || !decision.priorityReason) add('MAPPING_RATIONALE_MISSING', dimension, 'State the decision and priority using task relevance, visible salience, state and source count.')
  if (!Number.isInteger(decision.sourceCount) || decision.sourceCount !== validIds.length) add('MAPPING_SOURCE_COUNT_MISMATCH', dimension, 'Interpreter sourceCount must match upstream observed claim count.')
  if (!Array.isArray(decision.evidenceRefs) || !decision.evidenceRefs.length || decision.evidenceRefs.some((id) => !validIds.includes(id))) add('MAPPING_EVIDENCE_INVALID', dimension, 'Map only referenced observed claims from this source dimension.')
  if (['mapped', 'style-only'].includes(decision.status) && !(decision.targetToken || decision.targetComponent || decision.styleRecipe)) add('MAPPING_TARGET_MISSING', dimension, 'Mapped/style-only dimensions require an explicit DangoUI target or scoped recipe.')
  if (decision.targetToken && corePages.length > 1) {
    const review = decision.crossPageReview
    const rows = review?.observations || []
    if (!review || !Array.isArray(rows) || !review.rationale || !review.scope || !review.conflictDisposition) add('TOKEN_CROSS_PAGE_REVIEW_MISSING', dimension, 'A token target needs a cross-page role comparison, scope and conflict disposition.')
    else {
      for (const pageId of corePages) {
        const row = rows.find((item) => item.pageId === pageId)
        if (!row || (!row.unavailableReason && (!Array.isArray(row.evidenceRefs) || !row.evidenceRefs.length))) add('TOKEN_CORE_PAGE_UNREVIEWED', dimension, `Core page ${pageId} needs observed claim refs or an unavailable reason.`)
        else if (row.evidenceRefs?.some((id) => !claims.has(id) || (claims.get(id).sourcePageId || claims.get(id).pageId) !== pageId)) add('TOKEN_PAGE_EVIDENCE_INVALID', dimension, `Core page ${pageId} must cite observed claims from that same page.`)
      }
      if (review.scope === 'global' && (review.conflictDisposition !== 'aligned' || rows.some((item) => item.unavailableReason))) add('TOKEN_GLOBAL_SCOPE_UNPROVEN', dimension, 'Global scope needs aligned observed core pages without unavailable pages or unresolved conflicts.')
      if (review.scope === 'global' && ['color', 'action-color'].includes(dimension)) {
        const expectedRole = dimension === 'color' ? 'brand-primary' : 'primary-action'
        if (review.policyRef !== 'primary-color-and-cta' || review.roleKind !== expectedRole || !['same', 'different', 'unresolved'].includes(review.brandPrimaryRelation)) {
          add('PRIMARY_COLOR_POLICY_UNBOUND', dimension, 'Global color decisions must cite the primary-color policy, name the role, and explicitly state whether brand-primary and primary-action are related.')
        }
        const observedRows = rows.filter((item) => !item.unavailableReason)
        if (observedRows.some((item) => !Number.isInteger(item.visibleControlCount) || item.visibleControlCount < 1 || !Number.isInteger(item.excludedControlCount) || item.excludedControlCount < 0 || !item.sourcePriority || !item.salience)) {
          add('PRIMARY_ROLE_FREQUENCY_UNRECORDED', dimension, 'Each global color-role comparison needs per-page visible and excluded control counts, source priority and salience; frequency supports a scoped decision but does not approve it alone.')
        }
        const roles = new Set(observedRows.map((item) => item.semanticRole).filter(Boolean))
        if (observedRows.length < 2 || roles.size !== 1 || observedRows.some((item) => !item.semanticRole)) {
          add('PRIMARY_ACTION_ROLE_MISMATCH', dimension, 'Global color needs at least two independent pages observing the same semantic role; campaign CTA and database Search are not interchangeable.')
        }
        if (observedRows.some((row) => row.evidenceRefs?.some((id) => claims.get(id)?.semanticRole !== row.semanticRole))) {
          add('TOKEN_SEMANTIC_ROLE_UNTRACED', dimension, 'The compared semantic role must be recorded on the upstream observed claim, not invented only in the Interpreter review.')
        }
        if (observedRows.some((item) => !['default', 'hover', 'focus'].every((state) => item.states?.includes(state)))) {
          add('PRIMARY_ACTION_STATES_UNOBSERVED', dimension, 'Each compared page must observe default, hover and focus states before a global color is approved.')
        }
        if (observedRows.some((row) => ['default', 'hover', 'focus'].some((state) => !row.evidenceRefs?.some((id) => claims.get(id)?.states?.includes(state))))) {
          add('TOKEN_STATES_UNTRACED', dimension, 'Default, hover and focus must be traceable to upstream observed claims, not only listed in the Interpreter review.')
        }
        if (dimension === 'color' && !observedRows.some((item) => item.pageId === 'home' && item.identitySource === true)) {
          add('BRAND_PRIMARY_IDENTITY_SOURCE_MISSING', dimension, 'A global brand-primary needs a current identity-bearing homepage observation, not only a task-page sample.')
        }
      }
    }
  }
  if (['unmapped', 'rejected'].includes(decision.status)) add('REQUIRED_DIMENSION_NOT_CARRIED', dimension, 'A required observed dimension may not be reported as completed without a target; return for a scoped decision or explicitly exclude it in the frozen goal.')
}
coverage.sort((a, b) => b.goalRefs.length - a.goalRefs.length || b.highSalienceCount - a.highSalienceCount || b.sourceCount - a.sourceCount || a.dimension.localeCompare(b.dimension))
const report = { schema: 'learn-brand-handoff-gate/v1', brand, stage, status: findings.length ? 'BLOCKED' : 'PASS', requiredDimensions: dimensions, priorityReviewOrder: coverage, findings }
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
if (findings.length) process.exitCode = 1
