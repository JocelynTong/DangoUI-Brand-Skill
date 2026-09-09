import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const out = path.dirname(new URL(import.meta.url).pathname)
const origin = 'http://127.0.0.1:10092'
const mineUrl = `${origin}/#/pages/mine/index`
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox'],
})
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const writes = requests => requests.filter(r => !['GET', 'HEAD', 'OPTIONS'].includes(r.method()))
const viewports = [{ width: 390, height: 844 }, { width: 536, height: 864 }, { width: 1280, height: 720 }]
const renders = []

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const requests = []
  page.on('request', r => requests.push(r))
  await page.goto(mineUrl, { waitUntil: 'networkidle', timeout: 30000 })

  const branches = []
  for (const [index, key, keypress] of [[0, 'favorite', 'Enter'], [1, 'draft', 'Space'], [2, 'published', 'Enter'], [3, 'hidden', 'Space']]) {
    const tab = page.locator('.mtab').nth(index)
    await tab.focus()
    await page.keyboard.press(keypress)
    branches.push({
      key,
      selected: await tab.getAttribute('aria-selected'),
      cards: await page.locator('.deck-card,.draft-card').count(),
      emptyVisible: await page.locator('.empty').isVisible().catch(() => false),
      focusOutline: await tab.evaluate(e => {
        const s = getComputedStyle(e)
        return { outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, boxShadow: s.boxShadow }
      }),
    })
  }
  await page.locator('.mtab').first().click()

  const probe = await page.evaluate(() => {
    const rect = e => { const r = e.getBoundingClientRect(); return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height } }
    const visible = e => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0 }
    const controls = [...document.querySelectorAll('.page [role="button"],.page [role="tab"]')].filter(visible)
    return {
      viewport: { width: innerWidth, height: innerHeight },
      composition: {
        profile: rect(document.querySelector('.profile')),
        create: rect(document.querySelector('.newbtn')),
        tabs: rect(document.querySelector('.mtabs')),
        firstInventory: rect(document.querySelector('.deck-card,.draft-card,.empty')),
      },
      overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      controls: controls.map(e => ({ text: (e.textContent || '').trim().slice(0, 60), role: e.getAttribute('role'), tabindex: e.getAttribute('tabindex'), rect: rect(e) })),
      undersizedControls: controls.filter(e => { const r = e.getBoundingClientRect(); return r.width < 44 || r.height < 44 }).length,
      reducedMotionMedia: matchMedia('(prefers-reduced-motion: reduce)').matches,
      activeMotion: controls.filter(e => {
        const s = getComputedStyle(e)
        return s.animationName !== 'none' || s.transitionDuration.split(',').some(x => parseFloat(x) > 0)
      }).map(e => (e.textContent || '').trim().slice(0, 40)),
      forbiddenVisualClasses: {
        hero: document.querySelectorAll('.hero').length,
        pills: [...document.querySelectorAll('.page *')].filter(e => parseFloat(getComputedStyle(e).borderRadius) >= 999).length,
      },
    }
  })
  const png = await page.screenshot({ path: path.join(out, `fresh-${viewport.width}x${viewport.height}-mine.png`), fullPage: true })
  renders.push({ viewport, screenshotSha256: sha(png), probe, branches, externalNetworkWrites: writes(requests).map(r => ({ method: r.method(), url: r.url() })) })
  await context.close()
}

// Isolated context: create one local-only draft, open the destructive confirmation,
// then cancel. The context is discarded and the confirm action is never invoked.
const fixtureContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
const fixture = await fixtureContext.newPage()
const fixtureRequests = []
fixture.on('request', r => fixtureRequests.push(r))
await fixture.goto(mineUrl, { waitUntil: 'networkidle', timeout: 30000 })
await fixture.locator('.newbtn').click()
await fixture.waitForSelector('.draftbtn', { timeout: 10000 })
await fixture.locator('.draftbtn').first().click()
await fixture.goto(`${mineUrl}?tab=draft`, { waitUntil: 'networkidle', timeout: 30000 })
await fixture.locator('.mtab').nth(1).click()
const draftBefore = await fixture.locator('.draft-card').count()
const edit = fixture.locator('.smallbtn.edit').first()
const danger = fixture.locator('.smallbtn.danger').first()
const actionRects = await Promise.all([edit, danger].map(l => l.evaluate(e => { const r = e.getBoundingClientRect(); return { width: r.width, height: r.height } })))
await danger.focus()
await fixture.keyboard.press('Space')
const modal = await fixture.evaluate(() => {
  const box = document.querySelector('.confirmbox')
  const rect = e => { const r = e.getBoundingClientRect(); return { width: r.width, height: r.height, top: r.top, left: r.left } }
  return {
    visible: !!box,
    text: document.querySelector('.confirmtext')?.textContent?.trim(),
    box: rect(box),
    cancel: rect(document.querySelector('.confirmcancel')),
    danger: rect(document.querySelector('.confirmdanger')),
  }
})
const modalPng = await fixture.screenshot({ path: path.join(out, 'fresh-390x844-mine-delete-confirm.png'), fullPage: true })
await fixture.locator('.confirmcancel').focus()
await fixture.keyboard.press('Enter')
const modalClosed = await fixture.locator('.confirmbox').count() === 0
const draftAfterCancel = await fixture.locator('.draft-card').count()
const deleteConfirm = {
  isolatedEphemeralContext: true,
  localFixtureCreated: true,
  productionContextUntouched: true,
  draftBefore,
  actionRects: { edit: actionRects[0], delete: actionRects[1] },
  modal,
  modalScreenshotSha256: sha(modalPng),
  cancelViaEnterClosed: modalClosed,
  draftAfterCancel,
  confirmDeleteInvoked: false,
  externalNetworkWrites: writes(fixtureRequests).map(r => ({ method: r.method(), url: r.url() })),
}
await fixtureContext.close()

const regression = []
for (const route of ['plaza', 'build', 'detail', 'event', 'round']) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const requests = []
  page.on('request', r => requests.push(r))
  const suffix = route === 'detail' || route === 'event' ? '?id=0' : route === 'round' ? '?event=0&round=1' : ''
  await page.goto(`${origin}/#/pages/${route}/index${suffix}`, { waitUntil: 'networkidle', timeout: 30000 })
  const png = await page.screenshot({ fullPage: true })
  regression.push({
    route,
    screenshotSha256: sha(png),
    overflowX: await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)),
    externalNetworkWrites: writes(requests).map(r => ({ method: r.method(), url: r.url() })),
  })
  await context.close()
}

await browser.close()
await fs.writeFile(path.join(out, 'fresh-browser-probes.json'), JSON.stringify({
  schema: 'heldout-mine-fresh-independent-qa/v1',
  attempt: 18,
  generatedAt: new Date().toISOString(),
  renders,
  deleteConfirm,
  regression,
}, null, 2) + '\n')
