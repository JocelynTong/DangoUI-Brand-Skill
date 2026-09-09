import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { chromium } from 'playwright-core'

const root = process.cwd()
const attemptRoot = path.join(root, 'migrations/onepiece-cardgame/quality-attempts/13/implementation')
const captureDir = path.join(attemptRoot, 'captures')
fs.mkdirSync(captureDir, { recursive: true })
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1164, height: 655 }, deviceScaleFactor: 1 })
const base = `${process.env.ATTEMPT13_BASE_URL || 'http://127.0.0.1:5174'}/#/brand/onepiece-cardgame/pages/`

await page.goto(`${base}onepiece-cardgame-home`, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-schema-section-id="home-new-arrival"]', { state: 'attached' })
const screen = page.locator('.source-schema-demo[data-page-id="onepiece-cardgame-home"]').locator('xpath=ancestor::*[contains(@class,"phone-screen")]')
const captureSection = async (id, name) => {
  const section = page.locator(`[data-schema-section-id="${id}"]`)
  await section.scrollIntoViewIfNeeded()
  await section.screenshot({ path: path.join(captureDir, name) })
}
await captureSection('home-events', 'events-390.png')
await captureSection('home-recommend', 'recommend-390.png')
await captureSection('home-new-arrival', 'new-arrival-before.png')

const state = () => page.evaluate(() => {
  const section = document.querySelector('[data-schema-section-id="home-new-arrival"]')
  const track = section.querySelector('.source-schema-demo__home-editorial-list')
  const [previous, next] = section.querySelectorAll('.opcg-arrival-controls button')
  const button = (node) => ({ ariaDisabled: node.getAttribute('aria-disabled'), tabindex: node.getAttribute('tabindex'), disabled: node.disabled, pointerEvents: getComputedStyle(node).pointerEvents, opacity: Number(getComputedStyle(node).opacity) })
  return { activeAriaLabel: track.getAttribute('aria-label'), transform: getComputedStyle(track).transform, previous: button(previous), next: button(next) }
})
const initial = await state()
await page.getByRole('button', { name: 'Next products' }).click()
await page.waitForTimeout(400)
const afterNext = await state()
await captureSection('home-new-arrival', 'new-arrival-after-next.png')
await page.getByRole('button', { name: 'Previous products' }).click()
await page.waitForTimeout(400)
const restored = await state()

const assets = await page.evaluate(() => {
  const inspect = (id) => [...document.querySelectorAll(`[data-schema-section-id="${id}"] img`)].map((img) => ({ src: new URL(img.currentSrc).pathname, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, objectFit: getComputedStyle(img).objectFit }))
  return { events: inspect('home-events'), recommend: inspect('home-recommend') }
})
const homeBoundary = await page.evaluate(() => ({ heldOutSectionCount: document.querySelectorAll('[data-schema-section-id^="held-out-"]').length, scrollWidth: document.querySelector('.phone-screen').scrollWidth, clientWidth: document.querySelector('.phone-screen').clientWidth }))

await page.goto(`${base}onepiece-cardgame-editorial-held-out`, { waitUntil: 'networkidle' })
await page.waitForSelector('.source-schema-demo[data-page-id="onepiece-cardgame-editorial-held-out"]')
await page.screenshot({ path: path.join(captureDir, 'held-out-route.png') })
const heldOut = await page.evaluate(() => ({ pageId: document.querySelector('.source-schema-demo')?.dataset.pageId, sections: [...document.querySelectorAll('.source-schema-demo > section')].map((node) => node.dataset.schemaSectionId), route: location.hash }))

const files = fs.readdirSync(captureDir).sort().map((name) => {
  const bytes = fs.readFileSync(path.join(captureDir, name))
  return { path: `migrations/onepiece-cardgame/quality-attempts/13/implementation/captures/${name}`, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }
})
fs.writeFileSync(path.join(attemptRoot, 'interaction-trace.json'), `${JSON.stringify({ schema: 'attempt13-new-arrival-interaction-trace/v1', sequence: ['initial', 'next', 'previous'], initial, afterNext, restored }, null, 2)}\n`)
fs.writeFileSync(path.join(attemptRoot, 'browser-probes.json'), `${JSON.stringify({ schema: 'attempt13-implementation-browser-probes/v1', assets, homeBoundary, heldOut }, null, 2)}\n`)
fs.writeFileSync(path.join(captureDir, 'manifest.json'), `${JSON.stringify({ schema: 'attempt13-implementation-captures/v1', viewport: { width: 1164, height: 655 }, phoneCanvasWidth: 390, files }, null, 2)}\n`)
console.log(JSON.stringify({ initial, afterNext, restored, assets, homeBoundary, heldOut, files }, null, 2))
await browser.close()
