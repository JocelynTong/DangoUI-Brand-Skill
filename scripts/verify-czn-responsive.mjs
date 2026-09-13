import { chromium } from 'playwright-core'

const baseUrl = process.argv.find((arg) => arg.startsWith('--base-url='))?.split('=').slice(1).join('=')
if (!baseUrl) throw new Error('Pass --base-url=http://127.0.0.1:<port>')

const viewports = [
  { width: 2048, height: 879, label: 'wide' },
  { width: 1280, height: 800, label: 'medium' },
  { width: 1024, height: 768, label: 'narrow' },
]
const pageIds = ['czn-home', 'czn-gameplay', 'czn-character', 'czn-held-out']
const failures = []
const inside = (outer, inner, tolerance = 1) => inner &&
  inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance &&
  inner.x + inner.width <= outer.x + outer.width + tolerance &&
  inner.y + inner.height <= outer.y + outer.height + tolerance
const overlaps = (a, b) => a && b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y

const browser = await chromium.launch({ headless: true })
try {
  for (const viewport of viewports) {
    for (const pageId of pageIds) {
      const page = await browser.newPage({ viewport })
      await page.goto(`${baseUrl}/#/brand/czn/pages/${pageId}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(900)
      const result = await page.evaluate(() => {
        const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect().toJSON() || null
        return {
          phone: rect('.phone'),
          screen: rect('.phone-screen'),
          stage: rect('.czn-current'),
          phoneClass: document.querySelector('.phone')?.className || '',
          radius: Number.parseFloat(getComputedStyle(document.querySelector('.phone-screen')).borderRadius),
          scrollWidth: document.querySelector('.phone-screen')?.scrollWidth || 0,
          clientWidth: document.querySelector('.phone-screen')?.clientWidth || 0,
          navRects: [...document.querySelectorAll('.czn-current-nav > *')].filter((node) => getComputedStyle(node).display !== 'none').map((node) => node.getBoundingClientRect().toJSON()),
          controls: [...document.querySelectorAll('.czn-current-controls button, .czn-current-download button')].map((node) => node.getBoundingClientRect().toJSON()),
          disclosure: rect('.czn-current-heldout__disclosure'),
          heldoutHeading: rect('.czn-current-heldout__heading h2'),
          gameplayColor: document.querySelector('.czn-current-gameplay header') ? getComputedStyle(document.querySelector('.czn-current-gameplay header')).color : null,
        }
      })
      const key = `${viewport.label}/${pageId}`
      if (!result.phone || result.phone.width < 320 || result.phone.height < 680) failures.push(`${key}: phone mockup too small`)
      if (!result.screen || result.radius < 20) failures.push(`${key}: phone screen shell missing`)
      if (!result.stage || !inside(result.screen, result.stage)) failures.push(`${key}: stage escapes phone screen`)
      if (result.phoneClass.includes('template-phone--source-desktop')) failures.push(`${key}: desktop shell used on normal route`)
      if (result.scrollWidth > result.clientWidth + 1) failures.push(`${key}: horizontal overflow`)
      for (let index = 0; index < result.navRects.length; index += 1) {
        if (!inside(result.screen, result.navRects[index])) failures.push(`${key}: nav item ${index} clipped`)
      }
      for (let index = 0; index < result.controls.length; index += 1) {
        const control = result.controls[index]
        if (control.width < 44 || control.height < 44 || !inside(result.stage, control)) failures.push(`${key}: control ${index} is clipped or undersized`)
      }
      if (pageId === 'czn-held-out' && overlaps(result.disclosure, result.heldoutHeading)) failures.push(`${key}: held-out headings overlap`)
      if (pageId === 'czn-gameplay' && result.gameplayColor !== 'rgb(23, 23, 26)') failures.push(`${key}: gameplay heading lacks light-background contrast`)
      await page.close()
    }
  }
} finally {
  await browser.close()
}

if (failures.length) throw new Error(failures.join('\n'))
console.log(JSON.stringify({ ok: true, viewports: viewports.map(({ label, width, height }) => ({ label, width, height })), pages: pageIds.length }, null, 2))
