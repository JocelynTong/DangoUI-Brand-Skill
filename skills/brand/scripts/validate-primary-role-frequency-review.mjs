#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function validatePrimaryRoleFrequencyReview(review) {
  if (review?.schema === 'brand-primary-role-frequency-review/v2') return validateGenericReview(review)
  const findings = []
  const fail = (code) => findings.push(code)
  if (review?.schema !== 'brand-primary-role-frequency-review/v1' || !review.brand) fail('REVIEW_SCHEMA')
  if (!['candidate-not-approved', 'approved'].includes(review?.status)) fail('REVIEW_STATUS_INVALID')
  if (review?.policyRef !== 'primary-color-and-cta' || review?.methodRef !== 'cross-page-token-promotion') fail('REUSABLE_DECISION_RULE_UNBOUND')
  const pages = review?.sources || []
  if (!Array.isArray(pages) || pages.length < 2 || new Set(pages.map((page) => page.url)).size !== pages.length || !pages.some((page) => /home/.test(page.pageId || ''))) fail('INDEPENDENT_PAGES_MISSING')
  for (const page of pages) {
    if (!page.url || !page.sourcePriority || !Number.isInteger(page.countedContentActions) || page.countedContentActions < 1 || !Array.isArray(page.styles)) { fail('PAGE_COUNT_MISSING'); continue }
    const sum = page.styles.reduce((total, style) => total + (Number.isInteger(style.count) ? style.count : 0), 0)
    if (sum !== page.countedContentActions || page.styles.some((style) => !style.role || !style.treatment || !style.background || !style.foreground || !Number.isInteger(style.count) || style.count < 1)) fail('PAGE_COUNT_MISMATCH')
    if (!Number.isInteger(page.footerUtilityActions?.count) || page.footerUtilityActions.count < 0 || !page.footerUtilityActions.background || !page.footerUtilityActions.foreground) fail('FOOTER_DISPOSITION_MISSING')
  }
  const countedTotal = pages.reduce((total, page) => total + (page.countedContentActions || 0), 0)
  const styles = pages.flatMap((page) => page.styles || [])
  const black = styles.filter((style) => style.background === 'rgb(0, 0, 0)' && style.foreground === 'rgb(255, 255, 255)').reduce((total, style) => total + style.count, 0)
  const white = styles.filter((style) => style.background === 'rgb(255, 255, 255)' && style.foreground === 'rgb(0, 0, 0)').reduce((total, style) => total + style.count, 0)
  const footerTotal = pages.reduce((total, page) => total + (page.footerUtilityActions?.count || 0), 0)
  const blackFooter = pages.filter((page) => page.footerUtilityActions?.background === 'rgb(0, 0, 0)' && page.footerUtilityActions?.foreground === 'rgb(255, 255, 255)').reduce((total, page) => total + page.footerUtilityActions.count, 0)
  if (review?.frequencyTotals?.countedTcgContentActions !== countedTotal || review?.frequencyTotals?.blackFillWhiteText !== black || review?.frequencyTotals?.whiteFillBlackText !== white || review?.frequencyTotals?.neutralWhiteOrBlack !== black + white || review?.frequencyTotals?.saturatedFill !== countedTotal - black - white || review?.frequencyTotals?.footerUtilityActions !== footerTotal || review?.frequencyTotals?.blackFooterUtilityActions !== blackFooter) fail('FREQUENCY_TOTAL_MISMATCH')
  if (!review?.samplingMethod || !/exclude/i.test(review.samplingMethod) || !review.samplingMethod.includes('.button__bg') || !review?.identityObservation?.role) fail('SAMPLING_BOUNDARY_MISSING')
  const decision = review?.interpreterDecision
  if (!decision?.brandIdentityPrimary || !decision?.primaryActionSystem || !decision?.orangeDisposition || !decision?.interfaceDominantPalette?.basis || !decision?.approvalBoundary?.currentScope || !decision?.approvalBoundary?.notApproved || !decision?.approvalBoundary?.missingInThisCase?.length) fail('ROLE_DECISION_MISSING')
  if (!Array.isArray(decision?.interfaceDominantPalette?.colors) || decision.interfaceDominantPalette.colors.length < 2 || decision.interfaceDominantPalette.colors.some((color) => !/^#[\dA-F]{6}$/i.test(color))) fail('INTERFACE_PALETTE_INVALID')
  if (!decision?.lightSearchShellCandidate?.targetTokenBackground || !decision?.lightSearchShellCandidate?.targetTokenForeground || !decision?.lightSearchShellCandidate?.scope) fail('DANGOUI_MAPPING_MISSING')
  if (review?.status !== 'candidate-not-approved' && (!review?.stateEvidence?.hover || !review?.stateEvidence?.focus || !review?.visualQA?.approved)) fail('GLOBAL_APPROVAL_UNPROVEN')
  if (!Array.isArray(review?.unresolved) || !review.unresolved.length) fail('UNRESOLVED_BOUNDARY_MISSING')
  return findings
}

// v1 is retained for historical case receipts. New brands use this role-scoped
// contract: arbitrary selectors/colors, an explicit census, and no approval by vote.
function validateGenericReview(review) {
  const findings = new Set()
  const fail = (code) => findings.add(code)
  const nonempty = (value) => typeof value === 'string' && value.trim().length > 0
  const count = (value) => Number.isInteger(value) && value >= 0
  const list = (value) => Array.isArray(value) ? value : []
  const ref = (value) => nonempty(value?.path) && /^[a-f0-9]{64}$/i.test(value?.sha256 || '')
  const key = (style) => JSON.stringify([style?.role, style?.treatment, style?.background, style?.foreground])
  const region = (value) => Number.isFinite(value?.x) && Number.isFinite(value?.y) && value?.width > 0 && value?.height > 0
  if (!nonempty(review.brand)) fail('REVIEW_SCHEMA')
  if (!['candidate-not-approved', 'approved'].includes(review.status)) fail('REVIEW_STATUS_INVALID')
  if (review.policyRef !== 'primary-color-and-cta' || review.methodRef !== 'cross-page-token-promotion') fail('REUSABLE_DECISION_RULE_UNBOUND')
  const pages = list(review.sources)
  if (pages.some((page) => !page || typeof page !== 'object') || pages.some((page) => [...list(page.styles), ...list(page.census?.exclusions), ...list(page.census?.unknowns)].some((item) => !item || typeof item !== 'object')) || list(review.promotions).some((item) => !item || typeof item !== 'object')) return ['REVIEW_RECORD_INVALID']
  if (!pages.length || pages.some((page) => !nonempty(page.url)) || new Set(pages.map((page) => page.url)).size !== pages.length || new Set(pages.map((page) => page.pageId)).size !== pages.length) fail('INDEPENDENT_PAGES_MISSING')
  const totals = new Map()
  let observedTotal = 0, countedTotal = 0, excludedTotal = 0, unknownTotal = 0, unprovenTotal = 0
  for (const page of pages) {
    if (!nonempty(page.pageId) || !nonempty(page.sourcePriority) || !ref(page.evidenceRef)) fail('SOURCE_EVIDENCE_UNBOUND')
    const census = page.census
    const styles = list(page.styles)
    const exclusions = list(census?.exclusions), unknowns = list(census?.unknowns)
    if (!count(census?.observedControls) || !count(census?.countedControls) || !count(census?.aggregateOnlyControls) || !Array.isArray(census?.exclusions) || !Array.isArray(census?.unknowns) || !Array.isArray(page.styles)) fail('PAGE_COUNT_MISSING')
    const dispositions = [...exclusions, ...unknowns]
    if (dispositions.some((item) => !nonempty(item.reason) || !nonempty(item.role) || !Number.isInteger(item.count) || item.count < 1)) fail('SAMPLING_BOUNDARY_MISSING')
    const excluded = exclusions.reduce((n, item) => n + (count(item.count) ? item.count : 0), 0)
    const unknown = unknowns.reduce((n, item) => n + (count(item.count) ? item.count : 0), 0)
    let summed = 0, proven = 0
    const ids = new Set(), styleKeys = new Set()
    for (const style of styles) {
      if (![style.role, style.treatment, style.background, style.foreground].every(nonempty) || !Number.isInteger(style.count) || style.count < 1 || !Array.isArray(style.observations)) fail('PAGE_COUNT_MISMATCH')
      const signature = key(style)
      if (styleKeys.has(signature)) fail('DUPLICATE_STYLE_GROUP')
      styleKeys.add(signature)
      const observations = list(style.observations)
      if (observations.length > style.count) fail('PAGE_COUNT_MISMATCH')
      for (const observation of observations) {
        if (!observation || typeof observation !== 'object') { fail('CONTROL_PROOF_INCOMPLETE'); continue }
        if (!nonempty(observation.id) || ids.has(observation.id) || !nonempty(observation.selector) || !nonempty(observation.paintSelector) || !nonempty(observation.textSelector) || !region(observation.region) || observation.state !== 'default' || !ref(observation.evidenceRef)) fail('CONTROL_PROOF_INCOMPLETE')
        ids.add(observation.id)
      }
      summed += count(style.count) ? style.count : 0
      proven += observations.length
      totals.set(signature, (totals.get(signature) || 0) + (count(style.count) ? style.count : 0))
    }
    if (summed !== census?.countedControls || census?.observedControls !== summed + excluded + unknown || census?.aggregateOnlyControls !== summed - proven) fail('PAGE_COUNT_MISMATCH')
    if (summed > 0 && proven === 0) fail('CONTROL_PROOF_INCOMPLETE')
    observedTotal += count(census?.observedControls) ? census.observedControls : 0
    countedTotal += summed; excludedTotal += excluded; unknownTotal += unknown; unprovenTotal += summed - proven
  }
  const supplied = review.frequencyTotals
  const groups = list(supplied?.byRoleAndTreatment)
  if (!Array.isArray(supplied?.byRoleAndTreatment) || groups.length !== totals.size || new Set(groups.map(key)).size !== groups.length || groups.some((group) => totals.get(key(group)) !== group?.count) || supplied?.observedControls !== observedTotal || supplied?.countedControls !== countedTotal || supplied?.excludedControls !== excludedTotal || supplied?.unknownControls !== unknownTotal || supplied?.aggregateOnlyControls !== unprovenTotal) fail('FREQUENCY_TOTAL_MISMATCH')
  if (!nonempty(review.sampling?.unit) || !nonempty(review.sampling?.paintLayerMethod) || !nonempty(review.sampling?.scope) || !nonempty(review.identityObservation?.role)) fail('SAMPLING_BOUNDARY_MISSING')
  const decision = review.interpreterDecision
  if (!nonempty(decision?.brandIdentityDecision) || !nonempty(decision?.primaryActionDecision) || !nonempty(decision?.interfacePaletteDecision) || !Array.isArray(decision?.exceptions) || !nonempty(decision?.approvalBoundary?.currentScope) || !Array.isArray(decision?.approvalBoundary?.notApproved) || !Array.isArray(decision?.approvalBoundary?.missingInThisCase)) fail('ROLE_DECISION_MISSING')
  const mappings = list(decision?.mappingCandidates)
  if (!Array.isArray(decision?.mappingCandidates) || mappings.some((mapping) => !nonempty(mapping?.role) || !nonempty(mapping?.targetToken) || !nonempty(mapping?.scope) || !nonempty(mapping?.rationale))) fail('DANGOUI_MAPPING_MISSING')
  if (!Array.isArray(review.unresolved) || review.unresolved.some((item) => !nonempty(item))) fail('UNRESOLVED_BOUNDARY_MISSING')
  if (review.status === 'candidate-not-approved') {
    if (decision?.approvalBoundary?.currentScope === 'global' || !decision?.approvalBoundary?.notApproved?.length || !decision?.approvalBoundary?.missingInThisCase?.length || !review.unresolved?.length || list(review.promotions).length) fail('CANDIDATE_APPROVAL_BOUNDARY_INVALID')
  } else if (review.status === 'approved') {
    const promotions = list(review.promotions)
    if (!promotions.length || !Array.isArray(review.promotions)) fail('GLOBAL_APPROVAL_UNPROVEN')
    for (const promotion of promotions) {
      const urls = list(promotion.sourceUrls)
      const relevant = pages.filter((page) => urls.includes(page.url))
      const rolePages = pages.filter((page) => list(page.styles).some((style) => style.role === promotion.role) || list(page.census?.unknowns).some((item) => item.role === promotion.role))
      if (promotion.scope !== 'global' || !nonempty(promotion.targetToken) || !nonempty(promotion.rationale) || urls.length < 2 || new Set(urls).size !== urls.length || relevant.length !== urls.length || rolePages.some((page) => !urls.includes(page.url)) || promotion.conflictDisposition !== 'no-unresolved-conflict' || !Array.isArray(promotion.unresolved) || promotion.unresolved.length || relevant.some((page) => list(page.census?.unknowns).some((item) => item.role === promotion.role) || list(page.styles).some((style) => style.role === promotion.role && key(style) !== key(promotion)))) fail('GLOBAL_APPROVAL_UNPROVEN')
      const evidence = list(promotion.stateEvidence)
      for (const page of relevant) {
        const matching = list(page.styles).find((style) => key(style) === key(promotion))
        if (!matching?.observations?.length) fail('GLOBAL_APPROVAL_UNPROVEN')
        for (const state of ['default', 'hover', 'focus']) {
          const proof = evidence.find((item) => item?.url === page.url && item?.state === state && item?.role === promotion.role && item?.treatment === promotion.treatment)
          const observation = list(matching?.observations).find((item) => item.id === proof?.observationId)
          if (!proof || !observation || !ref(proof.evidenceRef) || proof.selector !== observation.selector || !region(proof.region) || !nonempty(proof.background) || !nonempty(proof.foreground) || (state === 'default' && key(proof) !== key(promotion)) || proof.contrastPassed !== true) fail('GLOBAL_APPROVAL_UNPROVEN')
        }
      }
      const qa = promotion.visualQA
      if (qa?.approved !== true || !nonempty(qa.reviewer) || !nonempty(review.producer) || qa.reviewer === review.producer || !ref(qa.evidenceRef)) fail('GLOBAL_APPROVAL_UNPROVEN')
    }
  }
  return [...findings]
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const file = process.argv[2]
  if (!file) { process.stderr.write('Usage: validate-primary-role-frequency-review.mjs <review.json>\n'); process.exit(2) }
  const review = JSON.parse(fs.readFileSync(file, 'utf8'))
  const findings = validatePrimaryRoleFrequencyReview(review)
  const status = findings.length ? 'INVALID_REVIEW' : review.status === 'candidate-not-approved' ? 'VALID_CANDIDATE_NOT_APPROVED' : 'VALID_APPROVED_REVIEW'
  process.stdout.write(`${JSON.stringify({ status, findings }, null, 2)}\n`)
  if (findings.length) process.exitCode = 1
}
