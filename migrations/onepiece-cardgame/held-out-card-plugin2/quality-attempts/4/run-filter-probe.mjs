import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'

const out = path.dirname(new URL(import.meta.url).pathname)
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] })
const results = []
for (const mechanism of ['pointer', 'Enter', 'Space']) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const requests = []
  page.on('request', req => requests.push({ method: req.method(), url: req.url() }))
  await page.goto('http://127.0.0.1:10092/#/pages/plaza/index', { waitUntil: 'networkidle' })
  const button = page.getByRole('button', { name: /^玩家发布$/ }).first()
  const snap = async () => button.evaluate(el => ({ className: String(el.className), ariaPressed: el.getAttribute('aria-pressed'), text: document.body.innerText.slice(0, 1400), url: location.href }))
  const before = await snap()
  await button.focus()
  if (mechanism === 'pointer') await button.click(); else await button.press(mechanism)
  await page.waitForTimeout(160)
  const after = await snap()
  results.push({ mechanism, before, after, stateChanged: before.className !== after.className || before.ariaPressed !== after.ariaPressed || before.text !== after.text, writes: requests.filter(r => !['GET', 'HEAD', 'OPTIONS'].includes(r.method)) })
  await context.close()
}
await browser.close()
await fs.writeFile(path.join(out, 'filter-parity.json'), JSON.stringify({ schema: 'heldout-plaza-filter-parity/v1', generatedAt: new Date().toISOString(), results }, null, 2) + '\n')
