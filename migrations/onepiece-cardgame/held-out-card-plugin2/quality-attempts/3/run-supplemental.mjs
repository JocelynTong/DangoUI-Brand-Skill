import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'

const out = path.dirname(new URL(import.meta.url).pathname)
const base = 'http://127.0.0.1:10092/#/'
const routes = [
  ['plaza', 'pages/plaza/index'], ['build', 'pages/build/index'], ['mine', 'pages/mine/index'],
  ['event', 'pages/event/index?id=0'], ['round', 'pages/round/index?event=0&round=1'], ['detail', 'pages/detail/index?id=0'],
]
const viewports = [['mobile-390x844', 390, 844], ['desktop-1280x720', 1280, 720]]
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] })
const rows = []

for (const [vp, width, height] of viewports) for (const [route, routePath] of routes) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto(base + routePath, { waitUntil: 'networkidle' })
  const motion = await page.evaluate(() => {
    const pageRoot = document.querySelector('.taro_page_show')?.firstElementChild
    const nodes = pageRoot ? [pageRoot, ...pageRoot.querySelectorAll('*')] : []
    const offenders = nodes.map(el => { const s = getComputedStyle(el); return { tag: el.tagName, cls: String(el.className || ''), animationName: s.animationName, animationDuration: s.animationDuration, transitionDuration: s.transitionDuration, transitionDelay: s.transitionDelay } })
      .filter(x => x.animationName !== 'none' || x.animationDuration.split(',').some(v => v.trim() !== '0s') || x.transitionDuration.split(',').some(v => v.trim() !== '0s') || x.transitionDelay.split(',').some(v => v.trim() !== '0s'))
    return { pageRoot: pageRoot ? { tag: pageRoot.tagName, cls: String(pageRoot.className || '') } : null, checkedNodes: nodes.length, offenders }
  })
  const controls = page.locator('[role="button"],[role="tab"]')
  const count = await controls.count()
  const controlAudit = []
  for (let i = 0; i < count; i++) {
    const control = controls.nth(i)
    if (!await control.isVisible()) continue
    await control.scrollIntoViewIfNeeded().catch(() => {})
    await control.focus().catch(() => {})
    controlAudit.push(await control.evaluate((el, index) => {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return { index, role: el.getAttribute('role'), text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100), tabindex: el.getAttribute('tabindex'), ariaSelected: el.getAttribute('aria-selected'), rect: { x: r.x, y: r.y, width: r.width, height: r.height }, centerHitOwner: hit === el || el.contains(hit), hitClass: String(hit?.className || ''), focused: document.activeElement === el, focusVisible: s.outlineStyle !== 'none' || s.boxShadow !== 'none' }
    }, i))
  }
  rows.push({ vp, route, motion, controls: controlAudit, summary: { rendered: controlAudit.length, sub44: controlAudit.filter(x => x.rect.width < 44 || x.rect.height < 44).length, missingSemantics: controlAudit.filter(x => x.tabindex !== '0' || (x.role === 'tab' && x.ariaSelected === null)).length, hitFailures: controlAudit.filter(x => !x.centerHitOwner).length, focusFailures: controlAudit.filter(x => !x.focused || !x.focusVisible).length } })
  await context.close()
}

async function journey(name, enterPath, controlName) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const snapshots = []
  const snap = async phase => snapshots.push(await page.evaluate(phase => ({ phase, url: location.href, rootClass: document.documentElement.className, title: document.title, text: document.body.innerText.slice(0, 240) }), phase))
  await page.goto(base + enterPath, { waitUntil: 'networkidle' }); await snap('cold-parent')
  const control = page.getByRole('button', { name: controlName }).first()
  await control.scrollIntoViewIfNeeded(); await control.click(); await page.waitForTimeout(250); await snap('warm-child')
  await page.reload({ waitUntil: 'networkidle' }); await snap('cold-reload-child')
  await page.goBack({ waitUntil: 'networkidle' }); await page.waitForTimeout(250); await snap('back-restored-parent')
  await context.close()
  return { name, snapshots }
}

const journeys = [
  await journey('plaza-detail-plaza', 'pages/plaza/index', /喷火龙 烈焰速攻/),
  await journey('event-round-event', 'pages/event/index?id=0', /查看全部卡组/),
]

const masked = []
for (const [route, routePath] of [['plaza', 'pages/plaza/index'], ['event', 'pages/event/index?id=0'], ['detail', 'pages/detail/index?id=0']]) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await context.newPage(); await page.goto(base + routePath, { waitUntil: 'networkidle' })
  await page.addStyleTag({ content: `
    .brand-title,.event-title,.dname,.logo,.brandmark,.eyebrow,.season-kicker,.pitch-kicker { color: transparent !important; text-shadow:none !important; }
    img[alt*="logo" i], [class*="logo" i] { visibility:hidden !important; }
  ` })
  const file = `masked-${route}-desktop.png`
  await page.screenshot({ path: path.join(out, file), fullPage: true })
  masked.push({ route, file, rootClass: await page.evaluate(() => document.documentElement.className) })
  await context.close()
}

await browser.close()
await fs.writeFile(path.join(out, 'supplemental-probes.json'), JSON.stringify({ schema: 'brand-heldout-fresh-supplemental/v1', generatedAt: new Date().toISOString(), rows, journeys, masked }, null, 2) + '\n')
