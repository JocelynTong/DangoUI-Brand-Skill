# Attempt 05 Blind QA R2 — Compact Interactive Hero

## Verdict

**PASS**

The previous `HERO_LOGO_NAV_OVERLAP` blocker is resolved on both required proof surfaces. The desktop navigation labels are truly removed from compact layout and hit testing (`display: none`, `0 × 0`), the `MENU ☰` treatment is visible, and measured logo-to-visible-nav-item overlap is `0px²`.

## Required acceptance

- 390×844: Hero `415.9943px` (≤430); next section visible; CTA `43.9986px` (44px within subpixel tolerance).
- Outer 1440 / internal phone: compact Hero remains `415.9943px`; next section visible.
- Pairwise overlap among TCG logo, campaign logo, featured card, CTA and carousel controls: `0px²` on both surfaces.
- Pointer: `front → back → front`; card bounds and phone `scrollTop=0` remain stable.
- Keyboard: `Enter → back`, `Space → front`; no scroll jump.
- Carousel: `0 → 1 → 0`, all states nonblank.
- Reduced motion runtime: `matchMedia=true`, transition `0s`, back transform applied immediately and stable.
- No document/Hero horizontal overflow; no console warning or error.

## Visual judgment

The compact composition still reads as Pokémon campaign design rather than a crowded thumbnail: the photographic campaign background, official marks, dimensional card, gold-outlined CTA and restrained carousel controls retain a clear hierarchy, while the following content is visible in the initial phone viewport.

## Non-blocking warning

Carousel state 2 reuses the same campaign logo and featured card, so its differentiation remains weak. This was outside the approved correction scope and does not block the compact Hero acceptance.

## Failure routing

- Blockers: none.
- `earliestFailureNode`: `null`.
- `failureOwnerRole`: `null`.
