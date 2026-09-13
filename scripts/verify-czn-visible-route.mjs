import { chromium } from 'playwright-core'

const baseUrl = process.argv.find((arg) => arg.startsWith('--base-url='))?.split('=').slice(1).join('=')
if (!baseUrl) throw new Error('Pass --base-url=http://127.0.0.1:<port>')

const browser = await chromium.launch({ headless: true })
const failures = []
const requiredInsideStage = {
  'czn-home': ['.czn-current-download'],
  'czn-gameplay': ['.czn-current-gameplay__media', '.czn-current-controls button'],
  'czn-character': [
    '.czn-current-character__subject',
    '.czn-current-controls',
    '.czn-current-controls button:last-child img',
    '.czn-current-portraits button:last-child',
  ],
  'czn-held-out': ['.czn-current-controls', '.czn-current-controls button'],
}
try {
  for (const pageId of ['czn-home', 'czn-gameplay', 'czn-character', 'czn-held-out']) {
    const page = await browser.newPage({ viewport: { width: 2048, height: 879 } })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`${baseUrl}/#/brand/czn/pages/${pageId}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)
    const stage = page.locator('.czn-current')
    await stage.waitFor()
    const box = await stage.boundingBox()
    const phone = page.locator('.phone.template-phone')
    const phoneBox = await phone.boundingBox()
    const phoneClass = await phone.getAttribute('class')
    const screen = page.locator('.phone-screen')
    const screenBox = await screen.boundingBox()
    const screenRadius = Number.parseFloat(await screen.evaluate((element) => getComputedStyle(element).borderRadius))
    const visibleLayers = await page.locator('.czn-current-nav').count()
    const text = await stage.innerText()
    if (!phoneBox || phoneBox.width < 350 || phoneBox.height < 750) failures.push(`${pageId}: phone mockup missing or too small ${JSON.stringify(phoneBox)}`)
    if (phoneClass?.includes('template-phone--source-desktop')) failures.push(`${pageId}: normal route incorrectly used desktop shell`)
    if (!screenBox || screenRadius < 20) failures.push(`${pageId}: rounded phone screen missing ${JSON.stringify({ screenBox, screenRadius })}`)
    if (!box || box.width < 320 || box.height < 700) failures.push(`${pageId}: invisible mobile stage ${JSON.stringify(box)}`)
    if (!visibleLayers || !text.trim()) failures.push(`${pageId}: required visible layers missing`)
    if (pageId === 'czn-character') {
      const fallback = page.locator('.czn-current-character__subject--fallback')
      const loaded = await fallback.evaluate((image) => image.complete && image.naturalWidth > 0)
      if (!loaded) failures.push(`${pageId}: first-render subject fallback did not load`)
    }
    if (box) {
      for (const selector of requiredInsideStage[pageId] ?? []) {
        const elements = page.locator(selector)
        for (let index = 0; index < await elements.count(); index += 1) {
          const elementBox = await elements.nth(index).boundingBox()
          if (!elementBox) {
            failures.push(`${pageId}: ${selector}[${index}] is not visible`)
            continue
          }
          const tolerance = 1
          const outside =
            elementBox.x < box.x - tolerance ||
            elementBox.y < box.y - tolerance ||
            elementBox.x + elementBox.width > box.x + box.width + tolerance ||
            elementBox.y + elementBox.height > box.y + box.height + tolerance
          if (outside) failures.push(`${pageId}: ${selector}[${index}] clipped ${JSON.stringify(elementBox)}`)
        }
      }
    }
    if (errors.length) failures.push(`${pageId}: ${errors.join('; ')}`)
    await page.close()
  }
} finally {
  await browser.close()
}

if (failures.length) throw new Error(failures.join('\n'))
console.log(JSON.stringify({ ok: true, surface: 'normal-phone-mockup-route-without-proof-query', pages: 4 }, null, 2))
