import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PREVIEW_BLOCKER_CODES,
  getScrollContract,
  hasRequiredSectionCount,
  validateContentCoverage,
  validateHomeIndicatorProbe,
  validateBrandIconProbe,
  validateBrandRailLabelProbe,
  validateScrollProbe,
} from './brand-preview-layout-contract.mjs'

test('long or multi-module source evidence requires two target sections', () => {
  const contract = getScrollContract({
    page: { id: 'demo-home', sections: [{ type: 'brand-hero' }] },
    sourceEvidence: { sourceEvidence: { sections: ['Hero', 'News', 'Products'] } },
  })

  assert.equal(contract.required, true)
  assert.equal(hasRequiredSectionCount(contract), false)
  assert.match(contract.reasons.join('; '), /source evidence has 3 sections/)
})

test('brand identity icons must preserve the full artwork', () => {
  assert.deepEqual(validateBrandIconProbe([{ loaded: true, visible: true, objectFit: 'cover', renderedWidth: 16, renderedHeight: 16 }]), [{
    code: PREVIEW_BLOCKER_CODES.BRAND_ICON_CROPPED,
    message: 'brand rail icons must share a 16px rendered height and preserve intrinsic width ratio with object-fit: contain (invalid=1, total=1)',
  }])
  assert.deepEqual(validateBrandIconProbe([{ loaded: true, visible: true, objectFit: 'contain', renderedWidth: 40, renderedHeight: 16, naturalWidth: 500, naturalHeight: 200 }]), [])
})

test('brand rail names remain single-line with an accessible full title', () => {
  assert.deepEqual(validateBrandRailLabelProbe([{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', title: '' }]), [{
    code: PREVIEW_BLOCKER_CODES.BRAND_LABEL_WRAPPED,
    message: 'brand rail labels must remain on one line, ellipsize overflow, and expose the full title (invalid=1, total=1)',
  }])
  assert.deepEqual(validateBrandRailLabelProbe([{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', title: 'Pokémon TCG Official' }]), [])
})

test('two target sections require a reversible phone-screen scroll probe', () => {
  const contract = getScrollContract({
    page: { id: 'demo-products', sections: [{ type: 'product-gallery' }, { type: 'center-cta' }] },
  })
  assert.equal(contract.required, true)
  assert.deepEqual(validateScrollProbe({ clientHeight: 400, scrollHeight: 400, before: 0, after: 0, changed: false }), [
    {
      code: PREVIEW_BLOCKER_CODES.PAGE_NOT_SCROLLABLE,
      message: 'phone-screen scrollHeight must exceed clientHeight (scrollHeight=400, clientHeight=400)',
    },
  ])
  assert.deepEqual(validateScrollProbe({ clientHeight: 400, scrollHeight: 800, before: 0, after: 120, restored: false, restoredTop: 7, changed: true }), [
    {
      code: PREVIEW_BLOCKER_CODES.PAGE_SCROLL_NOT_RESTORED,
      message: 'phone-screen scrollTop could not be restored (expected=0, restored=7)',
    },
  ])
})

test('pages without long or multi-module evidence do not require scroll', () => {
  const contract = getScrollContract({
    page: { id: 'demo-hero', sections: [{ type: 'brand-hero' }] },
    sourceEvidence: { sourceEvidence: { sections: ['Hero'] } },
  })
  assert.equal(contract.required, false)
  assert.equal(hasRequiredSectionCount(contract), true)
  assert.deepEqual(validateScrollProbe({ clientHeight: 400, scrollHeight: 400, before: 0, after: 0, changed: false }, contract), [])
})

test('min-height cannot fake a content-bearing long page', () => {
  assert.deepEqual(validateContentCoverage({ contentBottom: 220, scrollHeight: 1000 }), [{
    code: PREVIEW_BLOCKER_CODES.PAGE_SCROLL_EMPTY_CONTENT,
    message: 'rendered section content occupies only 22.0% of the scrollable page (contentBottom=220, scrollHeight=1000)',
  }])
  assert.deepEqual(validateContentCoverage({ contentBottom: 840, scrollHeight: 1000 }), [])
})

test('home indicator cannot become an opaque document footer', () => {
  assert.deepEqual(validateHomeIndicatorProbe({
    position: 'absolute',
    parentIsPhone: true,
    insideChassisBounds: true,
    backgroundFullyTransparent: false,
    barVisible: true,
    contentSafeInset: 34,
    minimumSafeInset: 12,
    indicatorHeight: 34,
  }), [{
    code: PREVIEW_BLOCKER_CODES.HOME_INDICATOR_OPAQUE_FOOTER,
    message: 'home indicator must be a chassis-owned absolute overlay with a fully transparent container, visible bar, and minimal content inset; it must not render as a footer or create a full indicator-height blank band',
  }])

  assert.deepEqual(validateHomeIndicatorProbe({
    position: 'absolute',
    parentIsPhone: true,
    insideChassisBounds: true,
    backgroundFullyTransparent: true,
    barVisible: true,
    contentSafeInset: 16,
    sourceRootBottomPadding: 110,
    minimumSafeInset: 12,
    indicatorHeight: 34,
  }), [{
    code: PREVIEW_BLOCKER_CODES.HOME_INDICATOR_OPAQUE_FOOTER,
    message: 'home indicator must be a chassis-owned absolute overlay with a fully transparent container, visible bar, and minimal content inset; it must not render as a footer or create a full indicator-height blank band',
  }])

  assert.deepEqual(validateHomeIndicatorProbe({
    position: 'absolute',
    parentIsPhone: true,
    insideChassisBounds: true,
    backgroundFullyTransparent: true,
    barVisible: true,
    contentSafeInset: 16,
    sourceRootBottomPadding: 0,
    minimumSafeInset: 12,
    indicatorHeight: 34,
  }), [])
})
