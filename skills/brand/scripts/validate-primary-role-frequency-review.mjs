#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function validatePrimaryRoleFrequencyReview(review) {
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

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const file = process.argv[2]
  if (!file) { process.stderr.write('Usage: validate-primary-role-frequency-review.mjs <review.json>\n'); process.exit(2) }
  const review = JSON.parse(fs.readFileSync(file, 'utf8'))
  const findings = validatePrimaryRoleFrequencyReview(review)
  const status = findings.length ? 'INVALID_REVIEW' : review.status === 'candidate-not-approved' ? 'VALID_CANDIDATE_NOT_APPROVED' : 'VALID_APPROVED_REVIEW'
  process.stdout.write(`${JSON.stringify({ status, findings }, null, 2)}\n`)
  if (findings.length) process.exitCode = 1
}
