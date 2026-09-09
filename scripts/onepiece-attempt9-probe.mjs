import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const root = process.cwd()
const outputDir = path.join(root, 'output/visual-qa/onepiece-cardgame/demo-v9')
fs.mkdirSync(outputDir, { recursive: true })
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1164, height: 655 }, deviceScaleFactor: 1 })
const url = 'http://127.0.0.1:5173/#/brand/onepiece-cardgame/pages/onepiece-cardgame-home'
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-schema-section-id="home-footer-illustration"]')
await page.evaluate(() => document.fonts.ready)
const probe = await page.evaluate(async () => {
  const screen = document.querySelector('.phone-screen:has(.source-schema-demo[data-page-id="onepiece-cardgame-home"])')
  const title = document.querySelector('[data-schema-section-id="home-news"] h2.source-schema-demo__display-title')
  const footer = document.querySelector('[data-schema-section-id="home-footer-illustration"]')
  const images = [...footer.querySelectorAll('img')]
  const before = screen.scrollTop
  screen.scrollTop = screen.scrollHeight
  await new Promise((resolve) => requestAnimationFrame(resolve))
  const after = screen.scrollTop
  screen.scrollTop = before
  return {
    url: location.href,
    fontChecks: {
      display: document.fonts.check('400 22px "OPCG Alfa Slab One"', 'LATEST NEWS'),
      editorial: document.fonts.check('700 26px "OPCG Noto Serif"', 'BEGIN YOUR ADVENTURE'),
      utility: document.fonts.check('500 12px "OPCG Poppins"', 'FOR BEGINNERS'),
      metadata: document.fonts.check('700 9px "OPCG Oswald"', '2026.06.25'),
    },
    loadedFaces: [...document.fonts].filter((face) => face.family.startsWith('OPCG ')).map((face) => ({ family: face.family, weight: face.weight, status: face.status })),
    computed: {
      title: title ? getComputedStyle(title).fontFamily : null,
      editorial: getComputedStyle(document.querySelector('[data-schema-section-id="home-welcome"] > strong')).fontFamily,
      body: getComputedStyle(document.querySelector('.source-schema-demo')).fontFamily,
      metadata: getComputedStyle(document.querySelector('.source-schema-demo__home-editorial-item small')).fontFamily,
    },
    title: { exists: Boolean(title), tag: title?.tagName || null, text: title?.textContent || null, rect: title?.getBoundingClientRect().toJSON() || null },
    footer: { imageCount: images.length, images: images.map((img) => ({ src: img.getAttribute('src'), complete: img.complete, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight })) },
    scroll: { scrollHeight: screen.scrollHeight, clientHeight: screen.clientHeight, before, after, restored: screen.scrollTop },
  }
})
const footer = page.locator('[data-schema-section-id="home-footer-illustration"]')
await footer.scrollIntoViewIfNeeded()
await footer.screenshot({ path: path.join(outputDir, 'home-footer-settled.png') })
await page.screenshot({ path: path.join(outputDir, 'home-footer-context.png') })
await page.locator('[data-schema-section-id="home-news"]').scrollIntoViewIfNeeded()
await page.screenshot({ path: path.join(outputDir, 'home-display-title.png') })
fs.writeFileSync(path.join(outputDir, 'browser-probe.json'), `${JSON.stringify(probe, null, 2)}\n`)
console.log(JSON.stringify(probe, null, 2))
await browser.close()
