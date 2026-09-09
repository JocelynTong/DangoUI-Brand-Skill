# ONE PIECE Home Indicator — Demo Revision 3

Status: awaiting fresh Blind QA.

## User-corrected target

- The indicator container must be transparent; only the black system bar is visible.
- The bar belongs to the phone chassis and sits at the chassis bottom.
- Do not add an unsupported white translucent gradient.
- Do not reserve a full indicator-height blank band below the page.
- Footer content must clear the bar and remain wholly inside the phone screen.

## Implementation

- Kept the indicator transparent and chassis-positioned.
- Increased the scaled content safety inset from 16px to 22px to clear the black bar without creating a footer-like band.
- Made `.opcg-footer` border-box and width-contained so its padding cannot expand it beyond the phone screen.

## Browser self-check at the bottom position

- Footer bottom: `846.45px`
- Black bar top: `848.20px`
- Clearance: `1.75px`
- Screen right edge: `1007.78px`
- Footer navigation/legal right edge: `1003.26px`
- Screen horizontal scroll width equals client width: `371px`
- Indicator background remains transparent.

Visual evidence: `captures/home-indicator-bottom.png`.

## Automated checks

- `node --test scripts/brand-preview-layout-contract.test.mjs`: 5/5 pass
- `npm run build`: pass

