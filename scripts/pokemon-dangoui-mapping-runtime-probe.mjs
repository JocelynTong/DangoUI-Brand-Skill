#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const base = process.argv[2] || 'http://127.0.0.1:5179'
const root = process.cwd()
const outputDir = path.join(root, 'migrations/pokemon-tcg-official/mapping-runtime')
const captureDir = path.join(outputDir, 'captures')
fs.mkdirSync(captureDir, { recursive: true })

const routes = [
  { short: 'home', id: 'pokemon-tcg-official-home' },
  { short: 'database', id: 'pokemon-tcg-official-card-database' },
  { short: 'learn', id: 'pokemon-tcg-official-learn' },
]
const surfaces = [
  { id: 'desktop', viewport: { width: 1440, height: 1000 } },
  { id: 'phone', viewport: { width: 390, height: 844 } },
]
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const pages = []
const errors = []

for (const route of routes) {
  for (const surface of surfaces) {
    const page = await browser.newPage({ viewport: surface.viewport, deviceScaleFactor: 1 })
    page.on('pageerror', (error) => errors.push(`${route.id}/${surface.id}: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`${route.id}/${surface.id}: ${message.text()}`)
    })
    await page.goto(`${base}/?qa=pokemon-mapping-runtime#` + `/brand/pokemon-tcg-official/pages/${route.id}`, { waitUntil: 'networkidle' })
    await page.waitForSelector(`.source-schema-demo[data-page-id="${route.id}"]`)
    const state = await page.evaluate(() => {
      const demo = document.querySelector('.source-schema-demo--pokemon-tcg-official')
      const screen = document.querySelector('.phone-screen')
      const style = getComputedStyle(demo)
      const rect = (node) => {
        if (!node) return null
        const value = node.getBoundingClientRect()
        return { x: value.x, y: value.y, width: value.width, height: value.height }
      }
      return {
        demo: rect(demo),
        screen: rect(screen),
        tokens: {
          bg1: style.getPropertyValue('--du-bg-1').trim(),
          bg2: style.getPropertyValue('--du-bg-2').trim(),
          text1: style.getPropertyValue('--du-text-1').trim(),
          text2: style.getPropertyValue('--du-text-2').trim(),
          border1: style.getPropertyValue('--du-border-1').trim(),
        },
        scroll: screen ? { clientHeight: screen.clientHeight, scrollHeight: screen.scrollHeight, scrollTop: screen.scrollTop } : null,
        horizontalOverflow: Boolean(screen && screen.scrollWidth > screen.clientWidth + 1),
        brokenImages: [...document.querySelectorAll('.source-schema-demo img')].filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.currentSrc || image.src),
      }
    })
    const screenshot = path.join(captureDir, `${route.short}-${surface.id}.png`)
    await page.screenshot({ path: screenshot, fullPage: false })
    pages.push({ pageId: route.id, surface: surface.id, viewport: surface.viewport, screenshot: path.relative(root, screenshot), ...state })
    await page.close()
  }
}

const database = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
await database.goto(`${base}/?qa=pokemon-mapping-runtime#/brand/pokemon-tcg-official/pages/pokemon-tcg-official-card-database`, { waitUntil: 'networkidle' })
await database.waitForSelector('.pokemon-db__submit.du-button')
const nativeButton = await database.locator('.pokemon-db__submit.du-button').first().evaluate((node) => {
  const style = getComputedStyle(node)
  return {
    tag: node.tagName,
    className: node.className,
    text: node.textContent.trim(),
    backgroundColor: style.backgroundColor,
    color: style.color,
    height: node.getBoundingClientRect().height,
  }
})
const databaseTokens = await database.locator('.pokemon-db').evaluate((node) => {
  const style = getComputedStyle(node)
  return {
    font: style.fontFamily,
    fontToken: style.getPropertyValue('--style-font-database').trim(),
    backgroundColor: style.backgroundColor,
  }
})
const databaseTitle = await database.locator('.pokemon-db__title-plate h1').evaluate((node) => {
  const style = getComputedStyle(node)
  const surface = getComputedStyle(node.closest('.pokemon-db__title-plate')).backgroundColor
  return {
    token: style.getPropertyValue('--du-text-1').trim(),
    color: style.color,
    surface,
  }
})
await database.locator('#pokemon-card-name').fill('Pikachu')
await database.locator('.pokemon-db__submit.du-button').first().click()
await database.waitForSelector('.pokemon-db__results')
const resultsToken = await database.locator('.pokemon-db__results').evaluate((node) => {
  const style = getComputedStyle(node)
  return {
    token: style.getPropertyValue('--style-database-results-texture').trim(),
    backgroundImage: style.backgroundImage,
  }
})
await database.close()

const foreign = []
for (const target of [
  { brand: 'dango', page: 'dango-introduction-calibration' },
  { brand: 'onepiece-cardgame', page: 'onepiece-cardgame-home' },
]) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  await page.goto(`${base}/?qa=pokemon-mapping-isolation#/brand/${target.brand}/pages/${target.page}`, { waitUntil: 'networkidle' })
  foreign.push(await page.evaluate((brand) => {
    const demo = document.querySelector('.source-schema-demo')
    const style = demo ? getComputedStyle(demo) : null
    return {
      brand,
      pokemonThemeAncestor: Boolean(demo?.closest('.theme-pokemon-tcg-official')),
      databaseFontToken: style?.getPropertyValue('--style-font-database').trim() || '',
      resultsTextureToken: style?.getPropertyValue('--style-database-results-texture').trim() || '',
    }
  }, target.brand))
  await page.close()
}

await browser.close()

const checks = {
  sixScreenshots: pages.length === 6,
  fourNativeTokensScoped: pages.every((page) => page.tokens.bg1 && page.tokens.bg2 && page.tokens.text1 && page.tokens.text2),
  rejectedBorderCandidateAbsent: pages.every((page) => page.tokens.border1.toLowerCase() !== '#5e5e5e' && page.tokens.border1.toLowerCase() !== 'rgb(94, 94, 94)'),
  nativeDuButton: nativeButton.tag === 'BUTTON' && nativeButton.className.includes('du-button') && nativeButton.text === 'Search',
  primaryTextTokenConsumed: databaseTitle.token.toLowerCase() === '#131415' && databaseTitle.color === 'rgb(19, 20, 21)' && databaseTitle.surface === 'rgb(255, 255, 255)',
  databaseFontConsumed: databaseTokens.fontToken.includes('Flexo-Regular') && databaseTokens.font.includes('Flexo-Regular'),
  resultsTextureConsumed: resultsToken.token.includes('content_bg.png') && resultsToken.backgroundImage.includes('content_bg.png'),
  foreignThemesClean: foreign.every((item) => !item.pokemonThemeAncestor && !item.databaseFontToken && !item.resultsTextureToken),
  noBrokenImages: pages.every((page) => page.brokenImages.length === 0),
  noHorizontalOverflow: pages.every((page) => !page.horizontalOverflow),
  noRuntimeErrors: errors.length === 0,
}
const report = {
  schema: 'pokemon-dangoui-mapping-runtime-probe/v1',
  generatedAt: new Date().toISOString(),
  base,
  verdict: Object.values(checks).every(Boolean) ? 'pass' : 'fail',
  summary: { dtcgTargets: 6, consumed: 6, pending: 0, nativeComponentTypes: 1, nativeComponentInstances: 1 },
  checks,
  pages,
  nativeButton,
  databaseTokens,
  databaseTitle,
  resultsToken,
  foreign,
  errors,
}
fs.writeFileSync(path.join(outputDir, 'runtime-probe.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
process.exit(report.verdict === 'pass' ? 0 : 3)
