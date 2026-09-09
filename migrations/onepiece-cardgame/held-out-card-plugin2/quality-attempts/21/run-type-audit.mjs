import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
const out = path.dirname(new URL(import.meta.url).pathname)
const origin = 'http://127.0.0.1:10092'
const routes = { plaza: '/#/pages/plaza/index', event: '/#/pages/event/index?id=0', detail: '/#/pages/detail/index?id=0', build: '/#/pages/build/index', mine: '/#/pages/mine/index', round: '/#/pages/round/index?event=0&round=0' }
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] })
const findings = []
for (const [route, suffix] of Object.entries(routes)) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto(origin + suffix, { waitUntil: 'networkidle' })
  findings.push({ route, samples: await page.evaluate(() => [...document.querySelectorAll('*')].filter(e => {
    const s = getComputedStyle(e), r = e.getBoundingClientRect(), text = (e.textContent || '').trim()
    return e.children.length === 0 && text && s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0 && parseFloat(s.fontSize) < 10
  }).map(e => ({ text: e.textContent.trim().slice(0, 80), className: e.className, fontSize: parseFloat(getComputedStyle(e).fontSize), lineHeight: getComputedStyle(e).lineHeight, color: getComputedStyle(e).color }))) })
  await context.close()
}
await browser.close()
await fs.writeFile(path.join(out, 'type-scale-audit.json'), JSON.stringify({ schema: 'heldout-full-host-type-scale-audit/v1', attempt: 21, viewport: { width: 390, height: 844 }, findings }, null, 2) + '\n')
