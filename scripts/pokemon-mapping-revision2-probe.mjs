import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const baseUrl = process.argv[2] || 'http://127.0.0.1:5177'
const outputRoot = path.resolve('migrations/pokemon-tcg-official/quality-attempts/12/revision2')
const captureRoot = path.join(outputRoot, 'captures')
fs.mkdirSync(captureRoot, { recursive: true })

const pageSpecs = [
  { short: 'home', id: 'pokemon-tcg-official-home', sections: ['home-campaign-stage', 'home-news-grid', 'home-product-bands', 'home-editorial-grid'] },
  { short: 'card-database', id: 'pokemon-tcg-official-card-database', sections: ['card-database-search-shell'] },
  { short: 'learn', id: 'pokemon-tcg-official-learn', sections: ['learn-getting-started', 'learn-card-breakdown', 'learn-field-of-play'] },
  { short: 'held-out', id: 'pokemon-tcg-official-held-out', sections: ['held-out-deck-entry', 'held-out-deck-steps'] },
]

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const results = []

for (const spec of pageSpecs) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
  await page.goto(`${baseUrl}/#/brand/pokemon-tcg-official/pages/${spec.id}`, { waitUntil: 'networkidle' })
  await page.waitForSelector(`.source-schema-demo[data-page-id="${spec.id}"]`)
  const visiblePageIds = await page.locator('.page-tab').allTextContents().catch(() => [])
  const screenProbe = await page.locator('.phone-screen').evaluate(async (node) => {
    const before = node.scrollTop
    node.scrollTop = Math.min(420, node.scrollHeight - node.clientHeight)
    await new Promise((resolve) => setTimeout(resolve, 80))
    const after = node.scrollTop
    node.scrollTop = before
    await new Promise((resolve) => setTimeout(resolve, 80))
    return { clientWidth: node.clientWidth, clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, before, after, restored: node.scrollTop }
  })
  const sectionResults = []
  for (const sectionId of spec.sections) {
    const locator = page.locator(`[data-schema-section-id="${sectionId}"]`)
    const geometry = await locator.evaluate((node) => {
      const rect = node.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    })
    const screenshot = path.join(captureRoot, `${spec.short}-${sectionId}.png`)
    await locator.screenshot({ path: screenshot })
    sectionResults.push({ sectionId, selector: `[data-schema-section-id="${sectionId}"]`, geometry, screenshot: path.relative(process.cwd(), screenshot) })
  }
  const images = await page.locator('.source-schema-demo img').evaluateAll((nodes) => nodes.map((img) => ({ src: img.currentSrc || img.src, loaded: img.complete && img.naturalWidth > 0 })))
  results.push({ pageId: spec.id, visiblePageIds, screenProbe, sections: sectionResults, brokenImages: images.filter((item) => !item.loaded) })
  await page.close()
}

const database = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
await database.goto(`${baseUrl}/#/brand/pokemon-tcg-official/pages/pokemon-tcg-official-card-database`, { waitUntil: 'networkidle' })
const grass = database.getByRole('button', { name: 'Grass', exact: true })
const databaseSection = database.locator('[data-schema-section-id="card-database-search-shell"]')
const dbResponsive = await database.locator('.pokemon-db').evaluate((node) => ({
  fieldColumns: getComputedStyle(node.querySelector('.pokemon-db__field-grid')).gridTemplateColumns,
  energyColumns: getComputedStyle(node.querySelector('.pokemon-db__energy')).gridTemplateColumns,
}))
const energyStates = [{ id: 'default', ariaPressed: await grass.getAttribute('aria-pressed'), className: await grass.getAttribute('class') }]
await grass.click()
energyStates.push({ id: 'selected', ariaPressed: await grass.getAttribute('aria-pressed'), className: await grass.getAttribute('class') })
await grass.click()
energyStates.push({ id: 'restored', ariaPressed: await grass.getAttribute('aria-pressed'), className: await grass.getAttribute('class') })
await database.locator('.pokemon-db__advanced-toggle').click()
await database.waitForTimeout(520)
const advancedCapture = path.join(captureRoot, 'card-database-advanced-filter.png')
await databaseSection.screenshot({ path: advancedCapture })
const advancedGeometry = await database.locator('.pokemon-db__advanced').evaluate((node) => { const rect = node.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height } })
await database.locator('.pokemon-db__advanced-toggle').click()
await database.locator('#pokemon-card-name').fill('Pikachu')
await database.locator('.pokemon-db__submit').first().click()
await database.waitForSelector('.pokemon-db__results')
const resultsCapture = path.join(captureRoot, 'card-database-results.png')
await databaseSection.screenshot({ path: resultsCapture })
const resultsGeometry = await database.locator('.pokemon-db__results').evaluate((node) => { const rect = node.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height } })
await database.close()
await browser.close()

const payload = {
  schema: 'pokemon-demo-revision2-probes/v1',
  brand: 'pokemon-tcg-official',
  capturedAt: new Date().toISOString(),
  baseUrl,
  excludedPageIds: ['pokemon-tcg-official-pocket-fixture', 'pokemon-tcg-official-championship-fixture'],
  pages: results,
  database: {
    responsive: dbResponsive,
    energyStates,
    advanced: { geometry: advancedGeometry, screenshot: path.relative(process.cwd(), advancedCapture) },
    results: { geometry: resultsGeometry, screenshot: path.relative(process.cwd(), resultsCapture) },
  },
}
fs.writeFileSync(path.join(outputRoot, 'browser-probes.json'), `${JSON.stringify(payload, null, 2)}\n`)
console.log(JSON.stringify(payload, null, 2))
