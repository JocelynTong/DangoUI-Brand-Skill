import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const baseUrl = process.argv[2] || 'http://127.0.0.1:5177'
const route = `${baseUrl}/?qa=attempt6#/brand/pokemon-tcg-official/pages/pokemon-tcg-official-home`
const outputDir = path.resolve('migrations/pokemon-tcg-official/quality-attempts/06/demo')
const captureDir = path.join(outputDir, 'captures')
fs.mkdirSync(captureDir, { recursive: true })

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })

const inspect = (hero) => hero.evaluate((node) => {
  const box = (element) => element ? (() => { const r = element.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, bottom:r.bottom } })() : null
  const bg = node.querySelector('.source-schema-demo__hero-responsive-bg img')
  const titleImage = node.querySelector('.source-schema-demo__hero-title-image')
  const titleText = node.querySelector('.source-schema-demo__hero-heldout-title')
  const card = node.querySelector('.pokemon-featured-card__face--front')
  const cta = node.querySelector('.source-schema-demo__actions--brand-hero button, .source-schema-demo__actions--brand-hero a')
  const nav = node.querySelector('.source-schema-demo__hero-nav')
  const menu = node.querySelector('.source-schema-demo__mobile-menu-trigger')
  const controls = [...node.querySelectorAll('.source-schema-demo__hero-controls button')]
  const active = controls.findIndex((control) => control.classList.contains('is-active'))
  const next = node.nextElementSibling
  const screen = node.closest('.phone-screen')
  const animated = node.querySelector('.source-schema-demo__campaign-swap')
  return {
    hero: box(node),
    background: bg?.getAttribute('src'),
    titleImage: titleImage?.getAttribute('src') || null,
    titleText: titleText?.textContent?.trim() || null,
    proofLabel: node.querySelector('.source-schema-demo__hero-proof-label')?.textContent?.trim() || null,
    card: card?.getAttribute('src') || null,
    cta: cta?.textContent?.trim() || null,
    nav: { box: box(nav), logo: box(node.querySelector('.source-schema-demo__logo')), menu: box(menu), expanded: menu?.getAttribute('aria-expanded'), lineCount: node.querySelectorAll('.source-schema-demo__mobile-menu-icon i').length },
    controls: controls.map((control) => ({ box: box(control), active: control.classList.contains('is-active') })),
    active,
    menuPanelVisible: Boolean(node.querySelector('.source-schema-demo__mobile-menu-panel')),
    animation: animated ? { name: getComputedStyle(animated).animationName, duration: getComputedStyle(animated).animationDuration } : null,
    nextVisible: Boolean(next && screen && box(next).y < box(screen).bottom),
    horizontalOverflow: node.scrollWidth > node.clientWidth,
  }
})

const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
const errors = []
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
page.on('pageerror', (error) => errors.push(error.message))
await page.goto(route, { waitUntil: 'networkidle' })
const hero = page.locator('[data-schema-section-id="home-campaign-stage"]')
await hero.waitFor()
const initial = await inspect(hero)
await page.screenshot({ path: path.join(captureDir, 'default-390x844.png') })

await hero.locator('.source-schema-demo__hero-controls button').nth(1).click()
const transition = await inspect(hero)
await page.screenshot({ path: path.join(captureDir, 'transition-390x844.png') })
await page.waitForTimeout(500)
const settled = await inspect(hero)
await page.screenshot({ path: path.join(captureDir, 'settled-held-out-390x844.png') })

await hero.locator('.source-schema-demo__mobile-menu-trigger').click()
const menuOpen = await inspect(hero)
await page.screenshot({ path: path.join(captureDir, 'menu-open-390x844.png') })
await hero.locator('.source-schema-demo__mobile-menu-trigger').click()
const menuClosed = await inspect(hero)

await hero.locator('.source-schema-demo__hero-controls button').nth(0).click()
await page.waitForTimeout(500)
const restored = await inspect(hero)
await page.screenshot({ path: path.join(captureDir, 'restored-390x844.png') })

const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
await reduced.goto(route, { waitUntil: 'networkidle' })
const reducedHero = reduced.locator('[data-schema-section-id="home-campaign-stage"]')
await reducedHero.locator('.source-schema-demo__hero-controls button').nth(1).click()
const reducedSettled = await inspect(reducedHero)
await reduced.screenshot({ path: path.join(captureDir, 'reduced-motion-settled-390x844.png') })

const differentIdentities = ['background','titleImage','titleText','card','cta'].filter((key) => initial[key] !== settled[key])
const checks = {
  officialDefaultPreserved: initial.background?.endsWith('/booster-art-1.jpg') && initial.titleImage?.endsWith('/Logo-30th.png') && initial.card?.endsWith('/2M6P_EN_23.png'),
  heldOutTruthful: settled.proofLabel === 'GENERATIVE DEMO · NOT AN OFFICIAL CAMPAIGN',
  highSalienceChanged: differentIdentities.length >= 4,
  visibleTransition: transition.animation?.name === 'pokemon-campaign-swap-in' && transition.animation?.duration !== '0s',
  restored: restored.active === 0 && restored.background === initial.background && restored.card === initial.card && restored.titleImage === initial.titleImage,
  navGeometry: initial.nav.box?.height === 56 && initial.nav.logo?.width >= 77 && initial.nav.logo?.height >= 39 && initial.nav.menu?.height >= 44 && initial.nav.lineCount === 3,
  menuOperable: menuOpen.nav.expanded === 'true' && menuOpen.menuPanelVisible && menuClosed.nav.expanded === 'false' && !menuClosed.menuPanelVisible,
  controlTargets: initial.controls.every((control) => control.box?.width >= 44 && control.box?.height >= 44),
  compactAndNextVisible: initial.hero?.height <= 420 && initial.nextVisible,
  reducedMotionImmediate: reducedSettled.active === 1 && reducedSettled.animation?.name === 'none',
  noHorizontalOverflow: !initial.horizontalOverflow && !settled.horizontalOverflow,
  consoleClean: errors.length === 0,
}
const output = {
  schema: 'brand-browser-probes/v1', brand: 'pokemon-tcg-official', attempt: '06-demo', scope: 'page:pokemon-tcg-official-home section:home-campaign-stage', route,
  states: { initial, transition, settled, menuOpen, menuClosed, restored, reducedSettled }, differentIdentities, checks,
  captures: fs.readdirSync(captureDir).sort().map((name) => `captures/${name}`),
  implementationChecksPass: Object.values(checks).every(Boolean), visualVerdict: 'not-assigned-by-implementation-agent', console: { errors },
}
fs.writeFileSync(path.join(outputDir, 'browser-probes.json'), `${JSON.stringify(output, null, 2)}\n`)
await reduced.close(); await page.close(); await browser.close()
if (!output.implementationChecksPass) process.exitCode = 1
