# React Web text Button candidate

`DangoButton.tsx` is a narrow reusable adapter, not a React component library or page template. Extracted unchanged from the isolated DayOneJourney Button experiment (2026-10-13), described there in `BUTTON-EXPERIMENT.md`. Source: dangoui **3.6.16** `src/button/Button.vue`, `style.scss`, and `platte.ts`.

Use only for React Web text buttons with matching behavior. Confirm the actual installed dangoui version and source compatibility before copying/importing. Optional for other brands; unsuitable for Taro, React Native, icons, arrows, mini-program openType/getUserInfo, or a theme-selection API. Declared props do not certify every combination.

Load real library CSS and generated theme from `compile-selected-theme` through the global host entry. This adapter supplies DOM/classes and event handling, not replacement CSS. After copying to the isolated host:

```tsx
import { DangoButton } from './components/DangoButton';
<DangoButton size="large" variant="primary" onClick={existingHandler}>Continue</DangoButton>
```

Prior verification covered large primary/secondary, disabled/default and temporary-disabled styling, loading/spinner and activation gating, full width, pointer press and Enter/Space. Other sizes, variants, combinations and platforms are unverified. Intentional Web differences: native disabled also covers loading and removes tab focus; aria-busy and pointer/keyboard feedback are added. Source Vue touch feedback is a minimum 150 ms overlay, not a long-press API. This is not exact API equivalence or production certification.

Record actual host import/call sites and edits in existing adapted/reused/limitations fields. Independent QA must inspect actual calls and final CSS overrides, compare the installed source component and adapter under the same theme in required states, exercise preserved handlers, and report coverage. Asset presence and historical verification do not prove current integration or replace fresh runtime QA. Do not copy the experiment's Showcase page or old QA reports.
