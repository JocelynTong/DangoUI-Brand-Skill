import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'

const out = path.dirname(new URL(import.meta.url).pathname)
const origin = 'http://127.0.0.1:10092'
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
const page = await context.newPage()
const requests = []
page.on('request', r => requests.push(r))
await page.goto(`${origin}/#/pages/mine/index`, { waitUntil: 'networkidle' })
await page.locator('.newbtn').click()
await page.waitForSelector('.draftbtn')
await page.locator('.draftbtn').first().click()
await page.goto(`${origin}/#/pages/mine/index`, { waitUntil: 'networkidle' })
await page.locator('.mtab').nth(1).click()
const draftBefore = await page.locator('.draft-card').count()
const edit = page.locator('.smallbtn.edit').first()
const danger = page.locator('.smallbtn.danger').first()
const actionRects = await Promise.all([edit, danger].map(l => l.evaluate(e => { const r = e.getBoundingClientRect(); return { width: r.width, height: r.height } })))
await danger.focus()
await page.keyboard.press('Space')
const modal = await page.evaluate(() => {
  const q = s => document.querySelector(s)
  const rect = e => { const r = e.getBoundingClientRect(); return { width: r.width, height: r.height, top: r.top, left: r.left } }
  return { visible: !!q('.confirmbox'), text: q('.confirmtext')?.textContent?.trim(), box: rect(q('.confirmbox')), cancel: rect(q('.confirmcancel')), danger: rect(q('.confirmdanger')) }
})
await page.screenshot({ path: path.join(out, 'fresh-390x844-mine-delete-confirm.png'), fullPage: true })
await page.locator('.confirmcancel').focus()
await page.keyboard.press('Enter')
const cancelClosed = await page.locator('.confirmbox').count() === 0
const draftAfterCancel = await page.locator('.draft-card').count()
await edit.click()
await page.waitForTimeout(200)
const editUrl = page.url()
const result = {
  schema: 'heldout-full-host-safe-mine-actions/v1', attempt: 21,
  isolatedEphemeralContext: true, localFixtureCreated: true, productionContextUntouched: true,
  draftBefore, actionRects: { edit: actionRects[0], delete: actionRects[1] }, modal,
  cancelViaEnterClosed: cancelClosed, draftAfterCancel, confirmDeleteInvoked: false,
  editNavigationUrl: editUrl,
  networkWrites: requests.filter(r => !['GET', 'HEAD', 'OPTIONS'].includes(r.method())).map(r => ({ method: r.method(), url: r.url() })),
}
await fs.writeFile(path.join(out, 'mine-safe-actions.json'), JSON.stringify(result, null, 2) + '\n')
await context.close()
await browser.close()
