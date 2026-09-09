# ONE PIECE Home Indicator — Demo Revision 4

Status: awaiting fresh Blind QA.

Revision 3 exposed a viewport-specific footer containment failure at 1280×720. The fixed `343.2px` footer nav width remained larger than the phone content box after mockup scaling.

Revision 4 removes that fixed width from footer nav and legal content. Both now resolve from the footer content box, with border-box sizing and safe text wrapping.

Browser self-check at 1280×720, bottom position:

- phone-screen: left `721.17px`, right `1018.83px`
- footer nav/legal: left `744.57px`, right `995.43px`
- nav/legal width: `250.86px`
- footer bottom: `680.50px`; black bar top: `681.95px`
- screen `scrollWidth === clientWidth` (`298px`)
- transparent indicator and black bar behavior preserved

