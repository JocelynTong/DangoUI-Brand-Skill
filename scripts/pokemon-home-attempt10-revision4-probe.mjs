import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const baseUrl = process.argv[2] || 'http://127.0.0.1:5177'
const outputDir = path.resolve('migrations/pokemon-tcg-official/quality-attempts/10/demo-revision4')
const captureDir = path.join(outputDir, 'captures')
fs.mkdirSync(captureDir, { recursive: true })

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const route = '#/brand/pokemon-tcg-official/pages/pokemon-tcg-official-pocket-fixture'
const surfaces = [{ id: 'desktop-1440', width: 1440, height: 900 }, { id: 'mobile-390', width: 390, height: 844 }]
const results = []

for (const surface of surfaces) {
  const page = await browser.newPage({ viewport: { width: surface.width, height: surface.height }, deviceScaleFactor: 1 })
  const errors = []
  const warnings = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
    if (message.type() === 'warning') warnings.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  const query = surface.id === 'desktop-1440' ? '?qa=attempt10-revision4&proof=desktop' : '?qa=attempt10-revision4'
  const directUrl = `${baseUrl}/${query}${route}`
  await page.goto(directUrl, { waitUntil: 'networkidle' })
  const fixture = page.locator('[data-schema-section-id="held-out-pocket-family"]')
  const cta = fixture.locator('.pokemon-pocket__cta')
  await fixture.waitFor()
  await fixture.screenshot({ path: path.join(captureDir, `held-out-${surface.id}-before.png`) })
  const before = await page.evaluate(() => {
    const section = document.querySelector('[data-schema-section-id="held-out-pocket-family"]')
    const cta = section.querySelector('.pokemon-pocket__cta')
    const r = section.getBoundingClientRect()
    const copy = section.querySelector('.pokemon-pocket__copy').getBoundingClientRect()
    return { url: location.href, tagName: cta.tagName, type: cta.getAttribute('type'), href: cta.getAttribute('href'), pressed: cta.getAttribute('aria-pressed'), section: { width: r.width, height: r.height }, copy: { x: copy.x - r.x, y: copy.y - r.y, width: copy.width, height: copy.height }, overflow: section.scrollWidth > section.clientWidth }
  })
  await cta.click()
  const afterClick = await page.evaluate(() => {
    const section = document.querySelector('[data-schema-section-id="held-out-pocket-family"]')
    const cta = section.querySelector('.pokemon-pocket__cta')
    return { url: location.href, fixtureVisible: !!section, pressed: cta.getAttribute('aria-pressed'), liveText: section.querySelector('[aria-live="polite"]')?.textContent.trim() }
  })
  await fixture.screenshot({ path: path.join(captureDir, `held-out-${surface.id}-after-local-review.png`) })
  await page.reload({ waitUntil: 'networkidle' })
  const afterReload = await page.evaluate(() => ({ url: location.href, fixtureVisible: !!document.querySelector('[data-schema-section-id="held-out-pocket-family"]'), pressed: document.querySelector('[data-schema-section-id="held-out-pocket-family"] .pokemon-pocket__cta')?.getAttribute('aria-pressed') }))
  results.push({ surface, before, afterClick, afterReload, console: { errors, warnings } })
  await page.close()
}

await browser.close()
const checks = {
  semanticLocalAction: results.every(r => r.before.tagName === 'BUTTON' && r.before.type === 'button' && r.before.href === null),
  clickChangesLocalState: results.every(r => r.before.pressed === 'false' && r.afterClick.pressed === 'true' && r.afterClick.liveText.includes('route remains open')),
  clickPreservesDirectRoute: results.every(r => r.afterClick.url === r.before.url && r.afterClick.url.endsWith(route) && r.afterClick.fixtureVisible),
  reloadPreservesDirectFixture: results.every(r => r.afterReload.url === r.before.url && r.afterReload.url.endsWith(route) && r.afterReload.fixtureVisible),
  visualGeometryPreserved: results[0].before.section.width === 1440 && Math.abs(results[0].before.section.height - 476.195) < 1 && results[0].before.copy.x === 0 && Math.abs(results[0].before.copy.y - 59.85) < 1 && results[1].before.section.width === 390 && Math.abs(results[1].before.section.height - 743.023) < 1 && Math.abs(results[1].before.copy.y - 334.23) < 1,
  noOverflow: results.every(r => !r.before.overflow),
  consoleClean: results.every(r => r.console.errors.length === 0 && r.console.warnings.length === 0),
}
const output = { schema: 'brand-browser-probes/v1', brand: 'pokemon-tcg-official', attempt: '10-demo-revision4', scope: 'held-out Pocket fixture local CTA route safety only', route, results, checks, implementationChecksPass: Object.values(checks).every(Boolean), visualVerdict: 'not-assigned-by-implementation-agent' }
fs.writeFileSync(path.join(outputDir, 'browser-probes.json'), `${JSON.stringify(output, null, 2)}\n`)
if (!output.implementationChecksPass) process.exitCode = 1
