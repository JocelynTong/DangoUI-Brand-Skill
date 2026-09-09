import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const baseUrl = process.argv[2] || 'http://127.0.0.1:5177'
const route = `${baseUrl}/?qa=attempt5-r2#/brand/pokemon-tcg-official/pages/pokemon-tcg-official-home`
const outputDir = path.resolve('migrations/pokemon-tcg-official/quality-attempts/05/demo-r2')
const captureDir = path.join(outputDir, 'captures')
fs.mkdirSync(captureDir, { recursive: true })

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})

const surfaces = [
  { name: 'mobile-390x844', width: 390, height: 844 },
  { name: 'outer-1440-internal-phone', width: 1440, height: 1000 },
]

const results = []

const inspect = (hero) => hero.evaluate((node) => {
  const rect = (element) => {
    if (!element) return null
    const value = element.getBoundingClientRect()
    return { x: value.x, y: value.y, right: value.right, bottom: value.bottom, width: value.width, height: value.height }
  }
  const overlap = (a, b) => {
    if (!a || !b) return 0
    return Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x))
      * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y))
  }
  const heroRect = rect(node)
  const logo = rect(node.querySelector('.source-schema-demo__logo'))
  const nav = node.querySelector('.source-schema-demo__hero-nav')
  const navItems = [...node.querySelectorAll('.source-schema-demo__hero-nav > span')].map((element) => ({
    label: element.textContent.trim(),
    display: getComputedStyle(element).display,
    box: rect(element),
  }))
  const visibleNavItems = navItems.filter((item) => item.display !== 'none' && item.box?.width > 0 && item.box?.height > 0)
  const card = node.querySelector('.pokemon-featured-card')
  const cardInner = node.querySelector('.pokemon-featured-card__inner')
  const cta = node.querySelector('.source-schema-demo__actions--brand-hero button, .source-schema-demo__actions--brand-hero a')
  const next = node.nextElementSibling
  const screen = node.closest('.phone-screen')
  const navAfter = nav ? getComputedStyle(nav, '::after').content : 'none'
  return {
    hero: { ...heroRect, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth },
    logo,
    nav: {
      box: rect(nav),
      mobileLabel: navAfter,
      items: navItems,
      visibleItemCount: visibleNavItems.length,
      maximumLogoItemOverlapPx2: Math.max(0, ...visibleNavItems.map((item) => overlap(logo, item.box))),
    },
    card: {
      box: rect(card),
      ariaPressed: card?.getAttribute('aria-pressed'),
      transform: cardInner ? getComputedStyle(cardInner).transform : null,
      transitionDuration: cardInner ? getComputedStyle(cardInner).transitionDuration : null,
    },
    cta: rect(cta),
    nextSection: next ? {
      box: rect(next),
      browserViewportHeight: window.innerHeight,
      phoneViewport: rect(screen),
      startsAtHeroBoundary: Math.abs(rect(next).top - heroRect.bottom) <= 1,
      visibleInInitialPhoneViewport: Boolean(screen)
        && rect(next).top < rect(screen).bottom
        && rect(next).bottom > rect(screen).top,
    } : null,
    scroll: { top: screen?.scrollTop, clientHeight: screen?.clientHeight, scrollHeight: screen?.scrollHeight },
    overflow: {
      documentHorizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      heroHorizontal: node.scrollWidth > node.clientWidth,
    },
  }
})

for (const surface of surfaces) {
  const page = await browser.newPage({ viewport: { width: surface.width, height: surface.height }, deviceScaleFactor: 1 })
  const errors = []
  const warnings = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
    if (message.type() === 'warning') warnings.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(route, { waitUntil: 'networkidle' })
  const hero = page.locator('[data-schema-section-id="home-campaign-stage"]')
  const card = hero.locator('.pokemon-featured-card')
  const screen = page.locator('.phone-screen')
  await hero.waitFor()

  const initial = await inspect(hero)
  await page.screenshot({ path: path.join(captureDir, `${surface.name}-front.png`), fullPage: false })

  const pointerScrollBefore = await screen.evaluate((node) => node.scrollTop)
  await card.click()
  await page.waitForTimeout(150)
  const pointerMid = await inspect(hero)
  await page.screenshot({ path: path.join(captureDir, `${surface.name}-flip-mid.png`), fullPage: false })
  await page.waitForTimeout(500)
  const pointerBack = await inspect(hero)
  await page.screenshot({ path: path.join(captureDir, `${surface.name}-back.png`), fullPage: false })
  await card.click()
  await page.waitForTimeout(600)
  const pointerFront = await inspect(hero)

  await card.focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(600)
  const keyboardBack = await inspect(hero)
  await page.keyboard.press('Space')
  await page.waitForTimeout(600)
  const keyboardFront = await inspect(hero)

  const controls = hero.locator('.source-schema-demo__hero-controls button')
  const carouselBefore = await controls.evaluateAll((nodes) => nodes.findIndex((node) => node.classList.contains('is-active')))
  await controls.nth(1).click()
  const carouselChanged = await controls.evaluateAll((nodes) => nodes.findIndex((node) => node.classList.contains('is-active')))
  await controls.nth(0).click()
  const carouselRestored = await controls.evaluateAll((nodes) => nodes.findIndex((node) => node.classList.contains('is-active')))

  const final = await inspect(hero)
  const pointerPass = initial.card.ariaPressed === 'false' && pointerBack.card.ariaPressed === 'true'
    && pointerFront.card.ariaPressed === 'false' && pointerMid.scroll.top === pointerScrollBefore
    && pointerBack.scroll.top === pointerScrollBefore && pointerFront.scroll.top === pointerScrollBefore
  const keyboardPass = keyboardBack.card.ariaPressed === 'true' && keyboardFront.card.ariaPressed === 'false'
  const navPass = initial.nav.visibleItemCount === 0 && initial.nav.maximumLogoItemOverlapPx2 === 0
    && initial.nav.mobileLabel.includes('MENU')
  const geometryPass = initial.hero.height <= 430
    && Math.abs(initial.nextSection.box.y - initial.hero.bottom) <= 1
    && initial.nextSection.box.y < initial.nextSection.phoneViewport.bottom
    && initial.nextSection.box.bottom > initial.nextSection.phoneViewport.y
    && initial.cta?.height >= 43.9 && !initial.overflow.documentHorizontal && !initial.overflow.heroHorizontal
  const carouselPass = [carouselBefore, carouselChanged, carouselRestored].join(',') === '0,1,0'

  results.push({
    surface,
    initial,
    interaction: {
      pointer: { sequence: [initial.card.ariaPressed, pointerBack.card.ariaPressed, pointerFront.card.ariaPressed], midTransform: pointerMid.card.transform, scrollTopStable: pointerPass, pass: pointerPass },
      keyboard: { keys: ['Enter', 'Space'], sequence: [keyboardBack.card.ariaPressed, keyboardFront.card.ariaPressed], pass: keyboardPass },
      carousel: { sequence: [carouselBefore, carouselChanged, carouselRestored], pass: carouselPass },
    },
    final,
    checks: { navPass, geometryPass, carouselPass, consolePass: errors.length === 0 && warnings.length === 0 },
    console: { errors, warnings },
    pass: navPass && geometryPass && pointerPass && keyboardPass && carouselPass && errors.length === 0 && warnings.length === 0,
  })
  await page.close()
}

const reducedPage = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
await reducedPage.emulateMedia({ reducedMotion: 'reduce' })
await reducedPage.goto(route, { waitUntil: 'networkidle' })
const reducedHero = reducedPage.locator('[data-schema-section-id="home-campaign-stage"]')
const reducedCard = reducedHero.locator('.pokemon-featured-card')
await reducedHero.waitFor()
const reducedBefore = await inspect(reducedHero)
const reducedMatch = await reducedPage.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
await reducedCard.click()
const reducedAfterImmediate = await inspect(reducedHero)
await reducedPage.screenshot({ path: path.join(captureDir, 'reduced-motion-back-immediate.png'), fullPage: false })
const reducedDurationMs = reducedAfterImmediate.card.transitionDuration
  .split(',')
  .map((value) => value.trim())
  .reduce((maximum, value) => Math.max(maximum, value.endsWith('ms') ? Number.parseFloat(value) : Number.parseFloat(value) * 1000), 0)
const reducedMotion = {
  matchMediaActive: reducedMatch,
  beforeAriaPressed: reducedBefore.card.ariaPressed,
  afterImmediateAriaPressed: reducedAfterImmediate.card.ariaPressed,
  computedTransitionDuration: reducedAfterImmediate.card.transitionDuration,
  computedTransformImmediatelyAfterActivation: reducedAfterImmediate.card.transform,
  degradedToAtMostOneMillisecond: reducedDurationMs <= 1,
  pass: reducedMatch && reducedAfterImmediate.card.ariaPressed === 'true' && reducedDurationMs <= 1,
}
await reducedPage.close()
await browser.close()

const output = {
  schema: 'brand-browser-probes/v1',
  brand: 'pokemon-tcg-official',
  attempt: '05-demo-r2',
  scope: 'page:pokemon-tcg-official-home section:home-campaign-stage',
  route,
  results,
  reducedMotion,
  captures: fs.readdirSync(captureDir).sort().map((name) => `captures/${name}`),
  implementationChecksPass: results.every((result) => result.pass) && reducedMotion.pass,
  visualVerdict: 'not-assigned-by-implementation-agent',
}
fs.writeFileSync(path.join(outputDir, 'browser-probes.json'), `${JSON.stringify(output, null, 2)}\n`)
if (!output.implementationChecksPass) process.exitCode = 1
