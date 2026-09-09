/**
 * Shared layout contract for the standard learn-brand demo.
 *
 * This deliberately describes the user-facing mockup, not the renderer's
 * internal component tree.  A schema/DOM match is not enough if the phone
 * frame was dropped or a long page is trapped behind an unscrollable shell.
 */

export const PREVIEW_BLOCKER_CODES = Object.freeze({
  MOCKUP_SHELL_MISSING: 'MOCKUP_SHELL_MISSING',
  MULTI_MODULE_PAGE_SECTIONS_MISSING: 'MULTI_MODULE_PAGE_SECTIONS_MISSING',
  PAGE_NOT_SCROLLABLE: 'PAGE_NOT_SCROLLABLE',
  PAGE_SCROLL_NOT_RESTORED: 'PAGE_SCROLL_NOT_RESTORED',
  PAGE_SCROLL_EMPTY_CONTENT: 'PAGE_SCROLL_EMPTY_CONTENT',
  HOME_INDICATOR_OPAQUE_FOOTER: 'HOME_INDICATOR_OPAQUE_FOOTER',
  BRAND_ICON_CROPPED: 'BRAND_ICON_CROPPED',
  BRAND_LABEL_WRAPPED: 'BRAND_LABEL_WRAPPED',
})

function sourceSections(sourceEvidence, preview) {
  const candidates = [
    sourceEvidence?.sourceEvidence?.sections,
    sourceEvidence?.brandEvidence?.sourceEvidence?.sections,
    sourceEvidence?.siteEvidence?.sections,
    sourceEvidence?.sections,
    preview?.sourceEvidence?.sections,
  ]
  return candidates.find((value) => Array.isArray(value)) || []
}

const sourceEvidenceText = (sourceEvidence, page, preview) => {
  const candidates = [
    sourceEvidence,
    preview?.sourceEvidence,
    page?.sourceEvidence,
    page?.evidence,
    page?.layoutRecipe,
    page?.description,
  ].filter(Boolean)

  try {
    return JSON.stringify(candidates)
  } catch {
    return ''
  }
}

/**
 * Infer whether a page represents a long/multi-module source or target.
 * Explicit `scrollRequired: true` is supported for future previews, while a
 * false value cannot opt out when evidence already proves multiple modules.
 */
export function getScrollContract({ page, preview, sourceEvidence } = {}) {
  const reasons = []
  const sectionCount = Array.isArray(page?.sections) ? page.sections.length : 0

  if (page?.scrollRequired === true) reasons.push('page.scrollRequired=true')
  if (sectionCount >= 2) reasons.push(`target has ${sectionCount} schema sections`)

  const sourceSectionList = sourceSections(sourceEvidence, preview)
  if (sourceSectionList.length >= 2) {
    reasons.push(`source evidence has ${sourceSectionList.length} sections`)
  }

  const evidenceText = sourceEvidenceText(sourceEvidence, page, preview)
  if (/full[ -]?page|long[ -]?page|multi[ -]?module|long page|长页|多模块/i.test(evidenceText)) {
    reasons.push('source/target evidence describes a long or multi-module page')
  }

  return {
    required: reasons.length > 0,
    reasons,
    sectionCount,
    sourceSectionCount: sourceSectionList.length,
  }
}

export function hasRequiredSectionCount(contract) {
  return !contract?.required || Number(contract.sectionCount || 0) >= 2
}

/**
 * Validate the metrics returned by the browser's phone-screen probe.
 * Kept pure so the contract can be tested without starting a dev server.
 */
export function validateScrollProbe(probe, { required = true } = {}) {
  if (!required) return []
  const blockers = []
  if (!probe || probe.scrollHeight <= probe.clientHeight) {
    blockers.push({
      code: PREVIEW_BLOCKER_CODES.PAGE_NOT_SCROLLABLE,
      message: `phone-screen scrollHeight must exceed clientHeight (scrollHeight=${probe?.scrollHeight || 0}, clientHeight=${probe?.clientHeight || 0})`,
    })
  } else if (!probe.changed) {
    blockers.push({
      code: PREVIEW_BLOCKER_CODES.PAGE_NOT_SCROLLABLE,
      message: `phone-screen scrollTop did not change (before=${probe.before}, after=${probe.after})`,
    })
  }
  if (probe?.changed && probe.restored !== true) {
    blockers.push({
      code: PREVIEW_BLOCKER_CODES.PAGE_SCROLL_NOT_RESTORED,
      message: `phone-screen scrollTop could not be restored (expected=${probe.before}, restored=${probe.restoredTop})`,
    })
  }
  return blockers
}

/**
 * Reject pages that technically scroll only because a wrapper has min-height.
 * For a required long page, rendered schema sections should occupy most of the
 * scrollable canvas instead of ending near the first viewport.
 */
export function validateContentCoverage(probe, { required = true } = {}) {
  if (!required || !probe || probe.scrollHeight <= 0) return []
  const ratio = Number(probe.contentBottom || 0) / Number(probe.scrollHeight)
  if (ratio >= 0.72) return []
  return [{
    code: PREVIEW_BLOCKER_CODES.PAGE_SCROLL_EMPTY_CONTENT,
    message: `rendered section content occupies only ${(ratio * 100).toFixed(1)}% of the scrollable page (contentBottom=${Math.round(probe.contentBottom || 0)}, scrollHeight=${probe.scrollHeight})`,
  }]
}

/**
 * The phone home indicator is chassis chrome, not document content or a solid
 * footer. The browser probe supplies measured ownership and the resolved
 * background-layer characteristics so this remains brand-agnostic.
 */
export function validateHomeIndicatorProbe(probe, { required = true } = {}) {
  if (!required) return []
  const anchored = probe?.position === 'absolute'
    && probe?.parentIsPhone === true
    && probe?.insideChassisBounds === true
  const chromeOnly = probe?.backgroundFullyTransparent === true
    && probe?.barVisible === true
  const safeInset = Number(probe?.contentSafeInset || 0) >= Number(probe?.minimumSafeInset || 12)
    && Number(probe?.contentSafeInset || 0) < Number(probe?.indicatorHeight || Infinity)
  const sourceRootHasNoLegacyTail = Number(probe?.sourceRootBottomPadding || 0)
    < Number(probe?.indicatorHeight || Infinity)
  if (anchored && chromeOnly && safeInset && sourceRootHasNoLegacyTail) return []
  return [{
    code: PREVIEW_BLOCKER_CODES.HOME_INDICATOR_OPAQUE_FOOTER,
    message: 'home indicator must be a chassis-owned absolute overlay with a fully transparent container, visible bar, and minimal content inset; it must not render as a footer or create a full indicator-height blank band',
  }]
}

/** Brand marks are identity assets: preserve the full intrinsic artwork. */
export function validateBrandIconProbe(probe, { required = true } = {}) {
  if (!required) return []
  const icons = Array.isArray(probe) ? probe : []
  const invalid = icons.filter((icon) => icon?.visible !== false && (
    icon?.objectFit !== 'contain'
    || Number(icon?.renderedWidth || 0) <= 0
    || Number(icon?.renderedHeight || 0) <= 0
    || Math.abs(Number(icon?.renderedHeight || 0) - 16) > 0.6
    || (
      Number(icon?.naturalWidth || 0) > 0
      && Number(icon?.naturalHeight || 0) > 0
      && Math.abs(
        Number(icon.renderedWidth) / Number(icon.renderedHeight)
        - Number(icon.naturalWidth) / Number(icon.naturalHeight)
      ) > 0.06
    )
  ))
  if (icons.length && invalid.length === 0) return []
  return [{
    code: PREVIEW_BLOCKER_CODES.BRAND_ICON_CROPPED,
    message: `brand rail icons must share a 16px rendered height and preserve intrinsic width ratio with object-fit: contain (invalid=${invalid.length}, total=${icons.length})`,
  }]
}

export function validateBrandRailLabelProbe(probe, { required = true } = {}) {
  if (!required) return []
  const labels = Array.isArray(probe) ? probe : []
  const invalid = labels.filter((label) => (
    label?.whiteSpace !== 'nowrap'
    || label?.overflow !== 'hidden'
    || label?.textOverflow !== 'ellipsis'
    || !String(label?.title || '').trim()
  ))
  if (labels.length && invalid.length === 0) return []
  return [{
    code: PREVIEW_BLOCKER_CODES.BRAND_LABEL_WRAPPED,
    message: `brand rail labels must remain on one line, ellipsize overflow, and expose the full title (invalid=${invalid.length}, total=${labels.length})`,
  }]
}
