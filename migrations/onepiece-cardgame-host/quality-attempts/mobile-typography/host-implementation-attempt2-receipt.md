# Host Implementation receipt — mobile typography attempt 2

- Incident: `HOST-MOBILE-TYPOGRAPHY-001`
- Trigger: fresh independent QA returned `REWORK`
- Status: exact blockers corrected; awaiting another fresh independent QA
- Host: `/Users/jocelyn/Downloads/spu-common-plugin`

## QA blockers corrected

1. `sprite-list` visible Chinese type/status chips now explicitly use the CJK-first stack, weight 600, 11PX/1.3 and zero tracking. Generated `font-bold` no longer wins.
2. `team-create` 必填/可选 badges now explicitly use the CJK-first stack, weight 500, 11PX/1.3 and zero tracking.
3. `sprite-detail` biography has a dedicated semantic class and renders with the CJK-first stack at 14PX, weight 400, line-height 1.6 and zero tracking.
4. Existing `@font-face` sources use the emitted brand font assets and exact registered family names. Build output contains all three files. Visible Latin roles continue to cause legitimate loading: Alfa for Latin display headings, Oswald for numeric metadata, and Poppins for the team-create Latin kicker. No synthetic hidden preload was added.

## Safety and verification

- Changes are typography-only; no route, data, validation, interaction, hit target or layout behavior was changed.
- New fixed sizes use uppercase `PX` to avoid Taro unit conversion.
- `npm run build`: PASS.
- Emitted font files:
  - `dist/static/fonts/alfa-slab-one-400.ttf`
  - `dist/static/fonts/oswald-700.ttf`
  - `dist/static/fonts/poppins-500.ttf`
- Build retains pre-existing warnings for duplicate `packageManager`, dynamic/static imports and `vconsole` eval; none were introduced by this attempt.

This receipt is not the final QA verdict. A new independent Visual QA must re-check 390/421 computed styles, screenshots, font readiness and overflow.
