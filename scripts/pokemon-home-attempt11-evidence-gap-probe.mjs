import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { chromium } from 'playwright-core'

const root = path.resolve('migrations/pokemon-tcg-official/quality-attempts/11/evidence/captures')
const mobileDir = path.join(root, 'mobile')
const assetDir = path.join(root, 'assets')
await fs.mkdir(mobileDir, { recursive: true })
await fs.mkdir(assetDir, { recursive: true })

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
const page = await context.newPage()
await page.goto('https://tcg.pokemon.com/en-us/', { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForTimeout(5000)

const heading = page.getByRole('heading', { name: /CHAMPIONSHIP SERIES/i }).first()
const article = heading.locator('xpath=ancestor::article[1]')
await article.scrollIntoViewIfNeeded()
const cta = article.getByRole('link', { name: /learn more/i })
await cta.waitFor({ state: 'visible' })

const collect = async () => cta.evaluate((el) => {
  const bg = el.querySelector('.button__bg')
  const before = bg ? getComputedStyle(bg, '::before') : null
  const img = el.closest('article')?.querySelector('img')
  return {
    viewport: [innerWidth, innerHeight],
    href: el.href,
    rect: Object.values(el.getBoundingClientRect().toJSON()),
    active: document.activeElement === el,
    currentSrc: img?.currentSrc,
    src: img?.src,
    srcset: img?.srcset,
    naturalSize: img ? [img.naturalWidth, img.naturalHeight] : null,
    before: before ? { transform: before.transform, backgroundColor: before.backgroundColor, transition: before.transition } : null,
  }
})

await page.screenshot({ path: path.join(mobileDir, 'championship-series-cta-default-390x844.png') })
const states = { default: await collect() }
await cta.hover()
await page.waitForTimeout(260)
await page.screenshot({ path: path.join(mobileDir, 'championship-series-cta-hover-settled-390x844.png') })
states.hover = await collect()
await page.mouse.move(2, 2)

await page.keyboard.press('Home')
await page.waitForTimeout(100)
for (let i = 0; i < 40; i += 1) {
  await page.keyboard.press('Tab')
  if (await cta.evaluate((el) => document.activeElement === el)) break
}
await cta.scrollIntoViewIfNeeded()
await page.screenshot({ path: path.join(mobileDir, 'championship-series-cta-focus-390x844.png') })
states.focus = await collect()

const destination = await context.newPage()
await destination.goto(states.default.href, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.screenshot({ path: path.join(mobileDir, 'championship-series-cta-activated-390x844.png') })
await destination.screenshot({ path: path.join(mobileDir, 'championship-series-cta-destination-390x844.png') })
states.destination = { requestedHref: states.default.href, finalUrl: destination.url(), title: await destination.title() }

const assetUrl = states.default.src
const response = await context.request.get(assetUrl)
const bytes = await response.body()
const assetPath = path.join(assetDir, 'championships.jpg')
await fs.writeFile(assetPath, bytes)
states.asset = {
  url: assetUrl,
  path: path.relative(path.resolve('migrations/pokemon-tcg-official/quality-attempts/11/evidence'), assetPath),
  status: response.status(),
  bytes: bytes.length,
  sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
}
await fs.writeFile(path.join(root, 'attempt11-mobile-gap-observation.json'), JSON.stringify(states, null, 2) + '\n')
await browser.close()
