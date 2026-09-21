#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const root = path.resolve(import.meta.dirname, '../../..')
const recipe = JSON.parse(fs.readFileSync(path.join(root, 'public/brand-registry/v0.1/brands/pokemon-tcg-official/0.2.0/role-style-recipes.json'), 'utf8'))
const baseAt = process.argv.indexOf('--base-url')
const baseUrl = baseAt < 0 ? 'http://127.0.0.1:5173' : process.argv[baseAt + 1]
const executablePath = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'].find((file) => file && fs.existsSync(file))
if (!executablePath) throw new Error('Chrome or Chromium is required to verify rendered shape')
const browser = await chromium.launch({ executablePath, headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(`${baseUrl}/#/knowledge-runtime`, { waitUntil: 'networkidle' })
  const selectors = { 'query-field': '.case-shell .du-search', 'secondary-field': '.case-shell .du-input' }
  const results = []
  for (const role of recipe.shapeRoles) {
    const selector = selectors[role.id]
    if (!selector) continue
    const actual = await page.locator(selector).first().evaluate((element) => getComputedStyle(element).borderTopLeftRadius)
    results.push({ role: role.id, selector, expected: role.trialValue, actual, pass: actual === role.trialValue })
  }
  const genericFilterRadius = await page.locator('.case-tags .du-tag').first().evaluate((element) => getComputedStyle(element).borderTopLeftRadius)
  results.push({ role: 'generic-filter-not-energy-pill', expected: '<=4px', actual: genericFilterRadius, pass: parseFloat(genericFilterRadius) <= 4 })
  const images = await page.locator('img').evaluateAll((elements) => elements.map((element) => ({ src: element.currentSrc, loaded: element.complete && element.naturalWidth > 0 })))
  const loaded = images.every((image) => image.loaded)
  console.log(JSON.stringify({ ok: results.every((result) => result.pass) && loaded, results, images }, null, 2))
  if (!results.every((result) => result.pass) || !loaded) process.exitCode = 1
} finally {
  await browser.close()
}
