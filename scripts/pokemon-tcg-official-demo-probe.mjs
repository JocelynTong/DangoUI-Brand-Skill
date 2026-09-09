import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const baseUrl = process.argv[2] || 'http://127.0.0.1:5174'
const onlyPage = process.argv[3] || ''
const onlyViewport = process.argv[4] || ''
const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const outputRoot = path.resolve('migrations/pokemon-tcg-official/captures/demo')
fs.mkdirSync(outputRoot, { recursive: true })
const pages = ['home', 'card-database', 'learn', 'held-out'].map((short) => ({ short, id: `pokemon-tcg-official-${short}` }))
const probes = []
const screenshots = []
const browser = await chromium.launch({ executablePath, headless: true })

for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile-390', width: 390, height: 844 }].filter((item) => !onlyViewport || item.name === onlyViewport)) {
  for (const pageConfig of pages.filter((item) => !onlyPage || item.short === onlyPage)) {
    console.log(`capture ${pageConfig.short}/${viewport.name}`)
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 })
    await page.goto(`${baseUrl}/#/brand/pokemon-tcg-official/pages/${pageConfig.id}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector(`.source-schema-demo[data-page-id="${pageConfig.id}"]`)
    await page.waitForTimeout(180)
    const screen = page.locator('.phone-screen')
    const shotDir = path.join(outputRoot, pageConfig.short, viewport.name)
    fs.mkdirSync(shotDir, { recursive: true })
    const shot = path.join(shotDir, 'full-page.png')
    await screen.screenshot({ path: shot })
    screenshots.push({ pageId: pageConfig.id, viewport, path: path.relative(process.cwd(), shot) })
    const scroll = await screen.evaluate(async (node) => {
      const before = node.scrollTop
      node.scrollTop = Math.min(500, node.scrollHeight - node.clientHeight)
      await new Promise((resolve) => setTimeout(resolve, 80))
      const after = node.scrollTop
      node.scrollTop = before
      await new Promise((resolve) => setTimeout(resolve, 80))
      return { clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, before, after, restored: node.scrollTop }
    })
    probes.push({ pageId: pageConfig.id, viewport: viewport.name, scroll })
    await page.close()
  }
}

const database = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
await database.goto(`${baseUrl}/#/brand/pokemon-tcg-official/pages/pokemon-tcg-official-card-database`, { waitUntil: 'domcontentloaded' })
await database.waitForSelector('.pokemon-db')
const state = async () => database.locator('.pokemon-db').evaluate((node) => { const drawer = node.querySelector('.pokemon-db__advanced'); return ({ search: node.dataset.searchState, advancedText: node.querySelector('.pokemon-db__advanced-toggle')?.textContent.trim(), advancedExpanded: node.querySelector('.pokemon-db__advanced-toggle')?.getAttribute('aria-expanded'), advancedHeight: drawer?.dataset.heightState, advancedComputedHeight: getComputedStyle(drawer).height, advancedRectHeight: drawer.getBoundingClientRect().height, results: node.querySelector('.pokemon-db__results')?.textContent.includes('Search Results') || false, page: node.querySelector('.pokemon-db__page-count')?.textContent || null }) })
const sequence = [{ id: 'empty', state: await state() }]
await database.locator('#pokemon-card-name').fill('Pikachu')
sequence.push({ id: 'pikachu', state: await state() })
await database.locator('.pokemon-db__submit').first().click()
await database.waitForSelector('.pokemon-db__results')
sequence.push({ id: 'results', state: await state() })
await database.locator('.pokemon-db__reset').first().click()
sequence.push({ id: 'reset', state: await state() })
const advanced = [{ id: 'default', state: await state() }]
await database.locator('.pokemon-db__advanced-toggle').click()
advanced.push({ id: 'triggered', state: await state() })
await database.waitForTimeout(550)
advanced.push({ id: 'settled', state: await state() })
await database.locator('.pokemon-db__advanced-toggle').click()
advanced.push({ id: 'restored', state: await state() })
probes.push({ pageId: 'pokemon-tcg-official-card-database', interaction: { search: sequence, advanced } })
await database.close()
await browser.close()

const probeFile = path.resolve('migrations/pokemon-tcg-official/demo-browser-probes.json')
const screenshotFile = path.resolve('migrations/pokemon-tcg-official/demo-screenshot-manifest.json')
const oldProbes = fs.existsSync(probeFile) ? JSON.parse(fs.readFileSync(probeFile, 'utf8')).probes || [] : []
const oldShots = fs.existsSync(screenshotFile) ? JSON.parse(fs.readFileSync(screenshotFile, 'utf8')).screenshots || [] : []
const mergedProbes = [...oldProbes.filter((old) => !probes.some((next) => old.pageId === next.pageId && old.viewport === next.viewport && Boolean(old.interaction) === Boolean(next.interaction))), ...probes]
const mergedShots = [...oldShots.filter((old) => !screenshots.some((next) => old.pageId === next.pageId && old.viewport?.name === next.viewport?.name)), ...screenshots]
fs.writeFileSync(probeFile, `${JSON.stringify({ schema: 'brand-demo-browser-probes/v1', brand: 'pokemon-tcg-official', generatedAt: new Date().toISOString(), baseUrl, probes: mergedProbes }, null, 2)}\n`)
fs.writeFileSync(screenshotFile, `${JSON.stringify({ schema: 'brand-demo-screenshot-manifest/v1', brand: 'pokemon-tcg-official', generatedAt: new Date().toISOString(), screenshots: mergedShots }, null, 2)}\n`)
console.log(`pokemon-tcg-official probe: screenshots=${screenshots.length} probes=${probes.length}`)
